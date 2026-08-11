import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Film, Plane, Store, Ticket } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

const PROMOS = [
  {
    id: 'p1',
    title: '10% en supermercados',
    desc: 'Descuento exclusivo en supermercados adheridos durante el mes.',
    icon: Store,
    color: '#26FFC1',
    vigencia: 'Hasta fin de mes',
    condiciones: ['Tope $8.000 de descuento', 'Un uso por semana', 'Solo con tarjeta MONIX'],
  },
  {
    id: 'p2',
    title: '2x1 en cines',
    desc: 'Llevá a alguien gratis en funciones seleccionadas.',
    icon: Film,
    color: '#7C9CFF',
    vigencia: 'Lunes a jueves',
    condiciones: ['Cines adheridos', 'No acumulable con otras promos', 'Entradas 2D standard'],
  },
  {
    id: 'p3',
    title: '30% en viajes',
    desc: 'Descuentos en pasajes y alojamientos partners.',
    icon: Plane,
    color: '#FFB347',
    vigencia: 'Viajes hasta diciembre',
    condiciones: ['Mínimo $80.000', 'Pago en 1 cuota', 'Sujeto a disponibilidad'],
  },
  {
    id: 'p4',
    title: '15% en indumentaria',
    desc: 'Marcas partners en shoppings y online.',
    icon: Ticket,
    color: '#F472B6',
    vigencia: 'Fines de semana',
    condiciones: ['Tope $15.000', 'Excluye outlets', 'Presentá tu QR MONIX'],
  },
]

export function PromosPage() {
  const [activa, setActiva] = useState<string | null>(null)
  const [activadas, setActivadas] = useState<string[]>([])

  function activar(id: string, title: string) {
    if (activadas.includes(id)) return
    setActivadas((prev) => [...prev, id])
    toast.success(`Oferta activada: ${title}`)
  }

  return (
    <PageWrapper>
      <div className="max-w-3xl mx-auto">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 font-body text-sm text-slate-secondary hover:text-mint transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          Volver al inicio
        </Link>

        <h1 className="font-display text-2xl font-semibold text-navy dark:text-white mb-1">
          Ofertas Monix
        </h1>
        <p className="font-body text-sm text-slate-secondary mb-6">
          Tocá una oferta para ver condiciones y activarla
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PROMOS.map((p) => {
            const open = activa === p.id
            const on = activadas.includes(p.id)
            const Icon = p.icon
            return (
              <Card key={p.id} className={`overflow-hidden transition-shadow ${open ? 'ring-1 ring-mint/40 shadow-md' : ''}`}>
                <button
                  type="button"
                  className="w-full text-left p-4"
                  onClick={() => setActiva(open ? null : p.id)}
                  aria-expanded={open}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${p.color}22`, color: p.color }}
                    >
                      <Icon size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-xs text-slate-secondary">Promoción</p>
                      <p className="font-display font-semibold text-navy dark:text-white">{p.title}</p>
                      <p className="font-body text-sm text-slate-secondary mt-1">{p.desc}</p>
                      <p className="font-body text-xs text-mint mt-2">{p.vigencia}</p>
                    </div>
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-2 border-t border-slate-200 dark:border-white/10 pt-3">
                        {p.condiciones.map((c) => (
                          <p key={c} className="font-body text-xs text-slate-secondary flex items-start gap-2">
                            <Check size={13} className="text-mint shrink-0 mt-0.5" />
                            {c}
                          </p>
                        ))}
                        <Button
                          className="w-full mt-2"
                          variant={on ? 'secondary' : 'primary'}
                          disabled={on}
                          onClick={() => activar(p.id, p.title)}
                        >
                          {on ? 'Oferta activada' : 'Activar oferta'}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            )
          })}
        </div>
      </div>
    </PageWrapper>
  )
}
