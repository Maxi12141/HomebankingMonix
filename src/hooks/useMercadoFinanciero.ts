import { useEffect, useState } from 'react'
import {
  getDolares,
  getPrestamosPersonales,
  getRiesgoPais,
  getTasasPlazoFijo,
  type CotizacionDolar,
} from '../services/mercadoFinanciero'

export interface MercadoFinanciero {
  dolares: CotizacionDolar[]
  tnaPrestamosProm: number | null
  riesgoPais: number | null
  tnaPlazoFijoProm: number | null
}

export function useMercadoFinanciero() {
  const [data, setData] = useState<MercadoFinanciero | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    Promise.allSettled([
      getDolares(),
      getPrestamosPersonales(),
      getRiesgoPais(),
      getTasasPlazoFijo(),
    ]).then(([dolaresR, prestamosR, riesgoR, plazoFijoR]) => {
      if (cancelled) return

      const dolares = dolaresR.status === 'fulfilled' ? dolaresR.value : []

      const tnaPrestamosProm =
        prestamosR.status === 'fulfilled' && prestamosR.value.length > 0
          ? prestamosR.value.reduce((sum, p) => sum + p.tna, 0) / prestamosR.value.length
          : null

      const riesgoPais = riesgoR.status === 'fulfilled' ? riesgoR.value.valor : null

      const tasasValidas =
        plazoFijoR.status === 'fulfilled' ? plazoFijoR.value.filter((t) => t.tnaClientes > 0) : []
      const tnaPlazoFijoProm =
        tasasValidas.length > 0
          ? tasasValidas.reduce((sum, t) => sum + t.tnaClientes, 0) / tasasValidas.length
          : null

      setData({ dolares, tnaPrestamosProm, riesgoPais, tnaPlazoFijoProm })
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return { data, loading }
}
