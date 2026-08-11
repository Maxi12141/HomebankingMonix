import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useCuentaStore } from '../store/cuentaStore'
import type { Movimiento } from '../types'

export function useMovimientos(limit?: number) {
  const { cuenta, refreshTick } = useCuentaStore()
  const cuentaId = cuenta?.id
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMovimientos = useCallback(async () => {
    if (!cuentaId) return
    setLoading(true)
    let query = supabase
      .from('movimientos')
      .select('*')
      .eq('cuenta_id', cuentaId)
      .order('created_at', { ascending: false })

    if (limit) query = query.limit(limit)

    const { data, error } = await query
    if (error) {
      console.error('Error al cargar movimientos:', error.message)
      setLoading(false)
      return
    }
    setMovimientos((data as Movimiento[]) ?? [])
    setLoading(false)
  }, [cuentaId, limit, refreshTick])

  useEffect(() => {
    fetchMovimientos()
  }, [fetchMovimientos])

  return { movimientos, loading, refresh: fetchMovimientos }
}
