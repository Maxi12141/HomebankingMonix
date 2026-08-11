import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

const PLANES = [
  { id: 'f1', months: 3, tasa: 0, max: 50000, desc: 'Sin interés para compras chicas' },
  { id: 'f2', months: 6, tasa: 2.5, max: 250000, desc: 'Tasa fija mensual competitiva' },
  { id: 'f3', months: 12, tasa: 3.2, max: 800000, desc: 'Cuotas fijas y aprobación rápida' },
]

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

export function FinanciacionPage() {
  const [planId, setPlanId] = useState(PLANES[0].id)
  const [monto, setMonto] = useState('45000')
  const [solicitado, setSolicitado] = useState(false)

  const plan = PLANES.find((p) => p.id === planId) ?? PLANES[0]
  const montoNum = parseFloat(monto) || 0

  const cuota = useMemo(() => {
    if (montoNum <= 0) return 0
    const total = montoNum * (1 + (plan.tasa / 100) * plan.months)
    return Math.round((total / plan.months) * 100) / 100
  }, [montoNum, plan])

  const total = useMemo(() => Math.round(cuota * plan.months * 100) / 100, [cuota, plan.months])
  const okMonto = montoNum > 0 && montoNum <= plan.max

  function solicitar() {
    if (!okMonto) {
      toast.error(`Este plan admite hasta ${formatARS(plan.max)}`)
      return
    }
    setSolicitado(true)
    toast.success(`Plan de ${plan.months} cuotas solicitado (demo)`)
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
          Financiá con Monix
        </h1>
        <p className="font-body text-sm text-slate-secondary mb-6">
          Elegí un plan, simulá tu cuota y pedilo en un toque
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
          {PLANES.map((p) => {
            const on = planId === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => { setPlanId(p.id); setSolicitado(false) }}
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                  on
                    ? 'border-mint bg-mint/10 ring-1 ring-mint/30'
                    : 'border-slate-200 dark:border-white/10 bg-white dark:bg-navy-card hover:border-mint/40'
                }`}
              >
                <p className="font-display text-lg font-bold text-navy dark:text-white">
                  {p.months} cuotas
                </p>
                <p className="font-body text-xs text-mint mt-0.5">
                  {p.tasa === 0 ? 'Sin interés' : `${p.tasa}% mensual`}
                </p>
                <p className="font-body text-xs text-slate-secondary mt-1">{p.desc}</p>
              </button>
            )
          })}
        </div>

        <Card className="p-5">
          <Input
            label="Monto a financiar"
            type="number"
            min="1"
            step="0.01"
            value={monto}
            onChange={(e) => { setMonto(e.target.value); setSolicitado(false) }}
          />
          <p className="font-body text-xs text-slate-secondary mt-2 mb-4">
            Tope del plan: {formatARS(plan.max)}
          </p>

          <AnimatePresence mode="wait">
            <motion.div
              key={`${plan.id}-${cuota}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-slate-input dark:bg-white/5 px-4 py-3 space-y-2 mb-4"
            >
              <div className="flex justify-between gap-3">
                <span className="font-body text-sm text-slate-secondary">Cuota estimada</span>
                <span className="font-display font-bold text-mint">{formatARS(cuota)}</span>
              </div>
              <div className="h-px bg-slate-200 dark:bg-white/10" />
              <div className="flex justify-between gap-3">
                <span className="font-body text-sm text-slate-secondary">Total a pagar</span>
                <span className="font-display font-semibold text-navy dark:text-white">
                  {formatARS(total)}
                </span>
              </div>
            </motion.div>
          </AnimatePresence>

          {!okMonto && montoNum > 0 && (
            <p className="font-body text-xs text-red-500 dark:text-red-400 mb-3">
              El monto supera el tope de este plan.
            </p>
          )}

          {solicitado ? (
            <div className="rounded-xl border border-mint/30 bg-mint/10 px-4 py-3 flex items-center gap-2 text-navy dark:text-white">
              <CheckCircle2 size={18} className="text-mint" />
              <span className="font-body text-sm">
                Solicitud enviada · {plan.months} cuotas de {formatARS(cuota)}
              </span>
            </div>
          ) : (
            <Button className="w-full" onClick={solicitar} disabled={!okMonto}>
              Solicitar este plan
            </Button>
          )}
        </Card>
      </div>
    </PageWrapper>
  )
}
