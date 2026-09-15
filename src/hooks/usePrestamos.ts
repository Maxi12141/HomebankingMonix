import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useCuentaStore } from '../store/cuentaStore'
import { addMonths } from '../utils/prestamos'
import type { Cuenta, Prestamo } from '../types'

function roundMoney(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

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
    if (processingRef.current) return
    processingRef.current = true
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('prestamos')
        .select('*')
        .eq('cuenta_id', cta.id)
        .order('created_at', { ascending: false })
      if (error) throw error

      const lista = (data ?? []) as Prestamo[]
      let saldoActual = Number(cta.saldo)
      let saldoCambio = false

      for (const prestamo of lista) {
        if (prestamo.estado !== 'activo') continue

        let cuotasPagadas = prestamo.cuotas_pagadas
        let proxima = prestamo.proxima_cuota_at
        let cambio = false

        while (new Date(proxima).getTime() <= Date.now() && cuotasPagadas < prestamo.cuotas_totales) {
          if (saldoActual < Number(prestamo.cuota_monto)) break // cuota atrasada, se reintenta después

          saldoActual = roundMoney(saldoActual - Number(prestamo.cuota_monto))
          cuotasPagadas += 1
          proxima = addMonths(proxima, 1)
          cambio = true
          saldoCambio = true

          await supabase.from('movimientos').insert({
            cuenta_id: cta.id,
            tipo: 'extraccion',
            monto: prestamo.cuota_monto,
            saldo_resultante: saldoActual,
            descripcion: `Cuota préstamo ${cuotasPagadas}/${prestamo.cuotas_totales}`,
          })
        }

        if (cambio) {
          const estado = cuotasPagadas >= prestamo.cuotas_totales ? 'pagado' : 'activo'
          await supabase
            .from('prestamos')
            .update({ cuotas_pagadas: cuotasPagadas, proxima_cuota_at: proxima, estado })
            .eq('id', prestamo.id)
          prestamo.cuotas_pagadas = cuotasPagadas
          prestamo.proxima_cuota_at = proxima
          prestamo.estado = estado
        }
      }

      if (saldoCambio) {
        await supabase.from('cuentas').update({ saldo: saldoActual }).eq('id', cta.id)
        updateSaldoCuenta(cta.id, saldoActual)
      }

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
