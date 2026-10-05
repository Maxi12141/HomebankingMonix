import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useCuentaStore } from '../store/cuentaStore'
import { useAuthStore } from '../store/authStore'
import { calcInterestForDays } from './useReserva'
import type { Cuenta } from '../types'

const MS_PER_DAY = 86_400_000
const TASA_DEFAULT = 32

function roundMoney(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Una sola suscripción Realtime por cuenta, compartida entre todos los
 * `useCuenta()` montados (el layout y cada página).
 *
 * supabase-js reutiliza el canal si el nombre coincide. Si un segundo
 * mount hace `.on('postgres_changes')` sobre un canal ya en `subscribe()`,
 * tira: "cannot add postgres_changes callbacks after subscribe()".
 *
 * React 18 StrictMode desmonta al toque: si removeChannel() corre en ese
 * cleanup, el WebSocket se cierra antes de conectar. Por eso el unsubscribe
 * espera un tick.
 */
const UNMOUNT_GRACE_MS = 400
let realtimeSeq = 0
const realtimeRefCount = new Map<string, number>()
const realtimeChannels = new Map<string, ReturnType<typeof supabase.channel>>()
const pendingUnsub = new Map<string, number>()

function retainCuentaRealtime(ids: string[]) {
  for (const id of ids) {
    const pending = pendingUnsub.get(id)
    if (pending != null) {
      window.clearTimeout(pending)
      pendingUnsub.delete(id)
    }

    const prev = realtimeRefCount.get(id) ?? 0
    realtimeRefCount.set(id, prev + 1)
    if (realtimeChannels.has(id)) continue

    try {
      const channel = supabase
        .channel(`cuenta-rt-${id}-${++realtimeSeq}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'cuentas',
          filter: `id=eq.${id}`,
        }, (payload) => {
          const newSaldo = (payload.new as Record<string, unknown>).saldo
          if (typeof newSaldo === 'number') {
            useCuentaStore.getState().updateSaldoCuenta(id, newSaldo)
          }
        })
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('Realtime de cuenta no disponible:', status)
          }
        })
      realtimeChannels.set(id, channel)
    } catch (err) {
      realtimeRefCount.delete(id)
      console.error('No se pudo suscribir a cambios de la cuenta:', err)
    }
  }

  return () => {
    for (const id of ids) {
      const next = (realtimeRefCount.get(id) ?? 1) - 1
      if (next > 0) {
        realtimeRefCount.set(id, next)
        continue
      }
      realtimeRefCount.set(id, 0)
      const t = window.setTimeout(() => {
        pendingUnsub.delete(id)
        if ((realtimeRefCount.get(id) ?? 0) > 0) return
        realtimeRefCount.delete(id)
        const channel = realtimeChannels.get(id)
        realtimeChannels.delete(id)
        if (channel) void supabase.removeChannel(channel)
      }, UNMOUNT_GRACE_MS)
      pendingUnsub.set(id, t)
    }
  }
}

function useCuentaRealtime() {
  const cuentas = useCuentaStore((s) => s.cuentas)
  const cuentaIds = cuentas.map((c) => c.id).join(',')

  useEffect(() => {
    if (!cuentaIds) return
    return retainCuentaRealtime(cuentaIds.split(','))
  }, [cuentaIds])
}

// Una sola carga a la vez por persona, compartida entre todos los useCuenta()
// montados (el global de App + el de cada página). Antes cada instancia
// cargaba y acreditaba el interés por su cuenta: con dos montadas a la vez se
// insertaba dos veces el mismo "Rendimiento de Reserva".
interface CargaCuentas {
  todas: Cuenta[]
  interesPorCuenta: Record<string, number>
}
let cargaEnCurso: { personaId: string; promesa: Promise<CargaCuentas | null> } | null = null

function cargarCuentasCompartido(personaId: string): Promise<CargaCuentas | null> {
  if (cargaEnCurso?.personaId === personaId) return cargaEnCurso.promesa
  const promesa = cargarCuentas(personaId).finally(() => {
    if (cargaEnCurso?.promesa === promesa) cargaEnCurso = null
  })
  cargaEnCurso = { personaId, promesa }
  return promesa
}

async function cargarCuentas(personaId: string): Promise<CargaCuentas | null> {
  const { data, error } = await supabase
    .from('cuentas')
    .select('*')
    .eq('persona_id', personaId)
    .eq('activa', true)
  if (error) {
    console.error('Error al cargar cuentas:', error.message)
    return null
  }
  const accrued = await Promise.all(((data ?? []) as Cuenta[]).map(accrueInterest))
  return {
    todas: accrued.map((a) => a.cuenta),
    interesPorCuenta: Object.fromEntries(accrued.map((a) => [a.cuenta.id, a.interes])),
  }
}

async function accrueInterest(current: Cuenta): Promise<{ cuenta: Cuenta; interes: number }> {
  const tasa = Number(current.tasa_anual ?? TASA_DEFAULT)
  const lastRaw = current.ultima_interes_at
  const last = lastRaw ? new Date(lastRaw).getTime() : Date.now()
  const days = Math.floor((Date.now() - last) / MS_PER_DAY)
  const interest = calcInterestForDays(Number(current.saldo), tasa, days)

  if (interest <= 0) {
    // Ensure tasa is set for older rows / display
    if (current.tasa_anual == null) {
      return { cuenta: { ...current, tasa_anual: TASA_DEFAULT }, interes: 0 }
    }
    return { cuenta: current, interes: 0 }
  }

  const nuevoSaldo = roundMoney(Number(current.saldo) + interest)
  const nuevaFecha = new Date(last + days * MS_PER_DAY).toISOString()

  // Candado optimista: sólo acredita si nadie tocó la cuenta desde que se
  // leyó (otra pestaña, otro celular, o una transferencia que entró en el
  // medio). Si cambió algo, no se escribe nada: la próxima carga acredita
  // con los datos frescos y el interés nunca se duplica ni pisa un saldo.
  let update = supabase
    .from('cuentas')
    .update({
      saldo: nuevoSaldo,
      ultima_interes_at: nuevaFecha,
      tasa_anual: tasa || TASA_DEFAULT,
    })
    .eq('id', current.id)
    .eq('saldo', current.saldo)
  update = lastRaw ? update.eq('ultima_interes_at', lastRaw) : update.is('ultima_interes_at', null)
  const { data: updated, error } = await update.select('*').maybeSingle()

  if (error) {
    console.error('Error al acreditar interés del saldo:', error.message)
    return { cuenta: current, interes: 0 }
  }
  if (!updated) {
    const { data: fresca } = await supabase.from('cuentas').select('*').eq('id', current.id).maybeSingle()
    return { cuenta: (fresca as Cuenta | null) ?? current, interes: 0 }
  }

  await supabase.from('movimientos').insert({
    cuenta_id: current.id,
    tipo: 'deposito',
    monto: interest,
    saldo_resultante: nuevoSaldo,
    descripcion: 'Rendimiento de Reserva',
  })

  return { cuenta: updated as Cuenta, interes: interest }
}

export function useCuenta() {
  const { cuenta, setCuenta, cuentas, setCuentas, setCuentasLoaded } = useCuentaStore()
  const { user } = useAuthStore()
  const userId = user?.id
  const [interesHoy, setInteresHoy] = useState(0)
  const [interesHoyPorCuenta, setInteresHoyPorCuenta] = useState<Record<string, number>>({})

  useCuentaRealtime()

  useEffect(() => {
    if (userId) fetchCuentas(userId)
  }, [userId])

  async function fetchCuentas(personaId: string) {
    try {
      const carga = await cargarCuentasCompartido(personaId)
      if (!carga) return
      if (carga.todas.length === 0) {
        setCuentas([])
        setCuenta(null)
        setInteresHoy(0)
        return
      }
      const { todas, interesPorCuenta } = carga
      const ars = todas.find((c) => c.moneda === 'ARS')
      setCuentas(todas)
      setCuenta(ars ?? todas[0])
      setInteresHoy(ars ? interesPorCuenta[ars.id] ?? 0 : 0)
      setInteresHoyPorCuenta(interesPorCuenta)
    } finally {
      setCuentasLoaded(true)
    }
  }

  async function refreshCuenta() {
    if (user) await fetchCuentas(user.id)
  }

  return { cuenta, cuentas, refreshCuenta, interesHoy, interesHoyPorCuenta }
}
