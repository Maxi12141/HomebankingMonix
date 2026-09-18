import { useEffect, useState } from 'react'
import { getDolares, getPlazoFijo, getPrestamosPersonales, type CotizacionDolar } from '../services/mercadoFinanciero'

export interface MercadoFinanciero {
  dolares: CotizacionDolar[]
  tnaPrestamosProm: number | null
  tnaPlazoFijoProm: number | null
}

/** @param intervalMs si se pasa, refresca la cotización en ese intervalo (para pantallas "en tiempo real"). */
export function useMercadoFinanciero(intervalMs?: number) {
  const [data, setData] = useState<MercadoFinanciero | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    function load() {
      Promise.allSettled([getDolares(), getPrestamosPersonales(), getPlazoFijo()]).then(([dolaresR, prestamosR, plazoFijoR]) => {
        if (cancelled) return

        const dolares = dolaresR.status === 'fulfilled' ? dolaresR.value : []

        const tnaPrestamosProm =
          prestamosR.status === 'fulfilled' && prestamosR.value.length > 0
            ? prestamosR.value.reduce((sum, p) => sum + p.tna, 0) / prestamosR.value.length
            : null

        const tasasPlazoFijo =
          plazoFijoR.status === 'fulfilled' ? plazoFijoR.value.filter((p) => p.tnaClientes > 0) : []
        const tnaPlazoFijoProm =
          tasasPlazoFijo.length > 0
            ? tasasPlazoFijo.reduce((sum, p) => sum + p.tnaClientes, 0) / tasasPlazoFijo.length
            : null

        setData({ dolares, tnaPrestamosProm, tnaPlazoFijoProm })
        setLoading(false)
      })
    }

    load()
    const id = intervalMs ? setInterval(load, intervalMs) : undefined

    return () => {
      cancelled = true
      if (id) clearInterval(id)
    }
  }, [intervalMs])

  return { data, loading }
}
