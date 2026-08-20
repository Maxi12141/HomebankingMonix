import { useEffect, useState } from 'react'
import { getDolares, getPrestamosPersonales, type CotizacionDolar } from '../services/mercadoFinanciero'

export interface MercadoFinanciero {
  dolares: CotizacionDolar[]
  tnaPrestamosProm: number | null
}

/** @param intervalMs si se pasa, refresca la cotización en ese intervalo (para pantallas "en tiempo real"). */
export function useMercadoFinanciero(intervalMs?: number) {
  const [data, setData] = useState<MercadoFinanciero | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    function load() {
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
