import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Fingerprint, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../stores/themeStore'
import { usePwaInstall } from '../hooks/usePwaInstall'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { getRememberedEmail, saveRememberedEmail, clearRememberedEmail } from '../utils/rememberMe'
import {
  activarBiometria,
  borrarCredencialBio,
  consumoIngresoConClave,
  credencialBioParaEmail,
  esCancelacionBiometrica,
  esCelular,
  guardarCredencialBio,
  guardarNombreBio,
  huellaActiva,
  marcarIngresoConClave,
  nombreBioParaEmail,
  soportaHuella,
  uidParaEmail,
  verificarHuella,
} from '../lib/biometria'
import { descartarOnboarding } from '../lib/onboarding'
import monixLogoDark from '../assets/logos/logo-blanco.svg'
import monixLogoLight from '../assets/logos/logo-azul.svg'

type Step = 'email' | 'password' | 'bio' | 'bio-offer'

// Backoff client-side: no hay captcha real disponible (requeriría claves de un servicio externo).
const UMBRAL_INTENTOS = 3
const ESPERAS_SEG = [10, 20, 40, 60]

interface BioOfferInfo {
  userId: string
  nombre: string
  password: string
}

export function LoginPage() {
  const { login } = useAuth()
  const setProvisioning = useAuthStore((s) => s.setProvisioning)
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
  const [bioOfferInfo, setBioOfferInfo] = useState<BioOfferInfo | null>(null)
  const [intentosFallidos, setIntentosFallidos] = useState(0)
  const [bloqueadoHasta, setBloqueadoHasta] = useState<number | null>(null)
  const [segundosRestantes, setSegundosRestantes] = useState(0)
  const { mostrarBoton: mostrarInstalar, instalar } = usePwaInstall()

  useEffect(() => {
    if (!bloqueadoHasta) return
    const tick = () => {
      const restante = Math.ceil((bloqueadoHasta - Date.now()) / 1000)
      if (restante <= 0) {
        setSegundosRestantes(0)
        setBloqueadoHasta(null)
      } else {
        setSegundosRestantes(restante)
      }
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [bloqueadoHasta])

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
    // Se marca ANTES de autenticar: onAuthStateChange puede reaccionar al nuevo user antes de este await.
    marcarIngresoConClave()
    // Sin esto, PublicOnly redirige solo a /dashboard apenas ve "user" seteado, sin dejar mostrar la oferta de biometría.
    setProvisioning(true)
    let authUser
    try {
      authUser = await login(emailFinal, passwordFinal)
    } catch (err) {
      consumoIngresoConClave()
      setProvisioning(false)
      throw err
    }
    descartarOnboarding()
    if (rememberMe) {
      saveRememberedEmail(emailFinal)
    } else {
      clearRememberedEmail()
    }

    // Ofrecemos biometría acá, recién autenticado, en vez de que el usuario la busque sola en Perfil.
    if (authUser && esCelular() && !huellaActiva(authUser.id) && await soportaHuella()) {
      const nombreCompleto = (authUser.user_metadata?.full_name as string | undefined)?.trim()
      setBioOfferInfo({ userId: authUser.id, nombre: nombreCompleto || emailFinal, password: passwordFinal })
      setStep('bio-offer')
      return
    }

    setProvisioning(false)
    navigate('/dashboard')
  }

  async function activarBiometriaDesdeOferta() {
    if (!bioOfferInfo) return
    setBioLoading(true)
    try {
      await activarBiometria(bioOfferInfo.userId, bioOfferInfo.nombre)
      guardarCredencialBio(email.trim(), bioOfferInfo.password)
      guardarNombreBio(email.trim(), bioOfferInfo.nombre.split(' ')[0])
      toast.success('Biometría activada. La próxima vez entrás más rápido.')
    } catch (err) {
      if (!esCancelacionBiometrica(err)) {
        toast.error(err instanceof Error ? err.message : 'No se pudo activar la biometría')
      }
    } finally {
      setBioLoading(false)
      setProvisioning(false)
      navigate('/dashboard')
    }
  }

  function omitirOfertaBiometria() {
    setProvisioning(false)
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
      try {
        await finalizarLogin(emailNorm, credencial)
      } catch {
        // Huella OK pero password guardada obsoleta (cambió en Perfil) — evita repetir este fallo en silencio.
        borrarCredencialBio(emailNorm)
        setMostrarPassword(true)
        setError('Tu sesión de huella quedó desactualizada (cambiaste tu contraseña). Ingresá con tu contraseña actual.')
      }
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
    if (bloqueadoHasta && Date.now() < bloqueadoHasta) return
    setLoading(true)
    try {
      await finalizarLogin(email.trim(), password)
      setIntentosFallidos(0)
    } catch {
      setError('Email o contraseña incorrectos')
      const nuevosIntentos = intentosFallidos + 1
      setIntentosFallidos(nuevosIntentos)
      if (nuevosIntentos >= UMBRAL_INTENTOS) {
        const idx = Math.min(nuevosIntentos - UMBRAL_INTENTOS, ESPERAS_SEG.length - 1)
        setBloqueadoHasta(Date.now() + ESPERAS_SEG[idx] * 1000)
      }
    } finally {
      setLoading(false)
    }
  }

  function cambiarCuenta() {
    setStep('email')
    setEmail('')
    setPassword('')
    setError('')
    setMostrarPassword(false)
    setNombre(null)
    setIntentosFallidos(0)
    setBloqueadoHasta(null)
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
                  <Link
                    to="/recuperar-contrasena"
                    className="self-end -mt-2 text-xs font-body text-mint hover:text-mint-hover transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                  {segundosRestantes > 0 && (
                    <p className="text-xs text-center font-body text-slate-secondary">
                      Demasiados intentos. Podés reintentar en {segundosRestantes}s.
                    </p>
                  )}
                  <Button type="submit" variant="secondary" loading={loading} disabled={segundosRestantes > 0} className="w-full">
                    Ingresar
                  </Button>
                </form>
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
                <Link
                  to="/recuperar-contrasena"
                  className="self-end -mt-2 text-xs font-body text-mint hover:text-mint-hover transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </Link>

                {error && (
                  <p className="text-sm text-red-500 dark:text-red-400 font-body bg-red-50 dark:bg-red-400/10 rounded-xl px-4 py-3">
                    {error}
                  </p>
                )}

                {segundosRestantes > 0 && (
                  <p className="text-xs text-center font-body text-slate-secondary">
                    Demasiados intentos. Podés reintentar en {segundosRestantes}s.
                  </p>
                )}

                <Button type="submit" loading={loading} disabled={segundosRestantes > 0} className="w-full mt-2">
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

          {step === 'bio-offer' && (
            <>
              <h2 className="font-display text-xl font-semibold text-navy dark:text-white mb-1">¿Activar tu huella?</h2>
              <p className="font-body text-sm text-slate-secondary mb-6">
                La próxima vez vas a poder entrar sin escribir tu contraseña.
              </p>

              <div className="flex items-center justify-center mb-6">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-mint/15 border border-mint/40">
                  <Fingerprint size={30} className="text-mint" strokeWidth={1.6} />
                </span>
              </div>

              <Button
                type="button"
                loading={bioLoading}
                loadingLabel="Activando..."
                onClick={() => { void activarBiometriaDesdeOferta() }}
                className="w-full mb-3"
              >
                Sí, activar
              </Button>
              <button
                type="button"
                onClick={omitirOfertaBiometria}
                className="w-full text-center text-sm font-body text-slate-secondary hover:text-navy dark:hover:text-white transition-colors py-2"
              >
                Ahora no
              </button>
            </>
          )}

          {step !== 'bio-offer' && mostrarInstalar && (
            // Visible en los pasos de login, no acá — el usuario ya está entrando.
            <button
              type="button"
              onClick={() => { void handleInstalar() }}
              className="w-full flex items-center justify-center gap-2 text-mint font-body text-sm font-medium py-3 mt-4 hover:text-mint-hover transition-colors"
            >
              <Download size={16} />
              Instalar Monix
            </button>
          )}

          {step !== 'bio-offer' && (
            <p className="text-center text-sm font-body text-slate-secondary mt-6">
              ¿No tenés cuenta?{' '}
              <Link to="/register" className="text-mint hover:text-mint-hover transition-colors">
                Registrate
              </Link>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  )
}
