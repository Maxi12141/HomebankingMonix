import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { DollarSign, Landmark } from 'lucide-react'
import { useMercadoFinanciero } from '../hooks/useMercadoFinanciero'

const DOLAR_LABELS: Record<string, string> = {
  oficial: 'Oficial',
  blue: 'Blue',
}

/** Velocidad constante del scroll, en píxeles por segundo (independiente de cuánto texto haya). */
const SPEED_PX_PER_SEC = 15
/** Cuántas veces se repite el set de items para asegurar que siempre haya contenido de sobra y no queden huecos vacíos. */
const REPEAT = 6

function formatARS(value: number) {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(value)
}

function formatPct(value: number) {
  return `${value.toFixed(1).replace('.', ',')}%`
}

interface TickerItem {
  key: string
  icon: typeof DollarSign
  label: string
  value: string
}

export function MarketTicker() {
  const { data, loading } = useMercadoFinanciero()
  const trackRef = useRef<HTMLDivElement>(null)
  const [duration, setDuration] = useState(40)

  const items: TickerItem[] = useMemo(() => {
    if (!data) return []

    const dolarItems: TickerItem[] = data.dolares
      .filter((d) => DOLAR_LABELS[d.casa])
      .map((d) => ({
        key: `dolar-${d.casa}`,
        icon: DollarSign,
        label: `Dólar ${DOLAR_LABELS[d.casa]}`,
        value: `Compra $${formatARS(d.compra)} · Venta $${formatARS(d.venta)}`,
      }))

    return [
      ...dolarItems,
      ...(data.tnaPrestamosProm != null
        ? [
            {
              key: 'prestamos',
              icon: Landmark,
              label: 'Préstamos personales',
              value: `TNA promedio ${formatPct(data.tnaPrestamosProm * 100)}`,
            },
          ]
        : []),
    ]
  }, [data])

  const block = useMemo(() => Array.from({ length: REPEAT }, () => items).flat(), [items])
  const loop = useMemo(() => [...block, ...block], [block])

  useLayoutEffect(() => {
    if (!trackRef.current || block.length === 0) return

    function measure() {
      const setWidth = (trackRef.current?.scrollWidth ?? 0) / 2
      if (setWidth > 0) setDuration(setWidth / SPEED_PX_PER_SEC)
    }

    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [block])

  if (loading || !data || items.length === 0) return null

  return (
    <div
      className="bg-navy dark:bg-navy-card border-b border-white/10 overflow-hidden"
      role="marquee"
      aria-label="Cotizaciones y tasas del mercado en tiempo real"
    >
      <div
        ref={trackRef}
        className="flex w-max animate-marquee"
        style={{ animationDuration: `${duration}s` }}
      >
        {loop.map((item, i) => (
          <div
            key={`${item.key}-${i}`}
            className="flex items-center gap-2 px-6 py-2 whitespace-nowrap shrink-0"
            aria-hidden={i >= block.length}
          >
            <item.icon size={14} className="text-mint shrink-0" />
            <span className="font-body text-xs text-white/60">{item.label}</span>
            <span className="font-body text-xs font-semibold text-white">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
