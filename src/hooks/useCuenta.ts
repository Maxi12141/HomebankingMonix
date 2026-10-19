import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useCuentaStore } from '../store/cuentaStore'
import { useAuthStore } from '../store/authStore'
import type { Cuenta } from '../types'

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
      console.error('No pudimos suscribir a cambios de la cuenta:', err)
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
  // El interés diario lo acredita el servidor (S-1, docs/auditoria-2026-10.md):
  // el navegador ya no puede escribir saldos. Después se leen ya actualizados.
  const { data: intereses, error: errInteres } = await supabase.rpc('acreditar_interes_cuentas')
  if (errInteres) console.error('Error al acreditar interés del saldo:', errInteres.message)

  const { data, error } = await supabase
    .from('cuentas')
    .select('*')
    .eq('persona_id', personaId)
    .eq('activa', true)
  if (error) {
    console.error('Error al cargar cuentas:', error.message)
    return null
  }
  const filas = (intereses ?? []) as { cuenta_id: string; interes: number }[]
  return {
    todas: (data ?? []) as Cuenta[],
    interesPorCuenta: Object.fromEntries(filas.map((f) => [f.cuenta_id, Number(f.interes)])),
  }
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
