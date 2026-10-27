import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useCuentaStore } from '../store/cuentaStore'
import { esModoPrueba } from '../lib/modoPrueba'
import type { Cuenta, Prestamo } from '../types'

/**
 * Trae los préstamos de la cuenta y cobra cuotas vencidas al vuelo (sin cron
 * real), igual que el interés de useReserva/useCuenta. Cuotas sin saldo
 * suficiente quedan "atrasadas" sin reportar mora a la Central de Deudores
 * real (dato compartido entre alumnos).
 */
export function usePrestamos(cuenta: Cuenta | null) {
  const [prestamos, setPrestamos] = useState<Prestamo[]>([])
  const [loading, setLoading] = useState(true)
  const { updateSaldoCuenta } = useCuentaStore()
  const processingRef = useRef(false)

  const fetchAndAccrue = useCallback(async (cta: Cuenta) => {
    if (esModoPrueba()) {
      setPrestamos([])
      setLoading(false)
      return
    }
    if (processingRef.current) return
    processingRef.current = true
    setLoading(true)
    try {
      // Las cuotas vencidas las cobra el servidor (S-1, docs/auditoria-2026-10.md);
      // sin saldo, la cuota queda atrasada y se reintenta en la próxima carga.
      const { data: saldo, error: errCobro } = await supabase.rpc('cobrar_cuotas_prestamos', { p_cuenta_id: cta.id })
      if (errCobro) throw errCobro
      if (saldo != null && Number(saldo) !== Number(cta.saldo)) updateSaldoCuenta(cta.id, Number(saldo))

      const { data, error } = await supabase
        .from('prestamos')
        .select('*')
        .eq('cuenta_id', cta.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      const lista = (data ?? []) as Prestamo[]

      setPrestamos(lista)
    } catch (err) {
      console.error('Error al cargar préstamos:', err)
    } finally {
      setLoading(false)
      processingRef.current = false
    }
  }, [updateSaldoCuenta])

  useEffect(() => {
    if (!cuenta) {
      setPrestamos([])
      setLoading(false)
      return
    }
    fetchAndAccrue(cuenta)
    // Corre sólo cuando cambia cuenta.id, no en cada cambio de saldo (transferencia, depósito).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuenta?.id])

  async function refreshPrestamos() {
    if (cuenta) await fetchAndAccrue(cuenta)
  }

  return { prestamos, loading, refreshPrestamos }
}
