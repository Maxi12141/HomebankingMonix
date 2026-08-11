import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import { useAuth } from './hooks/useAuth'
import { useThemeStore } from './stores/themeStore'
import { isSupabaseConfigured } from './lib/supabaseClient'
import { LoadingScreen } from './components/LoadingScreen'
import { MissingEnvScreen } from './components/MissingEnvScreen'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { DashboardPage } from './pages/DashboardPage'
import { TransferPage } from './pages/TransferPage'
import { HistorialPage } from './pages/HistorialPage'
import { ProfilePage } from './pages/ProfilePage'
import { DepositPage } from './pages/DepositPage'
import { ContactosPage } from './pages/ContactosPage'
import { TarjetaPage } from './pages/TarjetaPage'
import { ReservasPage } from './pages/ReservasPage'
import { PagarPage } from './pages/PagarPage'
import { MercadoMonixPage } from './pages/MercadoMonixPage'
import { PromosPage } from './pages/PromosPage'
import { CashbackPage } from './pages/CashbackPage'
import { FinanciacionPage } from './pages/FinanciacionPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <>{children}</> : <Navigate to="/" replace />
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/dashboard" replace /> : <>{children}</>
}

function AppRoutes() {
  useAuth()

  return (
    <Routes>
      <Route path="/" element={<PublicOnly><LandingPage /></PublicOnly>} />
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
      <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
      <Route path="/transferir" element={<RequireAuth><TransferPage /></RequireAuth>} />
      <Route path="/historial" element={<RequireAuth><HistorialPage /></RequireAuth>} />
      <Route path="/depositar" element={<RequireAuth><DepositPage /></RequireAuth>} />
      <Route path="/tarjeta" element={<RequireAuth><TarjetaPage /></RequireAuth>} />
      <Route path="/reservas" element={<RequireAuth><ReservasPage /></RequireAuth>} />
      <Route path="/promos" element={<RequireAuth><PromosPage /></RequireAuth>} />
      <Route path="/cashback" element={<RequireAuth><CashbackPage /></RequireAuth>} />
      <Route path="/financiacion" element={<RequireAuth><FinanciacionPage /></RequireAuth>} />
      <Route path="/mercado-monix" element={<RequireAuth><MercadoMonixPage /></RequireAuth>} />
      <Route path="/pagar" element={<RequireAuth><PagarPage /></RequireAuth>} />
      <Route path="/perfil" element={<RequireAuth><ProfilePage /></RequireAuth>} />
      <Route path="/contactos" element={<RequireAuth><ContactosPage /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function AppShell() {
  const { loading } = useAuth()
  const { theme } = useThemeStore()
  const [minTimePassed, setMinTimePassed] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    const t = setTimeout(() => setMinTimePassed(true), 2400)
    return () => clearTimeout(t)
  }, [])

  const showLoader = loading || !minTimePassed

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
      <AnimatePresence>
        {showLoader
          ? <LoadingScreen key="loader" />
          : (
            <motion.div
              key="app"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <AppRoutes />
            </motion.div>
          )
        }
      </AnimatePresence>
    </>
  )
}

export default function App() {
  if (!isSupabaseConfigured) {
    return <MissingEnvScreen />
  }

  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
