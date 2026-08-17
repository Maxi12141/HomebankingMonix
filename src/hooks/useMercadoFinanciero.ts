import { useEffect, useState } from 'react'
import { getDolares, getPrestamosPersonales, type CotizacionDolar } from '../services/mercadoFinanciero'

export interface MercadoFinanciero {
  dolares: CotizacionDolar[]
  tnaPrestamosProm: number | null
}

export function useMercadoFinanciero() {
  const [data, setData] = useState<MercadoFinanciero | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    Promise.allSettled([getDolares(), getPrestamosPersonales()]).then(([dolaresR, prestamosR]) => {
      if (cancelled) return

      const dolares = dolaresR.status === 'fulfilled' ? dolaresR.value : []

      const tnaPrestamosProm =
        prestamosR.status === 'fulfilled' && prestamosR.value.length > 0
          ? prestamosR.value.reduce((sum, p) => sum + p.tna, 0) / prestamosR.value.length
          : null

      setData({ dolares, tnaPrestamosProm })
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return { data, loading }
}
