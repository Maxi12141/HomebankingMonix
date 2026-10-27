import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { esModoPrueba, reservaPrueba } from '../lib/modoPrueba'
import type { Reserva } from '../types'

function roundMoney(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Interés diario compuesto según TNA (como rendimiento diario tipo MP). */
export function calcInterestForDays(saldo: number, tasaAnual: number, days: number) {
  if (saldo <= 0 || days <= 0 || tasaAnual <= 0) return 0
  const dailyRate = tasaAnual / 100 / 365
  return roundMoney(saldo * (Math.pow(1 + dailyRate, days) - 1))
}

export function estimacionDiaria(saldo: number, tasaAnual: number) {
  return calcInterestForDays(saldo, tasaAnual, 1)
}

export function useReserva(cuentaId?: string | null) {
  const [reserva, setReserva] = useState<Reserva | null>(null)
  const [loading, setLoading] = useState(true)
  const [interesHoy, setInteresHoy] = useState(0)

  const ensureAndAccrue = useCallback(async (id: string) => {
    if (esModoPrueba()) {
      setReserva(reservaPrueba())
      setInteresHoy(18.4)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      // Alta (si no existe) y rendimiento del día, en el servidor (S-1,
      // docs/auditoria-2026-10.md): el navegador ya no escribe la reserva.
      const { data, error } = await supabase.rpc('preparar_reserva', { p_cuenta_id: id })
      if (error) throw error
      const { reserva, interes } = data as { reserva: Reserva; interes: number }
      setReserva(reserva)
      setInteresHoy(Number(interes))
    } catch (err) {
      console.error('Error al cargar reserva:', err)
      setReserva(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!cuentaId) {
      setReserva(null)
      setLoading(false)
      return
    }
    ensureAndAccrue(cuentaId)
  }, [cuentaId, ensureAndAccrue])

  async function refreshReserva() {
    if (cuentaId) await ensureAndAccrue(cuentaId)
  }

  return { reserva, loading, interesHoy, refreshReserva }
}
