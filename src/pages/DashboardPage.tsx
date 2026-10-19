import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRightLeft, History, Plus, Eye, EyeOff, Copy, Check, TrendingUp, ChevronLeft, ChevronRight, QrCode, Share2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import CountUp from 'react-countup'
import { EASE_MONIX, DURACION } from '../lib/motion'
import { useAuthStore, SALDO_ANIMADO_KEY } from '../store/authStore'
import { compartirTexto, textoDatosCuenta } from '../utils/compartir'
import { useCuenta } from '../hooks/useCuenta'
import { useMovimientos } from '../hooks/useMovimientos'
import { useBankNames } from '../hooks/useBankNames'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Skeleton, MovimientosSkeleton } from '../components/ui/Skeleton'
import { useCuentaStore } from '../store/cuentaStore'
import { Button } from '../components/ui/Button'
import { WelcomeBonusModal } from '../components/WelcomeBonusModal'
import { OnboardingTour } from '../components/OnboardingTour'
import { TransactionDetailModal } from '../components/TransactionDetailModal'
import { ReservasHomeCard } from '../components/ReservasHomeCard'
import { AdBanner } from '../components/ui/AdBanner'
import { estimacionDiaria } from '../hooks/useReserva'
import { formatMonto as formatMoneda } from '../utils/cuenta'
import type { TourStep } from '../components/OnboardingTour'
import type { Movimiento, Cuenta } from '../types'
import { esCelular } from '../lib/biometria'
import { useQrScanStore } from '../stores/qrScanStore'
import {
  completarBienvenida,
  completarTour,
  hayBienvenidaPendiente,
  hayTourPendiente,
  limpiarClavesViejas,
} from '../lib/onboarding'
import { Monto } from '../components/ui/Monto'

function formatMonto(monto: number, tipo: string, moneda: 'ARS' | 'USD') {
  const esEntrada = tipo === 'deposito' || tipo === 'transferencia_entrada'
  return { text: `${esEntrada ? '+' : '-'}${formatMoneda(monto, moneda)}`, esEntrada }
}

const tipoLabel: Record<string, string> = {
  deposito: 'Depósito',
  extraccion: 'Extracción',
  transferencia_entrada: 'Transferencia recibida',
  transferencia_salida: 'Transferencia enviada',
}

const TOUR_DESKTOP: TourStep[] = [
  {
    targetId: 'tour-saldo',
    title: 'Tu saldo',
    description: 'Acá ves cuánta plata tenés. Se actualiza solo con cada transferencia, depósito o pago.',
  },
  {
    targetId: 'tour-acciones',
    title: 'Atajos del día a día',
    description: 'Transferir, QR, historial y depositar. Lo más usado, a un toque.',
  },
  {
    targetId: 'tour-reservas',
    title: 'Reservas',
    description: 'Separá plata de tu saldo y hacela rendir con interés diario.',
  },
  {
    targetId: 'tour-movimientos',
    title: 'Tus movimientos',
    description: 'Las últimas operaciones. Tocá cualquiera para ver el comprobante.',
  },
  {
    targetId: 'tour-drawer-intro',
    title: 'El menú',
    description: 'Cuentas, dólares, tarjetas, préstamos y tu perfil. Todo el banco está acá; no hace falta que lo recorras ahora.',
    openDrawer: true,
  },
]

const TOUR_MOBILE: TourStep[] = [
  {
    targetId: 'tour-saldo',
    title: 'Tu saldo',
    description: 'Acá ves cuánta plata tenés. Se actualiza solo con cada transferencia, depósito o pago.',
  },
  {
    targetId: 'tour-acciones-mobile',
    title: 'La barra de abajo',
    description: 'Inicio, transferir, cuentas y reservas. El botón del centro abre la cámara para pagar con QR.',
    // El botón QR flota por encima de la barra (-top-7 en Navbar.tsx) — sin
    // este margen extra el spotlight lo corta a la mitad.
    padTop: 24,
  },
  {
    targetId: 'tour-reservas',
    title: 'Reservas',
    description: 'Separá plata de tu saldo y hacela rendir con interés diario.',
  },
  {
    targetId: 'tour-movimientos',
    title: 'Tus movimientos',
    description: 'Las últimas operaciones. Tocá cualquiera para ver el comprobante.',
  },
  {
    targetId: 'tour-drawer-intro',
    title: 'El menú',
    description: 'Desde acá entras a cuentas, dólares, tarjetas, préstamos y tu perfil. Un vistazo alcanza: el resto lo vas a ir usando cuando lo necesites.',
    openDrawer: true,
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

const MOSTRAR_SALDO_KEY = 'monix_mostrar_saldo'

function SaldoCard({ cuenta, interesHoy, titulo }: { cuenta: Cuenta; interesHoy: number; titulo: string }) {
  const persona = useAuthStore((s) => s.persona)
  const isUSD = cuenta.moneda === 'USD'
  const tasa = Number(cuenta.tasa_anual ?? 32)
  const rendimientoDiario = estimacionDiaria(cuenta.saldo, tasa)

  const [showData, setShowData] = useState(() => localStorage.getItem(MOSTRAR_SALDO_KEY) === '1')
  const [copiedCbu, setCopiedCbu] = useState(false)
  const [copiedAlias, setCopiedAlias] = useState(false)
  // Después de la primera vez en la sesión, el saldo aparece directo (sin contar
  // desde 0) al cambiar de card o volver al Dashboard.
  const [yaAnimado] = useState(() => sessionStorage.getItem(SALDO_ANIMADO_KEY) === '1')
  const prevSaldoRef = useRef<number>(yaAnimado ? cuenta.saldo : 0)
  const [countStart, setCountStart] = useState(yaAnimado ? cuenta.saldo : 0)
  const [animKey, setAnimKey] = useState(0)
  const [delta, setDelta] = useState<number | null>(null)
  const deltaTimerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (cuenta.saldo === prevSaldoRef.current) return
    const prev = prevSaldoRef.current
    if (prev === 0) sessionStorage.setItem(SALDO_ANIMADO_KEY, '1')
    else {
      const d = cuenta.saldo - prev
      setDelta(d)
      clearTimeout(deltaTimerRef.current)
      deltaTimerRef.current = setTimeout(() => setDelta(null), 2500)
    }
    setCountStart(prev)
    setAnimKey((k) => k + 1)
    prevSaldoRef.current = cuenta.saldo
  }, [cuenta.saldo])

  useEffect(() => () => clearTimeout(deltaTimerRef.current), [])

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

  return (
    <Card className="p-8">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="font-body text-sm text-slate-secondary">{titulo}</p>
        <button
          onClick={() => setShowData((v) => {
            const next = !v
            localStorage.setItem(MOSTRAR_SALDO_KEY, next ? '1' : '0')
            return next
          })}
          className="text-slate-secondary hover:text-navy dark:hover:text-white transition-colors shrink-0"
          aria-label={showData ? 'Ocultar saldo' : 'Mostrar saldo'}
        >
          {showData ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <Monto as="p" tamaño="grande" className="font-display text-3xl sm:text-4xl md:text-5xl font-bold leading-none min-w-0">
        {showData ? (
          <CountUp
            key={animKey}
            start={countStart}
            end={cuenta.saldo}
            duration={DURACION.contar}
            decimals={2}
            decimal={isUSD ? '.' : ','}
            separator={isUSD ? ',' : '.'}
            prefix={isUSD ? 'US$' : '$ '}
            useEasing={true}
          />
        ) : (
          <span>{isUSD ? 'US$' : '$ '}••••••</span>
        )}
      </Monto>
      <AnimatePresence>
        {delta !== null && (
          <motion.p
            key="delta"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className={`font-body text-sm font-medium mt-1 mb-2 ${delta > 0 ? 'text-mint-tinta-fuerte dark:text-mint' : 'text-red-600 dark:text-red-400'}`}
          >
            {showData ? (
              <>{delta > 0 ? '+' : ''}{formatMoneda(delta, cuenta.moneda)}</>
            ) : (
              <>{delta > 0 ? '+' : '-'}••••</>
            )}
            {delta > 0 ? ' recibido' : ' enviado'}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
        <p className="font-body text-xs text-slate-secondary">
          TNA <span className="text-navy dark:text-white font-medium">{tasa.toFixed(2)}%</span>
        </p>
        <p className="font-body text-xs text-slate-secondary">
          Hoy ~{' '}
          <span className="text-navy dark:text-white font-medium">
            +{showData ? formatMoneda(rendimientoDiario, cuenta.moneda) : '••••'}
          </span>
        </p>
        {interesHoy > 0 && (
          <Monto as="p" tamaño="chico" className="font-body text-xs inline-flex items-center gap-1">
            <TrendingUp size={12} />
            +{showData ? formatMoneda(interesHoy, cuenta.moneda) : '••••'} acreditados
          </Monto>
        )}
      </div>

      <p className="font-body text-sm text-slate-secondary mt-3">
        Cuenta N° {cuenta.numero_cuenta ?? '—'} · {cuenta.tipo === 'caja_ahorro' ? 'Caja de Ahorro' : 'Cuenta Corriente'}
      </p>

      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/10 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-body text-xs text-slate-secondary">CBU</span>
          <span className="font-body text-xs font-medium text-navy dark:text-white font-mono">
            {showData ? (cuenta.cbu ?? '—') : '•••••••••••••••••••••'}
          </span>
          <button onClick={() => handleCopy(cuenta.cbu ?? '', 'cbu')} className="text-slate-secondary hover:text-navy dark:hover:text-white transition-colors" aria-label="Copiar CBU">
            {copiedCbu ? <Check size={13} className="text-navy dark:text-mint" /> : <Copy size={13} />}
          </button>
        </div>

        <span className="text-slate-200 dark:text-white/10 select-none">|</span>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-body text-xs text-slate-secondary">Alias</span>
          <span className="font-body text-xs font-medium text-navy dark:text-white">
            {showData ? (cuenta.alias ?? '—') : '••••••••••••••'}
          </span>
          <button onClick={() => handleCopy(cuenta.alias ?? '', 'alias')} className="text-slate-secondary hover:text-navy dark:hover:text-white transition-colors" aria-label="Copiar Alias">
            {copiedAlias ? <Check size={13} className="text-navy dark:text-mint" /> : <Copy size={13} />}
          </button>
        </div>

        {cuenta.cbu && (
          <button
            type="button"
            onClick={() => {
              void compartirTexto({ titulo: 'Mis datos de Monix', texto: textoDatosCuenta(cuenta, persona) })
            }}
            className="ml-auto inline-flex items-center gap-1.5 font-body text-xs font-medium text-navy dark:text-mint hover:text-navy/70 dark:hover:text-mint-hover transition-colors"
            aria-label="Compartir mis datos"
          >
            <Share2 size={13} />
            Compartir
          </button>
        )}
      </div>
    </Card>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { persona, user } = useAuthStore()
  const { cuenta, cuentas, interesHoyPorCuenta } = useCuenta()
  const { movimientos, loading: loadingMov } = useMovimientos(5)
  const cuentasLoaded = useCuentaStore((st) => st.cuentasLoaded)
  const bankNames = useBankNames(movimientos)

  const [showWelcome, setShowWelcome] = useState(false)
  const [selectedMovimiento, setSelectedMovimiento] = useState<Movimiento | null>(null)
  const [showTour, setShowTour] = useState(false)
  const [monedaActiva, setMonedaActiva] = useState<'ARS' | 'USD'>('ARS')
  const [direction, setDirection] = useState(1)

  const cuentaUSD = cuentas.find((c) => c.moneda === 'USD')
  const cuentaMostrada = monedaActiva === 'USD' && cuentaUSD ? cuentaUSD : cuenta

  function toggleCuenta(dir: 1 | -1) {
    setDirection(dir)
    setMonedaActiva((m) => (m === 'ARS' ? 'USD' : 'ARS'))
  }

  useEffect(() => {
    if (!user) return
    limpiarClavesViejas()
    if (hayBienvenidaPendiente(user.id)) setShowWelcome(true)
    else if (hayTourPendiente(user.id)) setShowTour(true)
  }, [user])

  function handleWelcomeClose() {
    if (user) completarBienvenida(user.id)
    setShowWelcome(false)
    setTimeout(() => setShowTour(true), 450)
  }

  function handleTourComplete() {
    if (user) completarTour(user.id)
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
        <motion.div variants={itemVariants} id="tour-saldo" className="relative mb-6">
          <AnimatePresence mode="wait" custom={direction}>
            {cuentaMostrada && (
              <motion.div
                key={cuentaMostrada.id}
                custom={direction}
                initial={{ opacity: 0, x: direction * 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -20 }}
                transition={{ duration: DURACION.swipe, ease: EASE_MONIX }}
                // Con dos cuentas también se pasa de una a otra deslizando:
                // hacia la izquierda la siguiente, hacia la derecha la anterior.
                // pan-y deja el scroll vertical de la página al navegador.
                drag={cuentaUSD ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.35}
                dragDirectionLock
                style={cuentaUSD ? { touchAction: 'pan-y' } : undefined}
                onDragEnd={(_, info) => {
                  const umbral = 60
                  if (info.offset.x < -umbral || info.velocity.x < -500) toggleCuenta(1)
                  else if (info.offset.x > umbral || info.velocity.x > 500) toggleCuenta(-1)
                }}
              >
                <SaldoCard
                  cuenta={cuentaMostrada}
                  interesHoy={interesHoyPorCuenta[cuentaMostrada.id] ?? 0}
                  titulo={cuentaUSD ? (monedaActiva === 'USD' ? 'Saldo disponible en dólares' : 'Saldo disponible en pesos') : 'Saldo disponible'}
                />
              </motion.div>
            )}
          </AnimatePresence>
          {!cuentaMostrada && !cuentasLoaded && (
            <Card className="p-8" role="status" aria-busy="true" aria-label="Cargando tu saldo">
              <Skeleton className="h-4 w-32 mb-4" />
              <Skeleton className="h-10 sm:h-12 w-3/5 mb-4" />
              <Skeleton className="h-3 w-2/5" />
            </Card>
          )}

          {cuentaUSD && (
            <>
              <button
                onClick={() => toggleCuenta(-1)}
                aria-label="Ver la otra cuenta"
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 w-9 h-9 rounded-full bg-white dark:bg-navy-card border border-slate-200 dark:border-white/10 shadow-sm flex items-center justify-center text-slate-secondary hover:text-navy dark:hover:text-mint hover:border-mint/30 transition-colors"
              >
                <ChevronLeft size={18} strokeWidth={1.5} />
              </button>
              <button
                onClick={() => toggleCuenta(1)}
                aria-label="Ver la otra cuenta"
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 w-9 h-9 rounded-full bg-white dark:bg-navy-card border border-slate-200 dark:border-white/10 shadow-sm flex items-center justify-center text-slate-secondary hover:text-navy dark:hover:text-mint hover:border-mint/30 transition-colors"
              >
                <ChevronRight size={18} strokeWidth={1.5} />
              </button>
            </>
          )}
        </motion.div>

        {/* Acciones rápidas: en celular van fijas abajo (Navbar). */}
        <motion.div variants={itemVariants} id="tour-acciones" className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <Button variant="primary" className="flex flex-col items-center gap-2 py-4" onClick={() => navigate('/transferir')}>
            <ArrowRightLeft size={20} />
            <span className="text-sm">Transferir</span>
          </Button>
          {/* En escritorio no está el botón QR flotante de la barra mobile: este
              abre el mismo overlay (escanear con la cámara o generar tu QR para
              cobrar), así que se muestra aunque no haya cámara. */}
          <Button
            variant="secondary"
            data-qr-fab
            className="flex flex-col items-center gap-2 py-4"
            onClick={(e) => useQrScanStore.getState().openFromElement(e.currentTarget)}
          >
            <QrCode size={20} />
            <span className="text-sm">QR</span>
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

        <motion.div variants={itemVariants} id="tour-reservas">
          <ReservasHomeCard cuentaId={cuenta?.id} />
        </motion.div>

        <motion.div variants={itemVariants} className="mb-8">
          <AdBanner />
        </motion.div>

        {/* Últimos movimientos */}
        <motion.div variants={itemVariants} id="tour-movimientos">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-navy dark:text-white">Últimos movimientos</h2>
            <button onClick={() => navigate('/historial')} className="text-sm font-body text-navy dark:text-mint hover:text-navy/70 dark:hover:text-mint-hover transition-colors">
              Ver todos
            </button>
          </div>

          {loadingMov ? (
            <MovimientosSkeleton />
          ) : movimientos.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="font-body text-slate-secondary text-sm">Todavía no tenés movimientos</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {movimientos.map((mov, i) => {
                const { text, esEntrada } = formatMonto(mov.monto, mov.tipo, mov.moneda)
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
                      <Monto tamaño="chico" negativo={!esEntrada} className="font-display font-semibold text-base">
                        {text}
                      </Monto>
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
        {showTour && (
          <OnboardingTour
            key="tour"
            steps={esCelular() ? TOUR_MOBILE : TOUR_DESKTOP}
            onComplete={handleTourComplete}
          />
        )}
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
