import { useMemo, useState } from 'react'
import { CheckCircle, Receipt } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import { useCuenta } from '../hooks/useCuenta'
import { useCuentaStore } from '../store/cuentaStore'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

type Step = 'lista' | 'confirmar' | 'success'

interface Servicio {
  id: string
  nombre: string
  plan: string
  precio: number
  color: string
  inicial: string
}

const SERVICIOS: Servicio[] = [
  { id: 'spotify', nombre: 'Spotify', plan: 'Premium Individual', precio: 2499, color: '#1DB954', inicial: 'S' },
  { id: 'youtube', nombre: 'YouTube', plan: 'Premium Individual', precio: 1899, color: '#FF0033', inicial: 'Y' },
  { id: 'netflix', nombre: 'Netflix', plan: 'Estándar', precio: 6299, color: '#E50914', inicial: 'N' },
  { id: 'disney', nombre: 'Disney+', plan: 'Estándar', precio: 4499, color: '#113CCF', inicial: 'D' },
  { id: 'prime', nombre: 'Prime Video', plan: 'Mensual', precio: 3199, color: '#00A8E1', inicial: 'P' },
  { id: 'hbo', nombre: 'Max', plan: 'Con anuncios', precio: 3999, color: '#002BE7', inicial: 'M' },
  { id: 'apple', nombre: 'Apple Music', plan: 'Individual', precio: 2299, color: '#FC3C44', inicial: 'A' },
  { id: 'xbox', nombre: 'Xbox Game Pass', plan: 'Ultimate', precio: 8999, color: '#107C10', inicial: 'X' },
]

const stepVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, y: -16, transition: { duration: 0.2 } },
}

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

function roundMoney(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function PagarPage() {
  const { cuenta, refreshCuenta } = useCuenta()
  const { updateSaldo } = useCuentaStore()

  const [step, setStep] = useState<Step>('lista')
  const [servicio, setServicio] = useState<Servicio | null>(null)
  const [pagados, setPagados] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Catálogo fresco al entrar a la página; los pagos de esta visita se ocultan hasta salir y volver
  const disponibles = useMemo(
    () => SERVICIOS.filter((s) => !pagados.includes(s.id)),
    [pagados],
  )

  function elegir(s: Servicio) {
    setServicio(s)
    setError('')
    setStep('confirmar')
  }

  async function confirmarPago() {
    if (!cuenta || !servicio) return
    if (servicio.precio > cuenta.saldo) {
      setError('No tenés saldo suficiente para este pago')
      return
    }

    setLoading(true)
    setError('')

    try {
      const nuevoSaldo = roundMoney(cuenta.saldo - servicio.precio)

      const { error: errSaldo } = await supabase
        .from('cuentas')
        .update({ saldo: nuevoSaldo })
        .eq('id', cuenta.id)
      if (errSaldo) throw new Error('No se pudo descontar el saldo')

      const { error: errMov } = await supabase.from('movimientos').insert({
        cuenta_id: cuenta.id,
        tipo: 'extraccion',
        monto: servicio.precio,
        saldo_resultante: nuevoSaldo,
        descripcion: `Pago|${servicio.nombre} ${servicio.plan}`,
      })
      if (errMov) throw new Error('No se pudo registrar el pago')

      updateSaldo(nuevoSaldo)
      await refreshCuenta()
      setPagados((prev) => (prev.includes(servicio.id) ? prev : [...prev, servicio.id]))
      setStep('success')
      toast.success(`Pagaste ${servicio.nombre}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo completar el pago'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setStep('lista')
    setServicio(null)
    setError('')
  }

  return (
    <PageWrapper>
      <div className="max-w-md mx-auto">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold text-navy dark:text-white">
            Pagar
          </h1>
          <p className="font-body text-sm text-slate-secondary mt-1">
            Suscripciones y servicios digitales
          </p>
          <p className="font-body text-xs text-slate-secondary mt-2">
            Saldo disponible:{' '}
            <span className="text-mint font-medium">{formatARS(cuenta?.saldo ?? 0)}</span>
          </p>
        </div>

        <AnimatePresence mode="wait">
          {step === 'lista' && (
            <motion.div key="lista" variants={stepVariants} initial="initial" animate="animate" exit="exit">
              {disponibles.length === 0 ? (
                <Card className="p-8 text-center">
                  <CheckCircle size={40} className="text-mint mx-auto mb-3" />
                  <p className="font-display font-semibold text-navy dark:text-white mb-1">
                    Ya pagaste todos los servicios
                  </p>
                  <p className="font-body text-sm text-slate-secondary">
                    Salí de esta pantalla y volvé a entrar para cargarlos de nuevo (demo local).
                  </p>
                </Card>
              ) : (
                <div className="flex flex-col gap-2">
                  {disponibles.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => elegir(s)}
                      className="text-left"
                    >
                      <Card className="px-4 py-3.5 flex items-center gap-3 hover:bg-navy/5 dark:hover:bg-white/5 transition-colors">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-display font-bold text-white text-base"
                          style={{ backgroundColor: s.color }}
                        >
                          {s.inicial}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-body font-medium text-navy dark:text-white text-sm">
                            {s.nombre}
                          </p>
                          <p className="font-body text-xs text-slate-secondary truncate">
                            {s.plan}
                          </p>
                        </div>
                        <p className="font-display text-sm font-semibold text-navy dark:text-white shrink-0">
                          {formatARS(s.precio)}
                        </p>
                      </Card>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {step === 'confirmar' && servicio && (
            <motion.div key="confirmar" variants={stepVariants} initial="initial" animate="animate" exit="exit">
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-bold text-white text-lg"
                    style={{ backgroundColor: servicio.color }}
                  >
                    {servicio.inicial}
                  </div>
                  <div>
                    <p className="font-display font-semibold text-navy dark:text-white">
                      {servicio.nombre}
                    </p>
                    <p className="font-body text-xs text-slate-secondary">{servicio.plan}</p>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-input dark:bg-white/5 px-4 py-3 mb-4 space-y-2">
                  <div className="flex justify-between gap-3">
                    <span className="font-body text-sm text-slate-secondary">Importe</span>
                    <span className="font-display text-sm font-semibold text-navy dark:text-white">
                      {formatARS(servicio.precio)}
                    </span>
                  </div>
                  <div className="h-px bg-slate-200 dark:bg-white/10" />
                  <div className="flex justify-between gap-3">
                    <span className="font-body text-sm text-slate-secondary">Saldo después</span>
                    <span className="font-display text-sm font-semibold text-mint">
                      {formatARS(roundMoney((cuenta?.saldo ?? 0) - servicio.precio))}
                    </span>
                  </div>
                </div>

                <p className="font-body text-xs text-slate-secondary mb-4 flex items-start gap-1.5">
                  <Receipt size={13} className="mt-0.5 shrink-0" />
                  Se descuenta de tu saldo disponible y queda registrado en el historial.
                </p>

                {error && (
                  <p className="text-sm text-red-500 dark:text-red-400 font-body bg-red-50 dark:bg-red-400/10 rounded-xl px-4 py-3 mb-4">
                    {error}
                  </p>
                )}

                <div className="flex gap-3">
                  <Button variant="secondary" className="flex-1" type="button" onClick={reset} disabled={loading}>
                    Cancelar
                  </Button>
                  <Button className="flex-1" type="button" loading={loading} onClick={confirmarPago}>
                    Confirmar pago
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {step === 'success' && servicio && (
            <motion.div key="success" variants={stepVariants} initial="initial" animate="animate" exit="exit">
              <Card className="p-8 text-center">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <CheckCircle size={56} className="text-mint mx-auto mb-4" />
                </motion.div>
                <h2 className="font-display text-xl font-semibold text-navy dark:text-white mb-2">
                  ¡Pago exitoso!
                </h2>
                <p className="font-body text-slate-secondary mb-1">
                  Pagaste {servicio.nombre} · {servicio.plan}
                </p>
                <p className="font-display text-lg font-bold text-mint mb-6">
                  {formatARS(servicio.precio)}
                </p>
                <Button className="w-full" onClick={reset}>
                  Pagar otro servicio
                </Button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageWrapper>
  )
}
