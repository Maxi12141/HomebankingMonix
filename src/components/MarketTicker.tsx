import { DollarSign, Landmark, Activity, PiggyBank } from 'lucide-react'
import { useMercadoFinanciero } from '../hooks/useMercadoFinanciero'

const DOLAR_LABELS: Record<string, string> = {
  oficial: 'Oficial',
  blue: 'Blue',
  bolsa: 'MEP',
  contadoconliqui: 'CCL',
}

const RESERVAS_TNA_MONIX = 32

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

  if (loading || !data) return null

  const dolarItems: TickerItem[] = data.dolares
    .filter((d) => DOLAR_LABELS[d.casa])
    .map((d) => ({
      key: `dolar-${d.casa}`,
      icon: DollarSign,
      label: `Dólar ${DOLAR_LABELS[d.casa]}`,
      value: `Compra $${formatARS(d.compra)} · Venta $${formatARS(d.venta)}`,
    }))

  const items: TickerItem[] = [
    ...dolarItems,
    ...(data.tnaPrestamosProm != null
      ? [
          {
            key: 'prestamos',
            icon: Landmark,
            label: 'Préstamos personales',
            value: `TNA promedio del mercado ${formatPct(data.tnaPrestamosProm * 100)}`,
          },
        ]
      : []),
    ...(data.riesgoPais != null
      ? [
          {
            key: 'riesgo-pais',
            icon: Activity,
            label: 'Riesgo País',
            value: `${data.riesgoPais} pts`,
          },
        ]
      : []),
    ...(data.tnaPlazoFijoProm != null
      ? [
          {
            key: 'reservas',
            icon: PiggyBank,
            label: 'Reservas Monix',
            value: `TNA ${formatPct(RESERVAS_TNA_MONIX)} vs. ${formatPct(data.tnaPlazoFijoProm * 100)} promedio de plazo fijo del mercado`,
          },
        ]
      : []),
  ]

  if (items.length === 0) return null

  const loop = [...items, ...items]

  return (
    <div
      className="bg-navy dark:bg-navy-card border-b border-white/10 overflow-hidden"
      role="marquee"
      aria-label="Cotizaciones y tasas del mercado en tiempo real"
    >
      <div className="flex w-max animate-marquee">
        {loop.map((item, i) => (
          <div
            key={`${item.key}-${i}`}
            className="flex items-center gap-2 px-6 py-2 whitespace-nowrap shrink-0"
            aria-hidden={i >= items.length}
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
