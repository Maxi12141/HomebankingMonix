import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Reserva } from '../types'

const MS_PER_DAY = 86_400_000

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
    setLoading(true)
    try {
      let { data, error } = await supabase
        .from('reservas')
        .select('*')
        .eq('cuenta_id', id)
        .maybeSingle()

      if (error) throw error

      if (!data) {
        const { data: created, error: errCreate } = await supabase
          .from('reservas')
          .insert({ cuenta_id: id, saldo: 0, tasa_anual: 32 })
          .select('*')
          .single()
        if (errCreate) throw errCreate
        data = created
      }

      const current = data as Reserva
      const last = new Date(current.ultima_interes_at).getTime()
      const days = Math.floor((Date.now() - last) / MS_PER_DAY)
      const interest = calcInterestForDays(Number(current.saldo), Number(current.tasa_anual), days)

      if (interest > 0) {
        const nuevoSaldo = roundMoney(Number(current.saldo) + interest)
        const nuevaFecha = new Date(last + days * MS_PER_DAY).toISOString()
        const { data: updated, error: errUp } = await supabase
          .from('reservas')
          .update({
            saldo: nuevoSaldo,
            ultima_interes_at: nuevaFecha,
          })
          .eq('id', current.id)
          .select('*')
          .single()
        if (errUp) throw errUp
        setReserva(updated as Reserva)
        setInteresHoy(interest)
      } else {
        setReserva(current)
        setInteresHoy(0)
      }
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
