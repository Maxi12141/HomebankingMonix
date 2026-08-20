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

export function useCuenta() {
  const { cuenta, setCuenta, cuentas, setCuentas, updateSaldoCuenta } = useCuentaStore()
  const { user } = useAuthStore()
  const userId = user?.id
  const [interesHoy, setInteresHoy] = useState(0)

  useEffect(() => {
    if (userId) fetchCuentas(userId)
  }, [userId])

  async function fetchCuentas(personaId: string) {
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

    // Optional movement record for transparency
    await supabase.from('movimientos').insert({
      cuenta_id: current.id,
      tipo: 'deposito',
      monto: interest,
      saldo_resultante: nuevoSaldo,
      descripcion: 'Rendimiento diario|Interés sobre saldo disponible',
    })

    return { cuenta: updated as Cuenta, interes: interest }
  }

  const cuentaIds = cuentas.map((c) => c.id).join(',')

  useEffect(() => {
    if (!cuentaIds) return

    const channels = cuentaIds.split(',').map((id) =>
      supabase
        .channel(`cuenta-rt-${id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'cuentas',
          filter: `id=eq.${id}`,
        }, (payload) => {
          const newSaldo = (payload.new as Record<string, unknown>).saldo
          if (typeof newSaldo === 'number') updateSaldoCuenta(id, newSaldo)
        })
        .subscribe()
    )

    return () => { channels.forEach((ch) => supabase.removeChannel(ch)) }
  }, [cuentaIds])

  async function refreshCuenta() {
    if (user) await fetchCuentas(user.id)
  }

  return { cuenta, cuentas, refreshCuenta, interesHoy }
}
