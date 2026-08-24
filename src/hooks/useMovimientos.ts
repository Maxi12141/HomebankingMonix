import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useCuentaStore } from '../store/cuentaStore'
import type { Movimiento } from '../types'

export function useMovimientos(limit?: number) {
  const { cuentas, refreshTick } = useCuentaStore()
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [loading, setLoading] = useState(true)

  // string estable para el dependency array — cuentas cambia de referencia en cada fetch
  const cuentaIds = cuentas.map((c) => c.id).join(',')
  const monedaPorCuenta = new Map(cuentas.map((c) => [c.id, c.moneda]))

  const fetchMovimientos = useCallback(async () => {
    if (!cuentaIds) {
      setMovimientos([])
      setLoading(false)
      return
    }
    setLoading(true)
    let query = supabase
      .from('movimientos')
      .select('*')
      .in('cuenta_id', cuentaIds.split(','))
      .order('created_at', { ascending: false })

    if (limit) query = query.limit(limit)

    const { data, error } = await query
    if (error) {
      console.error('Error al cargar movimientos:', error.message)
      setLoading(false)
      return
    }
    const conMoneda = ((data as Omit<Movimiento, 'moneda'>[]) ?? []).map((m) => ({
      ...m,
      moneda: monedaPorCuenta.get(m.cuenta_id) ?? 'ARS',
    })) as Movimiento[]
    setMovimientos(conMoneda)
    setLoading(false)
  }, [cuentaIds, limit, refreshTick])

  useEffect(() => {
    fetchMovimientos()
  }, [fetchMovimientos])

  return { movimientos, loading, refresh: fetchMovimientos }
}
