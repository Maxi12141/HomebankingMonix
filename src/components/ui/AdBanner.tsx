import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  ShoppingBag,
  Sparkles,
  ChevronDown,
  Tag,
  Film,
  Plane,
  Store,
  Utensils,
  CalendarClock,
} from 'lucide-react'

type PanelId = 'ofertas' | 'cashback' | 'financiacion' | null

const OFERTAS = [
  { icon: Store, title: '10% supermercados', detail: 'Todos los martes en cadenas adheridas' },
  { icon: Film, title: '2x1 en cines', detail: 'Funciones seleccionadas de lun a jue' },
  { icon: Plane, title: '30% en viajes', detail: 'Pasajes y hoteles partners MONIX' },
]

const CASHBACKS = [
  { icon: ShoppingBag, title: 'mercadoMONIX', detail: 'Hasta 8% de devolución' },
  { icon: Utensils, title: 'Restós adheridos', detail: '3% en gastronomía' },
  { icon: Tag, title: 'Combustible', detail: '5% los fines de semana' },
]

const PLANES = [
  { icon: CalendarClock, title: '3 cuotas', detail: 'Sin interés hasta $50.000' },
  { icon: CalendarClock, title: '6 cuotas', detail: 'Tasa fija · aprobación rápida' },
  { icon: CalendarClock, title: '12 cuotas', detail: 'Cuotas fijas mensuales' },
]

export function AdBanner() {
  const [open, setOpen] = useState<PanelId>(null)

  function toggle(id: Exclude<PanelId, null>) {
    setOpen((prev) => (prev === id ? null : id))
  }

  return (
    <div className="space-y-3">
      <Link
        to="/mercado-monix"
        className="block rounded-2xl overflow-hidden border border-mint/25 group relative transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:shadow-lg hover:shadow-mint/10"
        style={{
          background:
            'radial-gradient(90% 120% at 100% 0%, rgba(38,255,193,0.28) 0%, transparent 45%), linear-gradient(120deg, #001A3D 0%, #0D2B52 50%, #001A3D 100%)',
        }}
      >
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] bg-white/5" />
        <div className="relative px-4 py-4 sm:px-5 sm:py-5 flex items-center gap-3 sm:gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-mint/20 border border-mint/30 flex items-center justify-center shrink-0">
            <ShoppingBag size={24} className="text-mint" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="font-display text-[10px] sm:text-xs font-bold tracking-[0.18em] text-mint uppercase">
                mercadoMONIX
              </span>
              <Sparkles size={12} className="text-mint" />
            </div>
            <p className="font-display text-base sm:text-lg font-semibold text-white leading-tight">
              Todo lo que buscás, con el toque Monix
            </p>
            <p className="font-body text-xs text-white/65 mt-0.5">
              Envío full · cuotas · cashback en compras seleccionadas
            </p>
          </div>
          <span className="hidden sm:inline-flex shrink-0 rounded-xl bg-mint text-navy font-body text-xs font-bold px-3 py-2 group-hover:bg-mint-hover transition-colors">
            Entrar
          </span>
        </div>
      </Link>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <PromoCard
          active={open === 'ofertas'}
          onToggle={() => toggle('ofertas')}
          href="/promos"
          title="Ofertas Monix"
          subtitle="Descuentos exclusivos para clientes"
          accent="mint"
          icon={
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="2" y="4" width="20" height="16" rx="3" fill="#E6FFFA" />
              <path d="M7 10h10M7 14h6" stroke="#2DD4BF" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
          items={OFERTAS}
          cta="Ver todas las ofertas"
        />

        <PromoCard
          active={open === 'cashback'}
          onToggle={() => toggle('cashback')}
          href="/cashback"
          title="Cashback"
          subtitle="Recibí devolución en compras seleccionadas"
          accent="navy"
          icon={
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="9" fill="#EEF2FF" />
              <path d="M12 8v8M8 12h8" stroke="#3730A3" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
          items={CASHBACKS}
          cta="Ver mi cashback"
        />

        <PromoCard
          active={open === 'financiacion'}
          onToggle={() => toggle('financiacion')}
          href="/financiacion"
          title="Financiá con Monix"
          subtitle="Planes flexibles pensados para vos"
          accent="slate"
          icon={
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="3" y="6" width="18" height="12" rx="2" className="fill-slate-100 dark:fill-white/10" />
              <path d="M8 12h8M8 15h5" stroke="#0F172A" className="dark:stroke-white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
          items={PLANES}
          cta="Simular cuotas"
        />
      </div>
    </div>
  )
}

function PromoCard({
  active,
  onToggle,
  href,
  title,
  subtitle,
  accent,
  icon,
  items,
  cta,
}: {
  active: boolean
  onToggle: () => void
  href: string
  title: string
  subtitle: string
  accent: 'mint' | 'navy' | 'slate'
  icon: ReactNode
  items: { icon: LucideIcon; title: string; detail: string }[]
  cta: string
}) {
  const shell =
    accent === 'mint'
      ? 'bg-mint/5 border-mint/10 dark:bg-mint/10 dark:border-mint/15'
      : accent === 'navy'
        ? 'bg-navy/5 border-navy/10 dark:bg-white/5 dark:border-white/10'
        : 'bg-slate-50 border-slate-100 dark:bg-white/5 dark:border-white/10'

  const titleCls =
    accent === 'mint' ? 'text-mint' : 'text-navy dark:text-white'

  return (
    <div
      className={`rounded-lg border transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${shell} ${
        active
          ? 'shadow-md ring-1 ring-mint/30'
          : 'hover:shadow-md hover:-translate-y-0.5'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-4 flex items-center gap-3"
        aria-expanded={active}
      >
        <div className="shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className={`text-lg font-semibold ${titleCls}`}>{title}</div>
          <div className="text-sm text-slate-secondary mt-1">{subtitle}</div>
        </div>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-secondary transition-transform duration-200 ${
            active ? 'rotate-180 text-mint' : ''
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {active && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2 border-t border-slate-200/70 dark:border-white/10 pt-3">
              {items.map((item) => (
                <div
                  key={item.title}
                  className="flex items-start gap-2.5 rounded-xl bg-white/70 dark:bg-navy/40 px-3 py-2.5"
                >
                  <item.icon size={16} className="text-mint shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-body text-sm font-medium text-navy dark:text-white">
                      {item.title}
                    </p>
                    <p className="font-body text-xs text-slate-secondary">{item.detail}</p>
                  </div>
                </div>
              ))}
              <Link
                to={href}
                className="block text-center rounded-xl bg-mint text-navy font-body text-sm font-semibold py-2.5 hover:bg-mint-hover transition-colors"
              >
                {cta}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
