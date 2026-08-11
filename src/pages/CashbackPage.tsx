import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Fuel, ShoppingBag, Utensils, Wallet } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

const COMERCIOS = [
  { id: 'c1', name: 'mercadoMONIX', pct: 8, icon: ShoppingBag, cat: 'Marketplace' },
  { id: 'c2', name: 'Restós MONIX', pct: 3, icon: Utensils, cat: 'Gastronomía' },
  { id: 'c3', name: 'Estaciones Full', pct: 5, icon: Fuel, cat: 'Combustible' },
  { id: 'c4', name: 'Shoppings partners', pct: 4, icon: ShoppingBag, cat: 'Retail' },
]

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

export function CashbackPage() {
  const [selected, setSelected] = useState(COMERCIOS[0].id)
  const [monto, setMonto] = useState('25000')
  const [acumulado, setAcumulado] = useState(1840.5)

  const comercio = COMERCIOS.find((c) => c.id === selected) ?? COMERCIOS[0]
  const montoNum = parseFloat(monto) || 0
  const devolucion = useMemo(
    () => Math.round(((montoNum * comercio.pct) / 100) * 100) / 100,
    [montoNum, comercio.pct],
  )

  function simular() {
    if (montoNum <= 0) {
      toast.error('Ingresá un monto válido')
      return
    }
    setAcumulado((v) => Math.round((v + devolucion) * 100) / 100)
    toast.success(`Simulaste +${formatARS(devolucion)} de cashback`)
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
          Cashback
        </h1>
        <p className="font-body text-sm text-slate-secondary mb-6">
          Elegí un comercio, simulá una compra y mirá cuánto te devuelve
        </p>

        <Card className="p-5 mb-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-mint/15 text-mint flex items-center justify-center">
            <Wallet size={20} />
          </div>
          <div>
            <p className="font-body text-xs text-slate-secondary">Cashback acumulado (demo)</p>
            <p className="font-display text-2xl font-bold text-mint">{formatARS(acumulado)}</p>
          </div>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {COMERCIOS.map((m) => {
            const Icon = m.icon
            const on = selected === m.id
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelected(m.id)}
                className={`text-left rounded-xl border px-4 py-3 transition-colors ${
                  on
                    ? 'border-mint bg-mint/10 ring-1 ring-mint/30'
                    : 'border-slate-200 dark:border-white/10 bg-white dark:bg-navy-card hover:border-mint/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={on ? 'text-mint' : 'text-slate-secondary'} />
                  <div className="min-w-0 flex-1">
                    <p className="font-body font-medium text-navy dark:text-white text-sm">{m.name}</p>
                    <p className="font-body text-xs text-slate-secondary">{m.cat}</p>
                  </div>
                  <span className="font-display font-bold text-mint text-sm">{m.pct}%</span>
                </div>
              </button>
            )
          })}
        </div>

        <Card className="p-5">
          <p className="font-display font-semibold text-navy dark:text-white mb-3">
            Simulá tu devolución
          </p>
          <Input
            label={`Monto de compra en ${comercio.name}`}
            type="number"
            min="1"
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={`${comercio.id}-${devolucion}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mt-4 rounded-xl bg-slate-input dark:bg-white/5 px-4 py-3 flex items-center justify-between"
            >
              <span className="font-body text-sm text-slate-secondary">Te devolverían</span>
              <span className="font-display text-lg font-bold text-mint">{formatARS(devolucion)}</span>
            </motion.div>
          </AnimatePresence>

          <Button className="w-full mt-4" onClick={simular}>
            Sumar a mi cashback demo
          </Button>
        </Card>
      </div>
    </PageWrapper>
  )
}
