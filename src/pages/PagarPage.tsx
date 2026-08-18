import { useMemo, useState, type ReactNode } from 'react'
import { CheckCircle, Gamepad2, Receipt } from 'lucide-react'
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
  icon: ReactNode
}

/** Ícono de marca — un solo path vectorial en blanco sobre el círculo de color del servicio. */
function BrandIcon({ d, viewBox = '0 0 24 24' }: { d: string; viewBox?: string }) {
  return (
    <svg viewBox={viewBox} className="w-6 h-6" fill="white" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

const SERVICIOS: Servicio[] = [
  {
    id: 'spotify', nombre: 'Spotify', plan: 'Premium Individual', precio: 2499, color: '#1DB954',
    icon: <BrandIcon d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />,
  },
  {
    id: 'youtube', nombre: 'YouTube', plan: 'Premium Individual', precio: 1899, color: '#FF0033',
    icon: <BrandIcon d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />,
  },
  {
    id: 'netflix', nombre: 'Netflix', plan: 'Estándar', precio: 6299, color: '#E50914',
    icon: <BrandIcon d="m5.398 0 8.348 23.602c2.346.059 4.856.398 4.856.398L10.113 0H5.398zm8.489 0v9.172l4.715 13.33V0h-4.715zM5.398 1.5V24c1.873-.225 2.81-.312 4.715-.398V14.83L5.398 1.5z" />,
  },
  {
    id: 'disney', nombre: 'Disney+', plan: 'Estándar', precio: 4499, color: '#113CCF',
    icon: <BrandIcon d="M4 3h3a8 8 0 0 1 0 16H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM17 2h2v3.5h3.5v2H19V11h-2V7.5h-3.5v-2H17V2z" />,
  },
  {
    id: 'prime', nombre: 'Prime Video', plan: 'Mensual', precio: 3199, color: '#00A8E1',
    icon: <BrandIcon d="M8 5l11 7-11 7V5zM2.5 16.5c5.2 3.6 13.8 3.6 19 0-.5 1.2-1.3 2.3-2.3 3.1-4.6 2.4-9.8 2.4-14.4 0a9 9 0 0 1-2.3-3.1z" />,
  },
  {
    id: 'hbo', nombre: 'Max', plan: 'Con anuncios', precio: 3999, color: '#002BE7',
    icon: <BrandIcon d="M3.784 8.716c-.655 0-1.32.29-2.173.946v-.78H0v6.236h1.715V11.24c.749-.592 1.091-.78 1.372-.78.333 0 .551.209.551.729v3.928h1.715V11.23c.748-.582 1.081-.769 1.372-.769.333 0 .55.208.55.728v3.928H8.99v-4.53c0-1.403-.8-1.871-1.57-1.871-.654 0-1.32.27-2.192.936-.28-.697-.894-.936-1.444-.936zm8.689 0c-1.705 0-3.118 1.466-3.118 3.284 0 1.82 1.413 3.285 3.118 3.285.842 0 1.57-.312 2.131-.988v.82h1.632V8.883h-1.632v.822c-.561-.676-1.29-.988-2.131-.988zm4.064.166c.707 1.102 1.507 2.09 2.443 3.077a26.593 26.593 0 0 0-2.443 3.16h2.069a13.603 13.603 0 0 1 1.673-2.183 14.067 14.067 0 0 1 1.632 2.182H24a25.142 25.142 0 0 0-2.432-3.16A23.918 23.918 0 0 0 24 8.883h-2.047a14.65 14.65 0 0 1-1.674 2.11 13.357 13.357 0 0 1-1.674-2.11zm-3.804 1.279c1.018 0 1.84.82 1.84 1.84a1.837 1.837 0 0 1-1.84 1.839c-1.019 0-1.84-.82-1.84-1.84 0-1.018.821-1.84 1.84-1.84zm0 .415c-.78 0-1.414.633-1.414 1.423s.634 1.424 1.413 1.424c.78 0 1.414-.634 1.414-1.424s-.634-1.424-1.414-1.424z" />,
  },
  {
    id: 'apple', nombre: 'Apple Music', plan: 'Individual', precio: 2299, color: '#FC3C44',
    icon: <BrandIcon d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.801.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 001.57-.1c.822-.106 1.596-.35 2.295-.81a5.046 5.046 0 001.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.045-1.773-.6-1.943-1.536a1.88 1.88 0 011.038-2.022c.323-.16.67-.25 1.018-.324.378-.082.758-.153 1.134-.24.274-.063.457-.23.51-.516a.904.904 0 00.02-.193c0-1.815 0-3.63-.002-5.443a.725.725 0 00-.026-.185c-.04-.15-.15-.243-.304-.234-.16.01-.318.035-.475.066-.76.15-1.52.303-2.28.456l-2.325.47-1.374.278c-.016.003-.032.01-.048.013-.277.077-.377.203-.39.49-.002.042 0 .086 0 .13-.002 2.602 0 5.204-.003 7.805 0 .42-.047.836-.215 1.227-.278.64-.77 1.04-1.434 1.233-.35.1-.71.16-1.075.172-.96.036-1.755-.6-1.92-1.544-.14-.812.23-1.685 1.154-2.075.357-.15.73-.232 1.108-.31.287-.06.575-.116.86-.177.383-.083.583-.323.6-.714v-.15c0-2.96 0-5.922.002-8.882 0-.123.013-.25.042-.37.07-.285.273-.448.546-.518.255-.066.515-.112.774-.165.733-.15 1.466-.296 2.2-.444l2.27-.46c.67-.134 1.34-.27 2.01-.403.22-.043.442-.088.663-.106.31-.025.523.17.554.482.008.073.012.148.012.223.002 1.91.002 3.822 0 5.732z" />,
  },
  {
    id: 'xbox', nombre: 'Xbox Game Pass', plan: 'Ultimate', precio: 8999, color: '#107C10',
    icon: <Gamepad2 className="w-6 h-6 text-white" strokeWidth={2} />,
  },
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
                          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: s.color }}
                        >
                          {s.icon}
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
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: servicio.color }}
                  >
                    {servicio.icon}
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
