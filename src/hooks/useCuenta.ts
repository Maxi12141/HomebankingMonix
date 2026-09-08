import { useEffect, useRef, useState } from 'react'
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
 * `useCuenta()` montados (CercaProvider + cada página).
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

export function useCuenta() {
  const { cuenta, setCuenta, cuentas, setCuentas } = useCuentaStore()
  const { user } = useAuthStore()
  const userId = user?.id
  const [interesHoy, setInteresHoy] = useState(0)
  const [interesHoyPorCuenta, setInteresHoyPorCuenta] = useState<Record<string, number>>({})
  // React.StrictMode dispara este efecto dos veces en desarrollo — sin este
  // guard, dos fetchCuentas concurrentes podían acreditar el mismo interés
  // dos veces (dos inserts de movimiento duplicados) al no leer nada nuevo
  // hasta que el primero termina de escribir.
  const fetchingRef = useRef(false)

  useCuentaRealtime()

  useEffect(() => {
    if (userId) fetchCuentas(userId)
  }, [userId])

  async function fetchCuentas(personaId: string) {
    if (fetchingRef.current) return
    fetchingRef.current = true
    try {
      const { data, error } = await supabase
        .from('cuentas')
        .select('*')
        .eq('persona_id', personaId)
        .eq('activa', true)
      if (error) {
        console.error('Error al cargar cuentas:', error.message)
        return
      }
      if (!data || data.length === 0) {
        setCuentas([])
        setCuenta(null)
        setInteresHoy(0)
        return
      }

      const accrued = await Promise.all((data as Cuenta[]).map(accrueInterest))
      const todas = accrued.map((a) => a.cuenta)
      setCuentas(todas)
      setCuenta(todas.find((c) => c.moneda === 'ARS') ?? todas[0])
      setInteresHoy(accrued.find((a) => a.cuenta.moneda === 'ARS')?.interes ?? 0)
      setInteresHoyPorCuenta(Object.fromEntries(accrued.map((a) => [a.cuenta.id, a.interes])))
    } finally {
      fetchingRef.current = false
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

    const { data: updated, error } = await supabase
      .from('cuentas')
      .update({
        saldo: nuevoSaldo,
        ultima_interes_at: nuevaFecha,
        tasa_anual: tasa || TASA_DEFAULT,
      })
      .eq('id', current.id)
      .select('*')
      .single()

    if (error || !updated) {
      console.error('Error al acreditar interés del saldo:', error?.message)
      return { cuenta: current, interes: 0 }
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

  async function refreshCuenta() {
    if (user) await fetchCuentas(user.id)
  }

  return { cuenta, cuentas, refreshCuenta, interesHoy, interesHoyPorCuenta }
}
