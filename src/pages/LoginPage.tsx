import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Fingerprint, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { useThemeStore } from '../stores/themeStore'
import { usePwaInstall } from '../hooks/usePwaInstall'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { getRememberedEmail, saveRememberedEmail, clearRememberedEmail } from '../utils/rememberMe'
import {
  credencialBioParaEmail,
  esCancelacionBiometrica,
  esCelular,
  huellaActiva,
  marcarIngresoConClave,
  nombreBioParaEmail,
  uidParaEmail,
  verificarHuella,
} from '../lib/biometria'
import { descartarOnboarding } from '../lib/onboarding'
import monixLogoDark from '../assets/logos/logo-blanco.svg'
import monixLogoLight from '../assets/logos/logo-azul.svg'

type Step = 'email' | 'password' | 'bio'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const { theme } = useThemeStore()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [bioLoading, setBioLoading] = useState(false)
  const [nombre, setNombre] = useState<string | null>(null)
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const { mostrarBoton: mostrarInstalar, instalar } = usePwaInstall()

  useEffect(() => {
    const remembered = getRememberedEmail()
    if (!remembered) return
    setEmail(remembered)
    setRememberMe(true)
    // Si ya tiene huella activa en este dispositivo, salteamos el paso de
    // tipear el email y vamos directo a la pantalla de "Ingresar" con huella.
    const uid = uidParaEmail(remembered)
    const credencial = uid ? credencialBioParaEmail(remembered) : null
    if (uid && esCelular() && huellaActiva(uid) && credencial) {
      setNombre(nombreBioParaEmail(remembered))
      setStep('bio')
    }
  }, [])

  async function finalizarLogin(emailFinal: string, passwordFinal: string) {
    await login(emailFinal, passwordFinal)
    descartarOnboarding()
    marcarIngresoConClave()
    if (rememberMe) {
      saveRememberedEmail(emailFinal)
    } else {
      clearRememberedEmail()
    }
    navigate('/dashboard')
  }

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const emailNorm = email.trim()
    const uid = uidParaEmail(emailNorm)
    const credencial = uid ? credencialBioParaEmail(emailNorm) : null
    if (uid && esCelular() && huellaActiva(uid) && credencial) {
      setNombre(nombreBioParaEmail(emailNorm))
      setStep('bio')
    } else {
      setStep('password')
    }
  }

  async function pedirBiometria() {
    const emailNorm = email.trim()
    const uid = uidParaEmail(emailNorm)
    const credencial = credencialBioParaEmail(emailNorm)
    if (!uid || !credencial) return
    setError('')
    setBioLoading(true)
    try {
      await verificarHuella(uid)
      await finalizarLogin(emailNorm, credencial)
    } catch (err) {
      if (!esCancelacionBiometrica(err)) {
        setError(err instanceof Error ? err.message : 'No se pudo validar. Usá la contraseña.')
      }
    } finally {
      setBioLoading(false)
    }
  }

  async function handleInstalar() {
    const resultado = await instalar()
    if (resultado === 'manual-ios') {
      toast('Para instalar: tocá Compartir y elegí "Agregar a Inicio"', { icon: '📲', duration: 5000 })
    } else if (resultado === 'no-disponible') {
      toast('Tu navegador todavía no permite instalar. Probá con Chrome en Android.', { duration: 4000 })
    } else if (resultado === 'instalada') {
      toast.success('¡Lista! Buscá el ícono de Monix en tu pantalla de inicio.')
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await finalizarLogin(email.trim(), password)
    } catch {
      setError('Email o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  function cambiarCuenta() {
    setStep('email')
    setPassword('')
    setError('')
    setMostrarPassword(false)
    setNombre(null)
  }

  return (
    <div className="min-h-screen bg-[#F0F2F5] dark:bg-navy flex items-center justify-center p-4">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="mb-10 text-center">
          <Link to="/" className="inline-block mb-3">
            <img
              src={theme === 'dark' ? monixLogoDark : monixLogoLight}
              alt="Monix"
              className="h-10 w-auto object-contain mx-auto"
            />
          </Link>
          <p className="font-body text-slate-secondary">Tu banco digital, simple y seguro</p>
        </div>

        <div className="bg-white dark:bg-navy-card rounded-2xl border border-slate-200 dark:border-white/10 p-8 shadow-sm dark:shadow-none">
          {step === 'email' && (
            <>
              <h2 className="font-display text-xl font-semibold text-navy dark:text-white mb-6">Iniciar sesión</h2>
              <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
                <Input
                  label="Email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
                <label className="flex items-center gap-2 -mt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 dark:border-white/20 accent-mint cursor-pointer"
                  />
                  <span className="text-sm font-body text-slate-secondary">Recordarme</span>
                </label>
                <Button type="submit" className="w-full mt-2">
                  Continuar
                </Button>
              </form>
            </>
          )}

          {step === 'bio' && (
            <>
              <h2 className="font-display text-xl font-semibold text-navy dark:text-white mb-1">
                {nombre ? `Hola, ${nombre}` : 'Hola de nuevo'}
              </h2>
              <p className="font-body text-sm text-slate-secondary mb-6">{email.trim()}</p>

              <div className="flex items-center justify-center gap-6 mb-6">
                <button
                  type="button"
                  onClick={() => { void pedirBiometria() }}
                  className="relative flex h-24 w-24 items-center justify-center"
                  aria-label="Ingresar con biometría"
                >
                  <span className="huella-ring absolute inset-0 rounded-full border border-mint/25" />
                  <span className="huella-ring huella-ring-delay absolute inset-3 rounded-full border border-mint/40" />
                  <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-mint/15 border border-mint/40">
                    <Fingerprint size={30} className="text-mint" strokeWidth={1.6} />
                  </span>
                </button>
              </div>

              <Button
                type="button"
                loading={bioLoading}
                onClick={() => { void pedirBiometria() }}
                className="w-full"
              >
                Ingresar
              </Button>

              {error && (
                <p className="text-sm text-red-500 dark:text-red-400 font-body bg-red-50 dark:bg-red-400/10 rounded-xl px-4 py-3 mt-4">
                  {error}
                </p>
              )}

              <div className="h-px bg-slate-200 dark:bg-white/10 my-5" />

              {!mostrarPassword ? (
                <button
                  type="button"
                  onClick={() => setMostrarPassword(true)}
                  className="w-full text-center rounded-xl border border-slate-300 dark:border-white/15 text-navy dark:text-white font-body text-sm font-medium py-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  Ingresar con contraseña
                </button>
              ) : (
                <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
                  <Input
                    label="Contraseña"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                  />
                  <Button type="submit" variant="secondary" loading={loading} className="w-full">
                    Ingresar
                  </Button>
                </form>
              )}

              {mostrarInstalar && (
                <button
                  type="button"
                  onClick={() => { void handleInstalar() }}
                  className="w-full flex items-center justify-center gap-2 text-mint font-body text-sm font-medium py-3 mt-2 hover:text-mint-hover transition-colors"
                >
                  <Download size={16} />
                  Instalar Monix
                </button>
              )}

              <button
                type="button"
                onClick={cambiarCuenta}
                className="w-full text-center text-sm font-body text-slate-secondary hover:text-navy dark:hover:text-white transition-colors mt-3"
              >
                ‹ Cambiar cuenta
              </button>
            </>
          )}

          {step === 'password' && (
            <>
              <h2 className="font-display text-xl font-semibold text-navy dark:text-white mb-1">Iniciar sesión</h2>
              <p className="font-body text-sm text-slate-secondary mb-6">{email.trim()}</p>
              <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
                <Input
                  label="Contraseña"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />

                {error && (
                  <p className="text-sm text-red-500 dark:text-red-400 font-body bg-red-50 dark:bg-red-400/10 rounded-xl px-4 py-3">
                    {error}
                  </p>
                )}

                <Button type="submit" loading={loading} className="w-full mt-2">
                  Iniciar sesión
                </Button>
              </form>
              <button
                type="button"
                onClick={cambiarCuenta}
                className="w-full text-center text-sm font-body text-slate-secondary hover:text-navy dark:hover:text-white transition-colors mt-4"
              >
                ‹ Cambiar cuenta
              </button>
            </>
          )}

          <p className="text-center text-sm font-body text-slate-secondary mt-6">
            ¿No tenés cuenta?{' '}
            <Link to="/register" className="text-mint hover:text-mint-hover transition-colors">
              Registrate
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
