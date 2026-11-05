import { CATEGORIA_VARIOS, type CategoriaGasto } from '../utils/gastos'
import { formatMonto } from '../utils/cuenta'
import { useThemeStore } from '../stores/themeStore'

// Paleta validada con la herramienta de dataviz (claro y oscuro). El color sigue al
// concepto y no a su puesto: Vivienda es azul aunque un mes pese menos que Compras.
const COLORES: Record<string, { claro: string; oscuro: string }> = {
  Vivienda: { claro: '#2a78d6', oscuro: '#3987e5' },
  'Compras y servicios': { claro: '#eb6834', oscuro: '#d95926' },
  'Educación y salud': { claro: '#1baf7a', oscuro: '#199e70' },
  'Transporte y viajes': { claro: '#eda100', oscuro: '#c98500' },
  'Regalos y compartidos': { claro: '#e87ba4', oscuro: '#d55181' },
  Finanzas: { claro: '#008300', oscuro: '#008300' },
  'Pagos con QR': { claro: '#6250d6', oscuro: '#9085e9' },
  'Pagos de trabajo': { claro: '#e34948', oscuro: '#e66767' },
  [CATEGORIA_VARIOS]: { claro: '#8a8f98', oscuro: '#8f98a6' },
}

export function useColorDeCategoria() {
  const oscuro = useThemeStore((s) => s.theme === 'dark')
  return (categoria: string) => {
    const color = COLORES[categoria] ?? COLORES[CATEGORIA_VARIOS]
    return oscuro ? color.oscuro : color.claro
  }
}

const RADIO = 80
const GROSOR = 26
const PERIMETRO = 2 * Math.PI * RADIO
const SEPARACION = 3

interface DonaProps {
  categorias: CategoriaGasto[]
  resaltada: string | null
  onResaltar: (categoria: string | null) => void
}

/** Cómo se reparte el mes. La lista de abajo tiene los mismos números: el gráfico no los agrega. */
export function DonaGastos({ categorias, resaltada, onResaltar }: DonaProps) {
  const color = useColorDeCategoria()
  const total = categorias.reduce((suma, c) => suma + c.total, 0)
  const centro = categorias.find((c) => c.categoria === resaltada) ?? categorias[0]

  let recorrido = 0
  const segmentos = categorias.map((c) => {
    const largo = (c.total / total) * PERIMETRO
    const segmento = { categoria: c.categoria, inicio: recorrido, largo }
    recorrido += largo
    return segmento
  })

  return (
    <div className="relative w-52 h-52 mx-auto">
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full -rotate-90"
        role="img"
        aria-label={`Reparto de los gastos: ${categorias.map((c) => `${c.categoria} ${c.porcentaje}%`).join(', ')}`}
      >
        {segmentos.map((s) => (
          <circle
            key={s.categoria}
            cx="100"
            cy="100"
            r={RADIO}
            fill="none"
            stroke={color(s.categoria)}
            strokeWidth={resaltada === s.categoria ? GROSOR + 6 : GROSOR}
            strokeDasharray={`${Math.max(s.largo - (segmentos.length > 1 ? SEPARACION : 0), 1)} ${PERIMETRO}`}
            strokeDashoffset={-s.inicio}
            opacity={resaltada && resaltada !== s.categoria ? 0.35 : 1}
            className="cursor-pointer motion-safe:transition-[opacity,stroke-width] motion-safe:duration-200"
            onMouseEnter={() => onResaltar(s.categoria)}
            onMouseLeave={() => onResaltar(null)}
            onClick={() => onResaltar(s.categoria)}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-12 pointer-events-none" aria-hidden="true">
        <span className="font-display text-3xl font-bold text-navy dark:text-white">{centro.porcentaje}%</span>
        <span className="font-body text-xs text-slate-secondary leading-tight mt-1">{centro.categoria}</span>
      </div>
    </div>
  )
}

export interface MesGastos {
  desfase: number
  etiqueta: string
  nombre: string
  total: number
}

interface EvolucionProps {
  meses: MesGastos[]
  elegido: number
  onElegir: (desfase: number) => void
}

/** Un solo dato por mes: se toca una columna para ver ese mes en el resto de la pantalla. */
export function EvolucionGastos({ meses, elegido, onElegir }: EvolucionProps) {
  const maximo = Math.max(...meses.map((m) => m.total), 1)
  return (
    <div className="flex items-end gap-0.5 sm:gap-1.5 h-40" role="group" aria-label="Gastos de los últimos meses">
      {meses.map((m) => {
        const activo = m.desfase === elegido
        return (
          <button
            key={m.desfase}
            type="button"
            onClick={() => onElegir(m.desfase)}
            aria-pressed={activo}
            aria-label={`${m.nombre}: ${formatMonto(m.total, 'ARS')}`}
            title={`${m.nombre}: ${formatMonto(m.total, 'ARS')}`}
            className="flex-1 min-w-0 h-full flex flex-col justify-end items-center gap-2 rounded-lg hover:bg-navy/5 dark:hover:bg-white/5 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy dark:focus-visible:outline-mint"
          >
            <span className="w-full flex-1 flex items-end justify-center px-1.5 min-h-0">
              <span
                className={`block w-full rounded-t motion-safe:transition-[height] motion-safe:duration-300 ${activo ? 'bg-mint-tinta dark:bg-mint' : 'bg-navy/25 dark:bg-white/25'}`}
                style={{ height: m.total > 0 ? `${Math.max((m.total / maximo) * 100, 3)}%` : '2px' }}
              />
            </span>
            <span className={`font-body text-xs pb-1 ${activo ? 'font-semibold text-navy dark:text-white' : 'text-slate-secondary'}`}>
              {m.etiqueta}
            </span>
          </button>
        )
      })}
    </div>
  )
}
