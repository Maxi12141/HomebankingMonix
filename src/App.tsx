import { useState, useEffect, lazy, Suspense, type ComponentType } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { motion, MotionConfig } from 'framer-motion'
import toast, { Toaster, useToasterStore } from 'react-hot-toast'

// react-hot-toast no limita solo cuántos toasts se acumulan en pantalla — si
// varios se disparan seguidos (reintentos de login, red inestable, etc.) se
// van apilando sin desaparecer hasta que cada uno cumple su propio `duration`.
// Se recorta a los últimos 4 visibles, descartando los más viejos apenas se
// supera el máximo (recomendación oficial de la librería).
const TOASTS_VISIBLES_MAX = 4
import { useAuth } from './hooks/useAuth'
import { useThemeStore } from './stores/themeStore'
import { isSupabaseConfigured } from './lib/supabaseClient'
import { LoadingScreen } from './components/LoadingScreen'
import { MissingEnvScreen } from './components/MissingEnvScreen'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { MovimientosSkeleton } from './components/ui/Skeleton'
import { useBiometriaLock } from './hooks/useBiometriaLock'
import { useCuenta } from './hooks/useCuenta'
import { useSyncTransferenciasEntrantes } from './hooks/useSyncTransferenciasEntrantes'
import { HuellaLockScreen } from './components/HuellaLockScreen'
import { PruebaEntrada } from './pages/PruebaEntrada'
import { esModoPrueba } from './lib/modoPrueba'

// Cada pantalla va en su propio chunk y se baja al visitarla. Landing y Login
// quedan en la carga inicial porque son la puerta de entrada.
const pagina = <K extends string>(cargar: () => Promise<Record<K, ComponentType>>, nombre: K) =>
  lazy(() => cargar().then((m) => ({ default: m[nombre] })))
const cargarDashboard = () => import('./pages/DashboardPage')
const DashboardPage = pagina(cargarDashboard, 'DashboardPage')
const RegisterPage = pagina(() => import('./pages/RegisterPage'), 'RegisterPage')
const TransferPage = pagina(() => import('./pages/TransferPage'), 'TransferPage')
const MetasPage = pagina(() => import('./pages/MetasPage'), 'MetasPage')
const HistorialPage = pagina(() => import('./pages/HistorialPage'), 'HistorialPage')
const ProfilePage = pagina(() => import('./pages/ProfilePage'), 'ProfilePage')
const DepositPage = pagina(() => import('./pages/DepositPage'), 'DepositPage')
const CuentasPage = pagina(() => import('./pages/CuentasPage'), 'CuentasPage')
const CompraVentaDolaresPage = pagina(() => import('./pages/CompraVentaDolaresPage'), 'CompraVentaDolaresPage')
const ContactosPage = pagina(() => import('./pages/ContactosPage'), 'ContactosPage')
const TarjetaPage = pagina(() => import('./pages/TarjetaPage'), 'TarjetaPage')
const ReservasPage = pagina(() => import('./pages/ReservasPage'), 'ReservasPage')
const MercadoMonixPage = pagina(() => import('./pages/MercadoMonixPage'), 'MercadoMonixPage')
const PromosPage = pagina(() => import('./pages/PromosPage'), 'PromosPage')
const CashbackPage = pagina(() => import('./pages/CashbackPage'), 'CashbackPage')
const PrestamosPage = pagina(() => import('./pages/PrestamosPage'), 'PrestamosPage')
const ForgotPasswordPage = pagina(() => import('./pages/ForgotPasswordPage'), 'ForgotPasswordPage')
const ResetPasswordPage = pagina(() => import('./pages/ResetPasswordPage'), 'ResetPasswordPage')

// Con una sesión guardada, la primera pantalla va a ser el Dashboard: se baja
// durante el splash en vez de después.
function haySesionGuardada() {
  try {
    return Object.keys(localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
  } catch {
    return false
  }
}

function PantallaCargando() {
  return (
    <div className="min-h-screen bg-slate-input dark:bg-navy p-6 pt-24">
      <div className="max-w-2xl mx-auto">
        <MovimientosSkeleton filas={3} label="Cargando la pantalla" />
      </div>
    </div>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (esModoPrueba()) return <>{children}</>
  if (loading) return null
  return user ? <>{children}</> : <Navigate to="/" replace />
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading, provisioning } = useAuth()
  if (loading) return null
  return user && !provisioning ? <Navigate to="/dashboard" replace /> : <>{children}</>
}

// Carga las cuentas (y su Realtime) una vez para toda la app logueada: sin
// esto, las páginas que no llaman a useCuenta() por su cuenta (Historial)
// quedan en "Cargando..." al entrar directo o recargar, porque useMovimientos
// espera a que la store tenga cuentas.
function CuentasGlobales() {
  useCuenta()
  // Una sola sincronización con el Banco Central para toda la app: antes cada
  // pantalla montaba la suya y cada navegación repetía la consulta.
  useSyncTransferenciasEntrantes()
  return null
}

function AppRoutes() {
  const { user, loading } = useAuth()
  const { locked, unlock } = useBiometriaLock(loading ? null : user)
  const location = useLocation()

  // La prueba no pide huella: entra directo, aunque este celular tenga otra cuenta.
  const enPrueba = esModoPrueba() || location.pathname === '/prueba'
  // El link de recuperación no debería toparse con el bloqueo por huella.
  if (!loading && user && locked && !enPrueba && location.pathname !== '/restablecer-contrasena') {
    return <HuellaLockScreen onUnlock={unlock} />
  }

  return (
    <>
    {!loading && user && <CuentasGlobales />}
    <Suspense fallback={<PantallaCargando />}>
    <Routes>
      <Route path="/" element={<PublicOnly><LandingPage /></PublicOnly>} />
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
      <Route path="/prueba" element={<PruebaEntrada />} />
      <Route path="/recuperar-contrasena" element={<PublicOnly><ForgotPasswordPage /></PublicOnly>} />
      <Route path="/restablecer-contrasena" element={<ResetPasswordPage />} />
      <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
      <Route path="/cuentas" element={<RequireAuth><CuentasPage /></RequireAuth>} />
      <Route path="/dolares" element={<RequireAuth><CompraVentaDolaresPage /></RequireAuth>} />
      <Route path="/transferir" element={<RequireAuth><TransferPage /></RequireAuth>} />
      <Route path="/metas" element={<RequireAuth><MetasPage /></RequireAuth>} />
      <Route path="/historial" element={<RequireAuth><HistorialPage /></RequireAuth>} />
      <Route path="/depositar" element={<RequireAuth><DepositPage /></RequireAuth>} />
      <Route path="/tarjeta" element={<RequireAuth><TarjetaPage /></RequireAuth>} />
      <Route path="/reservas" element={<RequireAuth><ReservasPage /></RequireAuth>} />
      <Route path="/promos" element={<RequireAuth><PromosPage /></RequireAuth>} />
      <Route path="/cashback" element={<RequireAuth><CashbackPage /></RequireAuth>} />
      <Route path="/prestamos" element={<RequireAuth><PrestamosPage /></RequireAuth>} />
      <Route path="/mercado-monix" element={<RequireAuth><MercadoMonixPage /></RequireAuth>} />
      <Route path="/perfil" element={<RequireAuth><ProfilePage /></RequireAuth>} />
      <Route path="/contactos" element={<RequireAuth><ContactosPage /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
    </>
  )
}

function AppShell() {
  const { loading } = useAuth()
  const { theme } = useThemeStore()
  const [minTimePassed, setMinTimePassed] = useState(false)
  const [splashTimedOut, setSplashTimedOut] = useState(false)
  const { toasts } = useToasterStore()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    toasts
      .filter((t) => t.visible)
      .filter((_, i) => i >= TOASTS_VISIBLES_MAX)
      .forEach((t) => toast.dismiss(t.id))
  }, [toasts])

  useEffect(() => {
    if (haySesionGuardada()) void cargarDashboard().catch(() => undefined)
  }, [])

  useEffect(() => {
    const min = window.setTimeout(() => setMinTimePassed(true), 2400)
    // Si auth o Realtime se cuelgan, no dejar el logo azul tapando la app.
    const max = window.setTimeout(() => setSplashTimedOut(true), 4500)
    return () => {
      window.clearTimeout(min)
      window.clearTimeout(max)
    }
  }, [])

  const showLoader = !splashTimedOut && (loading || !minTimePassed)

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#0D2B52',
            color: '#ffffff',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#26FFC1', secondary: '#0D2B52' },
          },
          error: {
            iconTheme: { primary: '#f87171', secondary: '#0D2B52' },
          },
        }}
      />
      {showLoader ? (
        <LoadingScreen />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <AppRoutes />
        </motion.div>
      )}
    </>
  )
}

export default function App() {
  if (!isSupabaseConfigured) {
    return <MissingEnvScreen />
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        {/* Framer Motion respeta "reducir movimiento" del sistema, como ya lo hace el CSS. */}
        <MotionConfig reducedMotion="user">
          <AppShell />
        </MotionConfig>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
