import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Fingerprint } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../stores/themeStore'
import monixLogoDark from '../assets/logos/logo-blanco.svg'
import monixLogoLight from '../assets/logos/logo-azul.svg'
import { registrarPersona, asignarAlias, informarSituacionCrediticia, BancoCentralError } from '../services/bancoCentral'
import { generateNumeroCuenta, generateAlias } from '../utils/cuenta'
import {
  activarBiometria,
  esCancelacionBiometrica,
  esCelular,
  guardarCredencialBio,
  guardarNombreBio,
  marcarIngresoConClave,
  soportaHuella,
} from '../lib/biometria'
import { marcarUsuarioNuevo } from '../lib/onboarding'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { PasswordInput } from '../components/ui/PasswordInput'
import { PasswordStrengthMeter } from '../components/ui/PasswordStrengthMeter'
import { DatePicker } from '../components/ui/DatePicker'
import { TermsModal } from '../components/TermsModal'
import { CodigoRegistro } from '../components/CodigoRegistro'
import Stepper, { Step } from '../components/Stepper'
import type { RegisterFormData } from '../types'
import { mensajeError } from '../lib/errores'
import { saveRememberedEmail } from '../utils/rememberMe'
import { marcarActividad } from '../utils/sesiones'
import { emailYaRegistrado } from '../utils/codigoRegistro'

interface BioOfferInfo {
  userId: string
  email: string
  nombre: string
  password: string
}

const STEP_TITLES = ['Creá tu cuenta', 'Tus datos', 'Confirmá y listo']
const TOTAL_STEPS = STEP_TITLES.length

function StepHeading({ paso }: { paso: number }) {
  return (
    <h2 className="font-display text-xl font-semibold text-navy dark:text-white">
      {STEP_TITLES[paso]}
      <span className="sr-only"> (paso {paso + 1} de {TOTAL_STEPS})</span>
    </h2>
  )
}

export function RegisterPage() {
  const navigate = useNavigate()
  const { theme } = useThemeStore()
  const setProvisioning = useAuthStore((s) => s.setProvisioning)
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [aceptaTerminos, setAceptaTerminos] = useState(false)
  const [modalLegal, setModalLegal] = useState<'terminos' | 'privacidad' | null>(null)
  const [showBioOffer, setShowBioOffer] = useState(false)
  const [bioOfferInfo, setBioOfferInfo] = useState<BioOfferInfo | null>(null)
  const [bioLoading, setBioLoading] = useState(false)
  const [emailDuplicado, setEmailDuplicado] = useState(false)
  const [dniDuplicado, setDniDuplicado] = useState(false)
  const [progressMessage, setProgressMessage] = useState('Creando...')
  const [pantalla, setPantalla] = useState<'formulario' | 'codigo' | 'reintentar'>('formulario')
  const altaPendiente = useRef<{ userId: string; email: string } | null>(null)
  const datosBanco = useRef<{ dni: string; cbu: string; alias: string | null } | null>(null)
  const [form, setForm] = useState<RegisterFormData>({
    nombre: '',
    apellido: '',
    dni: '',
    email: '',
    telefono: '',
    fecha_nac: '',
    direccion: '',
    password: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (name === 'email') setEmailDuplicado(false)
    if (name === 'dni') setDniDuplicado(false)
  }

  // RLS en personas bloquea un select anónimo directo; existe_email_o_dni() expone sólo estos dos booleanos.
  async function handleEmailBlur() {
    const emailTrim = form.email.trim()
    if (!emailTrim) return
    try {
      const { data } = await supabase.rpc('existe_email_o_dni', { p_email: emailTrim, p_dni: null })
      setEmailDuplicado(Boolean(data?.[0]?.email_existe))
    } catch {
      // Si falla el chequeo no bloqueamos: el submit final igual lo valida contra la restricción UNIQUE real.
    }
  }

  async function handleDniBlur() {
    const dniTrim = form.dni.trim()
    if (!dniTrim) return
    try {
      const { data } = await supabase.rpc('existe_email_o_dni', { p_email: null, p_dni: dniTrim })
      setDniDuplicado(Boolean(data?.[0]?.dni_existe))
    } catch {
      // Idem: el submit final es la fuente de verdad si esto falla.
    }
  }

  function handleNext(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (step === 0 && emailDuplicado) return
    if (step === 1 && dniDuplicado) return
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1))
  }

  function handleBack() {
    if (loading) return
    setError('')
    setStep((s) => Math.max(s - 1, 0))
  }

  async function activarBiometriaDesdeOferta() {
    if (!bioOfferInfo) return
    setBioLoading(true)
    try {
      await activarBiometria(bioOfferInfo.userId, bioOfferInfo.nombre)
      guardarCredencialBio(bioOfferInfo.email, bioOfferInfo.password)
      guardarNombreBio(bioOfferInfo.email, form.nombre.trim())
      toast.success('Biometría activada. La próxima vez entrás más rápido.')
    } catch (err) {
      if (!esCancelacionBiometrica(err)) {
        toast.error(mensajeError(err, 'No pudimos activar la biometría. Podés probar de nuevo desde tu Perfil.'))
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

  // Abre la cuenta cuando ya hay sesión: enseguida si la confirmación por mail está apagada, o tras el código.
  async function completarAlta(userId: string, email: string) {
    setError('')
    setLoading(true)
    // La sesión ya está activa y PublicOnly redirigiría antes de terminar: esta
    // bandera lo frena hasta el navigate() explícito de más abajo.
    setProvisioning(true)
    let quedaOfertaBioPendiente = false
    let termino = false
    // Sin trim, un espacio de autocompletado de teclado en el email/DNI puede
    // desincronizar contra un login o chequeo posterior que sí normaliza.
    const nombre = form.nombre.trim()
    const apellido = form.apellido.trim()
    const dni = form.dni.trim()
    const telefono = form.telefono.trim()
    const direccion = form.direccion.trim()

    try {
      setProgressMessage('Generando tu CBU...')
      // Al reintentar no se repite: el Banco Central rechaza un DNI que ya tiene.
      if (datosBanco.current?.dni !== dni) {
        const { cbu } = await registrarPersona(nombre, apellido, dni)
        datosBanco.current = { dni, cbu, alias: null }
      }
      const banco = datosBanco.current
      if (!banco.alias) {
        const nuevoAlias = generateAlias()
        await asignarAlias(banco.cbu, nuevoAlias)
        banco.alias = nuevoAlias
      }
      const { cbu, alias } = banco

      // Persona, caja de ahorro con el bono de bienvenida y su movimiento, en una
      // sola transacción del servidor (S-1, docs/auditoria-2026-10.md). La
      // situación crediticia ficticia inicial también la elige el servidor.
      setProgressMessage('Abriendo tu cuenta...')
      const { data: alta, error: altaError } = await supabase.rpc('alta_cliente', {
        p_nombre: nombre,
        p_apellido: apellido,
        p_dni: dni,
        p_email: email,
        p_telefono: telefono,
        p_fecha_nac: form.fecha_nac || null,
        p_direccion: direccion,
        p_numero_cuenta: generateNumeroCuenta(),
        p_cbu: cbu,
        p_alias: alias,
      })
      if (altaError) throw new Error(altaError.message)

      try {
        // Le informamos al Banco Central esa situación inicial (una persona puede
        // tener cuentas en varios bancos del curso, y el registro compartido de
        // deudores agrega lo que informa cada uno). No bloquea el registro si
        // falla: Préstamos ya trata un DNI sin informe como situación 1.
        const { situacion, monto_deuda } = alta as { situacion: number; monto_deuda: number }
        await informarSituacionCrediticia(dni, monto_deuda, situacion)
        await supabase.rpc('marcar_situacion_informada')
      } catch (err) {
        console.error('No pudimos informar la situación crediticia al Banco Central:', err)
      }

      marcarUsuarioNuevo(userId)
      marcarIngresoConClave()

      saveRememberedEmail(email)
      marcarActividad()
      termino = true

      // Ofrecemos biometría acá, con la contraseña fresca en memoria, en vez de que el usuario la busque sola en Perfil.
      if (esCelular() && await soportaHuella()) {
        // provisioning sigue en true: bajarlo ya dejaría que PublicOnly redirija a /dashboard sin mostrar esta pantalla.
        quedaOfertaBioPendiente = true
        setBioOfferInfo({ userId, email, nombre: `${nombre} ${apellido}`, password: form.password })
        setShowBioOffer(true)
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      // No se cierra la sesión: el mail ya está confirmado y registrarse de nuevo daría "ya registrado".
      altaPendiente.current = { userId, email }
      setError(err instanceof BancoCentralError && err.status === 409
        ? 'Ese DNI ya está registrado. Revisá tus datos.'
        : mensajeError(err, 'No pudimos abrir tu cuenta. Probá de nuevo en unos minutos.'))
      setPantalla('reintentar')
    } finally {
      setLoading(false)
      // Sin terminar, sigue en true para que PublicOnly deje ver la pantalla de reintento.
      if (termino && !quedaOfertaBioPendiente) setProvisioning(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!aceptaTerminos) {
      setError('Tenés que aceptar los Términos y Condiciones para crear tu cuenta')
      return
    }
    if (altaPendiente.current) {
      setPantalla('formulario')
      await completarAlta(altaPendiente.current.userId, altaPendiente.current.email)
      return
    }
    setLoading(true)
    setProgressMessage('Creando tu usuario...')
    setProvisioning(true)
    const email = form.email.trim()
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          data: {
            full_name: `${form.nombre.trim()} ${form.apellido.trim()}`,
            phone: form.telefono.trim(),
          },
        },
      })
      if (authError) throw authError
      if (!data.user) throw new Error('No pudimos crear el usuario')

      if (data.session) {
        await completarAlta(data.user.id, email)
        return
      }
      setProvisioning(false)
      if (emailYaRegistrado(data.user)) {
        setError('Ese email ya está registrado. Ingresá con tu contraseña.')
        return
      }
      setPantalla('codigo')
    } catch (err) {
      setProvisioning(false)
      setError(mensajeError(err, 'No pudimos crear tu cuenta. Probá de nuevo en unos minutos.'))
    } finally {
      setLoading(false)
    }
  }

  async function verificarCodigo(codigo: string) {
    const email = form.email.trim()
    setProgressMessage('Verificando...')
    // verifyOtp deja la sesión activa: PublicOnly no tiene que redirigir antes de abrir la cuenta.
    setProvisioning(true)
    const { data, error: errorCodigo } = await supabase.auth.verifyOtp({ email, token: codigo, type: 'signup' })
    if (errorCodigo || !data.user) {
      setProvisioning(false)
      throw errorCodigo ?? new Error('No pudimos comprobar el código')
    }
    await completarAlta(data.user.id, email)
  }

  async function reenviarCodigo() {
    const { error: errorReenvio } = await supabase.auth.resend({ type: 'signup', email: form.email.trim() })
    if (errorReenvio) throw errorReenvio
  }

  function corregirMail() {
    setError('')
    setPantalla('formulario')
    setStep(0)
  }

  function corregirDatos() {
    setError('')
    setPantalla('formulario')
    setStep(1)
  }

  return (
    <div className="min-h-screen bg-slate-input dark:bg-navy flex items-center justify-center p-4 py-10">
      <motion.div
        className="w-full max-w-lg"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="mb-8 text-center">
          <Link to="/" className="inline-block mb-3">
            <img
              src={theme === 'dark' ? monixLogoDark : monixLogoLight}
              alt="Monix"
              className="h-10 w-auto object-contain mx-auto"
            />
          </Link>
          <p className="font-body text-slate-secondary">Creá tu cuenta en minutos</p>
        </div>

        <div className="bg-white dark:bg-navy-card rounded-2xl border border-slate-200 dark:border-white/10 p-8 shadow-sm dark:shadow-none">
          {showBioOffer ? (
            <>
              <h2 className="font-display text-xl font-semibold text-navy dark:text-white mb-1">¿Activar la biometría?</h2>
              <p className="font-body text-sm text-slate-secondary mb-6">
                La próxima vez vas a poder entrar sin escribir tu contraseña.
              </p>

              <div className="flex items-center justify-center mb-6">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-navy border border-navy dark:bg-mint/15 dark:border-mint/40">
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
          ) : pantalla === 'codigo' ? (
            <CodigoRegistro
              email={form.email.trim()}
              progreso={progressMessage}
              onVerificar={verificarCodigo}
              onReenviar={reenviarCodigo}
              onCorregir={corregirMail}
            />
          ) : pantalla === 'reintentar' ? (
            <div className="flex flex-col gap-4">
              <h2 className="font-display text-xl font-semibold text-navy dark:text-white">No pudimos abrir tu cuenta</h2>
              <p role="alert" className="font-body text-sm text-slate-secondary">{error}</p>
              <p className="font-body text-sm text-slate-secondary">Tu mail ya quedó confirmado. No cierres esta pantalla: tus datos siguen acá.</p>
              <form onSubmit={handleSubmit}>
                <Button type="submit" loading={loading} loadingLabel="Abriendo..." className="w-full">
                  Probar de nuevo
                </Button>
              </form>
              <Button type="button" variant="secondary" onClick={corregirDatos} disabled={loading} className="w-full">
                Corregir mis datos
              </Button>
            </div>
          ) : (
          <>
          {/* Controlado y sin footer: avanzar pasa siempre por el submit de cada form, que valida. */}
          <Stepper
            step={step + 1}
            theme={theme}
            frame={false}
            width="100%"
            radius={34}
            showFooter={false}
            disableStepIndicators
          >
            <Step title="Cuenta">
              <form onSubmit={handleNext} className="flex flex-col gap-4">
                <StepHeading paso={0} />
                <Input
                  label="Email"
                  autoComplete="email"
                  type="email"
                  name="email"
                  placeholder="juan@email.com"
                  value={form.email}
                  onChange={handleChange}
                  onBlur={() => { void handleEmailBlur() }}
                  error={emailDuplicado ? 'Ese email ya está registrado' : undefined}
                  required
                  autoFocus
                />
                <PasswordInput
                  label="Contraseña"
                  autoComplete="new-password"
                  name="password"
                  placeholder="Mínimo 6 caracteres"
                  value={form.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                />
                <PasswordStrengthMeter password={form.password} />

                {error && (
                  <p className="text-sm text-red-500 dark:text-red-400 font-body bg-red-50 dark:bg-red-400/10 rounded-xl px-4 py-3">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full mt-2">
                  Continuar
                </Button>
              </form>
            </Step>

            <Step title="Datos">
              <form onSubmit={handleNext} className="flex flex-col gap-4">
                <StepHeading paso={1} />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Nombre" name="nombre" autoComplete="given-name" placeholder="Juan" value={form.nombre} onChange={handleChange} required autoFocus />
                  <Input label="Apellido" name="apellido" autoComplete="family-name" placeholder="Pérez" value={form.apellido} onChange={handleChange} required />
                </div>

                <Input
                  label="DNI"
                  name="dni"
                  placeholder="12345678"
                  value={form.dni}
                  onChange={handleChange}
                  onBlur={() => { void handleDniBlur() }}
                  error={dniDuplicado ? 'Ese DNI ya está registrado' : undefined}
                  required
                />
                <Input label="Teléfono" type="tel" name="telefono" autoComplete="tel" placeholder="1112345678" value={form.telefono} onChange={handleChange} />
                <DatePicker
                  label="Fecha de nacimiento"
                  value={form.fecha_nac}
                  onChange={(iso) => setForm(prev => ({ ...prev, fecha_nac: iso }))}
                />
                <Input label="Domicilio" name="direccion" autoComplete="street-address" placeholder="Av. Corrientes 1234" value={form.direccion} onChange={handleChange} />

                {error && (
                  <p className="text-sm text-red-500 dark:text-red-400 font-body bg-red-50 dark:bg-red-400/10 rounded-xl px-4 py-3">
                    {error}
                  </p>
                )}

                <div className="flex gap-3 mt-2">
                  <Button type="button" variant="secondary" onClick={handleBack} className="w-full">
                    Atrás
                  </Button>
                  <Button type="submit" className="w-full">
                    Continuar
                  </Button>
                </div>
              </form>
            </Step>

            <Step title="Confirmar">
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <StepHeading paso={2} />
                <div className="rounded-xl bg-slate-input dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 flex flex-col gap-2">
                  <div className="flex justify-between gap-3">
                    <span className="font-body text-xs text-slate-secondary">Nombre</span>
                    <span className="font-body text-sm text-navy dark:text-white text-right">{form.nombre} {form.apellido}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="font-body text-xs text-slate-secondary">DNI</span>
                    <span className="font-body text-sm text-navy dark:text-white text-right">{form.dni}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="font-body text-xs text-slate-secondary">Email</span>
                    <span className="font-body text-sm text-navy dark:text-white text-right break-all">{form.email}</span>
                  </div>
                  {form.telefono && (
                    <div className="flex justify-between gap-3">
                      <span className="font-body text-xs text-slate-secondary">Teléfono</span>
                      <span className="font-body text-sm text-navy dark:text-white text-right">{form.telefono}</span>
                    </div>
                  )}
                </div>

                <p className="font-body text-xs text-slate-secondary leading-relaxed">
                  Te vamos a mandar un código a tu mail. Al confirmarlo abrimos tu cuenta y te acreditamos un bono de bienvenida.
                </p>

                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={aceptaTerminos}
                    onChange={(e) => setAceptaTerminos(e.target.checked)}
                    required
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-white/20 accent-mint cursor-pointer shrink-0"
                  />
                  <span className="text-sm font-body text-slate-secondary leading-snug">
                    Acepto los{' '}
                    <button
                      type="button"
                      onClick={() => setModalLegal('terminos')}
                      className="text-navy dark:text-mint hover:text-navy/70 dark:hover:text-mint-hover underline underline-offset-2"
                    >
                      Términos y Condiciones
                    </button>{' '}
                    y la{' '}
                    <button
                      type="button"
                      onClick={() => setModalLegal('privacidad')}
                      className="text-navy dark:text-mint hover:text-navy/70 dark:hover:text-mint-hover underline underline-offset-2"
                    >
                      Política de Privacidad
                    </button>{' '}
                    de Monix
                  </span>
                </label>

                {error && (
                  <p className="text-sm text-red-500 dark:text-red-400 font-body bg-red-50 dark:bg-red-400/10 rounded-xl px-4 py-3">
                    {error}
                  </p>
                )}

                {loading && (
                  <p className="text-center text-xs font-body text-slate-secondary -mb-1">
                    {progressMessage}
                  </p>
                )}

                <div className="flex gap-3 mt-2">
                  <Button type="button" variant="secondary" onClick={handleBack} disabled={loading} className="w-full">
                    Atrás
                  </Button>
                  <Button type="submit" loading={loading} loadingLabel="Creando..." disabled={!aceptaTerminos} className="w-full">
                    Crear cuenta
                  </Button>
                </div>
              </form>
            </Step>
          </Stepper>

          <p className="text-center text-sm font-body text-slate-secondary mt-6">
            ¿Ya tenés cuenta?{' '}
            <Link to="/login" className="underline underline-offset-2 text-navy dark:text-mint hover:text-navy/70 dark:hover:text-mint-hover transition-colors">
              Iniciá sesión
            </Link>
          </p>
          </>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {modalLegal && <TermsModal tipo={modalLegal} onClose={() => setModalLegal(null)} />}
      </AnimatePresence>
    </div>
  )
}
