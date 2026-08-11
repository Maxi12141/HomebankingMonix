import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRightLeft, History, Plus, Eye, EyeOff, Copy, Check, TrendingUp, Receipt } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import CountUp from 'react-countup'
import { useAuthStore } from '../store/authStore'
import { useCuenta } from '../hooks/useCuenta'
import { useMovimientos } from '../hooks/useMovimientos'
import { useBankNames } from '../hooks/useBankNames'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { WelcomeBonusModal } from '../components/WelcomeBonusModal'
import { OnboardingTour } from '../components/OnboardingTour'
import { TransactionDetailModal } from '../components/TransactionDetailModal'
import { ReservasHomeCard } from '../components/ReservasHomeCard'
import { AdBanner } from '../components/ui/AdBanner'
import { estimacionDiaria } from '../hooks/useReserva'
import type { TourStep } from '../components/OnboardingTour'
import type { Movimiento } from '../types'

function formatMonto(monto: number, tipo: string) {
  const esEntrada = tipo === 'deposito' || tipo === 'transferencia_entrada'
  const formatted = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(monto)
  return { text: `${esEntrada ? '+' : '-'}${formatted}`, esEntrada }
}

const tipoLabel: Record<string, string> = {
  deposito: 'Depósito',
  extraccion: 'Extracción',
  transferencia_entrada: 'Transferencia recibida',
  transferencia_salida: 'Transferencia enviada',
}

const TOUR_STEPS: TourStep[] = [
  {
    targetId: 'tour-saldo',
    title: 'Tu saldo disponible',
    description: 'El saldo de tu cuenta se actualiza automáticamente con cada transferencia recibida o enviada.',
  },
  {
    targetId: 'tour-acciones',
    title: 'Acciones rápidas',
    description: 'Enviá dinero, pagá suscripciones, revisá el historial o acreditá fondos desde acá.',
  },
  {
    targetId: 'tour-reservas',
    title: 'Reservas',
    description: 'Separá plata de tu saldo disponible y hacé rendir tu ahorro con interés diario.',
  },
  {
    targetId: 'tour-movimientos',
    title: 'Últimos movimientos',
    description: 'Tus operaciones más recientes al instante. Tocá cualquiera para ver el comprobante completo.',
  },
  {
    targetId: 'tour-menu',
    title: 'Menú de navegación',
    description: 'Accedé a contactos, perfil, historial y todas las secciones de tu cuenta desde el menú lateral.',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { persona, user } = useAuthStore()
  const { cuenta, interesHoy } = useCuenta()
  const { movimientos, loading: loadingMov } = useMovimientos(5)
  const bankNames = useBankNames(movimientos)

  const [showWelcome, setShowWelcome] = useState(false)
  const [selectedMovimiento, setSelectedMovimiento] = useState<Movimiento | null>(null)
  const [showTour, setShowTour] = useState(false)
  const [showData, setShowData] = useState(false)
  const [copiedCbu, setCopiedCbu] = useState(false)
  const [copiedAlias, setCopiedAlias] = useState(false)

  const saldo = cuenta?.saldo ?? 0
  const tasaSaldo = Number(cuenta?.tasa_anual ?? 32)
  const rendimientoDiario = estimacionDiaria(saldo, tasaSaldo)
  const prevSaldoRef = useRef<number>(0)
  const [countStart, setCountStart] = useState(0)
  const [animKey, setAnimKey] = useState(0)
  const [delta, setDelta] = useState<number | null>(null)
  const deltaTimerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (saldo === prevSaldoRef.current) return
    const prev = prevSaldoRef.current
    if (prev !== 0) {
      const d = saldo - prev
      setDelta(d)
      clearTimeout(deltaTimerRef.current)
      deltaTimerRef.current = setTimeout(() => setDelta(null), 2500)
    }
    setCountStart(prev)
    setAnimKey(k => k + 1)
    prevSaldoRef.current = saldo
  }, [saldo])

  useEffect(() => () => clearTimeout(deltaTimerRef.current), [])

  useEffect(() => {
    if (!user) return
    if (localStorage.getItem('monix_new_user') === '1') {
      localStorage.removeItem('monix_new_user')
      setShowWelcome(true)
    }
  }, [user])

  function handleCopy(text: string, field: 'cbu' | 'alias') {
    navigator.clipboard.writeText(text)
    if (field === 'cbu') {
      setCopiedCbu(true)
      setTimeout(() => setCopiedCbu(false), 2000)
    } else {
      setCopiedAlias(true)
      setTimeout(() => setCopiedAlias(false), 2000)
    }
  }

  function handleWelcomeClose() {
    setShowWelcome(false)
    setTimeout(() => setShowTour(true), 450)
  }

  function handleTourComplete() {
    setShowTour(false)
  }

  return (
    <PageWrapper>
      <motion.div
        className="max-w-2xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.h1
          variants={itemVariants}
          className="font-display text-2xl font-semibold text-navy dark:text-white mb-6"
        >
          Hola, {persona?.nombre ?? ''}
        </motion.h1>

        {/* Saldo principal */}
        <motion.div variants={itemVariants} id="tour-saldo">
          <Card className="p-8 mb-6">
            <p className="font-body text-sm text-slate-secondary mb-2">Saldo disponible</p>
            <p className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-mint leading-none min-w-0">
              <CountUp
                key={animKey}
                start={countStart}
                end={saldo}
                duration={1.4}
                decimals={2}
                decimal=","
                separator="."
                prefix="$ "
                useEasing={true}
              />
            </p>
            <AnimatePresence>
              {delta !== null && (
                <motion.p
                  key="delta"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3 }}
                  className={`font-body text-sm font-medium mt-1 mb-2 ${delta > 0 ? 'text-mint' : 'text-red-500 dark:text-red-400'}`}
                >
                  {delta > 0 ? '+' : ''}{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(delta)}
                  {delta > 0 ? ' recibido' : ' enviado'}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
              <p className="font-body text-xs text-slate-secondary">
                TNA <span className="text-navy dark:text-white font-medium">{tasaSaldo.toFixed(2)}%</span>
              </p>
              <p className="font-body text-xs text-slate-secondary">
                Hoy ~{' '}
                <span className="text-navy dark:text-white font-medium">
                  +{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(rendimientoDiario)}
                </span>
              </p>
              {interesHoy > 0 && (
                <p className="font-body text-xs text-mint inline-flex items-center gap-1">
                  <TrendingUp size={12} />
                  +{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(interesHoy)} acreditados
                </p>
              )}
            </div>

            <p className="font-body text-sm text-slate-secondary mt-3">
              Cuenta N° {cuenta?.numero_cuenta ?? '—'} · {cuenta?.tipo === 'caja_ahorro' ? 'Caja de Ahorro' : 'Cuenta Corriente'}
            </p>

            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/10 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="font-body text-xs text-slate-secondary">CBU</span>
                <span className="font-body text-xs font-medium text-navy dark:text-white font-mono">
                  {showData ? (cuenta?.cbu ?? '—') : '•••••••••••••••••••••'}
                </span>
                <button onClick={() => handleCopy(cuenta?.cbu ?? '', 'cbu')} className="text-slate-secondary hover:text-navy dark:hover:text-white transition-colors" aria-label="Copiar CBU">
                  {copiedCbu ? <Check size={13} className="text-mint" /> : <Copy size={13} />}
                </button>
              </div>

              <span className="text-slate-200 dark:text-white/10 select-none">|</span>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="font-body text-xs text-slate-secondary">Alias</span>
                <span className="font-body text-xs font-medium text-navy dark:text-white">
                  {showData ? (cuenta?.alias ?? '—') : '••••••••••••••'}
                </span>
                <button onClick={() => handleCopy(cuenta?.alias ?? '', 'alias')} className="text-slate-secondary hover:text-navy dark:hover:text-white transition-colors" aria-label="Copiar Alias">
                  {copiedAlias ? <Check size={13} className="text-mint" /> : <Copy size={13} />}
                </button>
              </div>

              <button
                onClick={() => setShowData(v => !v)}
                className="ml-auto text-slate-secondary hover:text-navy dark:hover:text-white transition-colors"
                aria-label={showData ? 'Ocultar datos' : 'Mostrar datos'}
              >
                {showData ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </Card>
        </motion.div>

        {/* Acciones rápidas */}
        <motion.div variants={itemVariants} id="tour-acciones" className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <Button variant="primary" className="flex flex-col items-center gap-2 py-4" onClick={() => navigate('/transferir')}>
            <ArrowRightLeft size={20} />
            <span className="text-sm">Transferir</span>
          </Button>
          <Button variant="secondary" className="flex flex-col items-center gap-2 py-4" onClick={() => navigate('/pagar')}>
            <Receipt size={20} />
            <span className="text-sm">Pagar</span>
          </Button>
          <Button variant="secondary" className="flex flex-col items-center gap-2 py-4" onClick={() => navigate('/historial')}>
            <History size={20} />
            <span className="text-sm">Historial</span>
          </Button>
          <Button variant="secondary" className="flex flex-col items-center gap-2 py-4" onClick={() => navigate('/depositar')}>
            <Plus size={20} />
            <span className="text-sm">Depositar</span>
          </Button>
        </motion.div>

        <motion.div variants={itemVariants}>
          <ReservasHomeCard cuentaId={cuenta?.id} />
        </motion.div>

        <motion.div variants={itemVariants} className="mb-8">
          <AdBanner />
        </motion.div>

        {/* Últimos movimientos */}
        <motion.div variants={itemVariants} id="tour-movimientos">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-navy dark:text-white">Últimos movimientos</h2>
            <button onClick={() => navigate('/historial')} className="text-sm font-body text-mint hover:text-mint-hover transition-colors">
              Ver todos
            </button>
          </div>

          {loadingMov ? (
            <div className="text-center py-8 text-slate-secondary font-body text-sm">Cargando...</div>
          ) : movimientos.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="font-body text-slate-secondary text-sm">Todavía no tenés movimientos</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {movimientos.map((mov, i) => {
                const { text, esEntrada } = formatMonto(mov.monto, mov.tipo)
                return (
                  <motion.div
                    key={mov.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.06 }}
                  >
                    <Card
                      className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-navy/5 dark:hover:bg-white/5 transition-colors"
                      onClick={() => setSelectedMovimiento(mov)}
                    >
                      <div>
                        <p className="font-body font-medium text-navy dark:text-white text-sm">{tipoLabel[mov.tipo]}</p>
                        {mov.descripcion && (
                          <p className="font-body text-xs text-slate-secondary mt-0.5">
                            {mov.descripcion.includes('|') ? mov.descripcion.split('|')[0] : mov.descripcion}
                          </p>
                        )}
                        <p className="font-body text-xs text-slate-secondary mt-0.5">
                          {new Date(mov.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </p>
                      </div>
                      <span className={`font-display font-semibold text-base ${esEntrada ? 'text-mint' : 'text-red-500 dark:text-red-400'}`}>
                        {text}
                      </span>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          )}
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {showWelcome && <WelcomeBonusModal key="welcome" onClose={handleWelcomeClose} />}
        {showTour && <OnboardingTour key="tour" steps={TOUR_STEPS} onComplete={handleTourComplete} />}
      </AnimatePresence>

      <TransactionDetailModal
        movimiento={selectedMovimiento}
        bankName={
          selectedMovimiento?.banco_codigo_origen != null
            ? bankNames[selectedMovimiento.banco_codigo_origen]
            : undefined
        }
        onClose={() => setSelectedMovimiento(null)}
      />
    </PageWrapper>
  )
}
