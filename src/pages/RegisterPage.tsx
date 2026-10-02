import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Fingerprint } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../stores/themeStore'
import monixLogoDark from '../assets/logos/logo-blanco.svg'
import monixLogoLight from '../assets/logos/logo-azul.svg'
import { registrarPersona, asignarAlias, informarSituacionCrediticia, BancoCentralError, mensajeAmigableBC } from '../services/bancoCentral'
import { generateNumeroCuenta, generateAlias } from '../utils/cuenta'
import { situacionCrediticiaFicticia } from '../utils/prestamos'
import {
  activarBiometria,
  esCancelacionBiometrica,
  esCelular,
  guardarCredencialBio,
  guardarNombreBio,
  marcarIngresoConClave,
  soportaHuella,
} from '../lib/biometria'
import { BONO_BIENVENIDA, marcarUsuarioNuevo } from '../lib/onboarding'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { PasswordInput } from '../components/ui/PasswordInput'
import { PasswordStrengthMeter } from '../components/ui/PasswordStrengthMeter'
import { DatePicker } from '../components/ui/DatePicker'
import { TermsModal } from '../components/TermsModal'
import type { RegisterFormData } from '../types'

interface BioOfferInfo {
  userId: string
  nombre: string
  password: string
}

const STEP_TITLES = ['Creá tu cuenta', 'Tus datos', 'Confirmá y listo']
const TOTAL_STEPS = STEP_TITLES.length

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
      guardarCredencialBio(form.email.trim(), bioOfferInfo.password)
      guardarNombreBio(form.email.trim(), form.nombre.trim())
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!aceptaTerminos) {
      setError('Tenés que aceptar los Términos y Condiciones para crear tu cuenta')
      return
    }
    setLoading(true)
    setProgressMessage('Creando...')
    // auth.signUp ya deja la sesión activa y dispara el redirect de PublicOnly
    // antes de que termine el resto del registro (Banco Central + inserts) —
    // esta bandera lo frena hasta el navigate() explícito de más abajo.
    setProvisioning(true)
    let userId: string | null = null
    let quedaOfertaBioPendiente = false
    // Sin trim, un espacio de autocompletado de teclado en el email/DNI puede
    // desincronizar contra un login o chequeo posterior que sí normaliza.
    const nombre = form.nombre.trim()
    const apellido = form.apellido.trim()
    const dni = form.dni.trim()
    const email = form.email.trim()
    const telefono = form.telefono.trim()
    const direccion = form.direccion.trim()

    try {
      setProgressMessage('Creando tu usuario...')
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: {
          data: {
            full_name: `${nombre} ${apellido}`,
            phone: telefono,
          },
        },
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('No se pudo crear el usuario')

      userId = authData.user.id

      setProgressMessage('Generando tu CBU...')
      const { cbu } = await registrarPersona(nombre, apellido, dni)

      const alias = generateAlias()
      await asignarAlias(cbu, alias)

      setProgressMessage('Guardando tus datos...')
      const { error: personaError } = await supabase.from('personas').insert({
        id: userId,
        nombre,
        apellido,
        dni,
        email,
        telefono: telefono || null,
        fecha_nac: form.fecha_nac || null,
        direccion: direccion || null,
      })

      if (personaError) throw personaError

      try {
        // Le informamos al Banco Central una situación crediticia inicial
        // ficticia (una persona puede tener cuentas en varios bancos del
        // curso, y el registro compartido de deudores agrega lo que informa
        // cada uno). No bloquea el registro si falla: Préstamos ya trata un
        // DNI sin informe como situación 1 (ver consultarSituacion).
        const { situacion, monto } = situacionCrediticiaFicticia()
        await informarSituacionCrediticia(dni, monto, situacion)
        await supabase.from('personas').update({
          situacion_crediticia_monix: situacion,
          situacion_informada_at: new Date().toISOString(),
        }).eq('id', userId)
      } catch (err) {
        console.error('No se pudo informar la situación crediticia al Banco Central:', err)
      }

      setProgressMessage('Abriendo tu cuenta...')
      const { data: cuentaNueva, error: cuentaError } = await supabase.from('cuentas').insert({
        persona_id: userId,
        numero_cuenta: generateNumeroCuenta(),
        tipo: 'caja_ahorro',
        saldo: BONO_BIENVENIDA,
        activa: true,
        cbu,
        alias,
      }).select('id').single()

      if (cuentaError) throw cuentaError

      if (cuentaNueva?.id) {
        setProgressMessage('Acreditando tu bono de bienvenida...')
        await supabase.from('movimientos').insert({
          cuenta_id: cuentaNueva.id,
          tipo: 'deposito',
          monto: BONO_BIENVENIDA,
          saldo_resultante: BONO_BIENVENIDA,
          descripcion: 'Bono de bienvenida',
        })
      }

      marcarUsuarioNuevo(userId)
      marcarIngresoConClave()

      // Ofrecemos biometría acá, con la contraseña fresca en memoria, en vez de que el usuario la busque sola en Perfil.
      if (esCelular() && await soportaHuella()) {
        // provisioning sigue en true: bajarlo ya dejaría que PublicOnly redirija a /dashboard sin mostrar esta pantalla.
        quedaOfertaBioPendiente = true
        setBioOfferInfo({ userId, nombre: `${nombre} ${apellido}`, password: form.password })
        setShowBioOffer(true)
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      // Cierra la sesión a medio crear para que PublicOnly no redirija a /dashboard antes de mostrar el error.
      if (userId) {
        await supabase.auth.signOut().catch(() => undefined)
      }
      const msg = err instanceof Error ? err.message : 'Error al registrarse'
      if (msg.includes('already registered')) {
        setError('Ese email ya está registrado')
      } else if (msg.includes('duplicate') && msg.includes('dni')) {
        setError('Ese DNI ya está registrado')
      } else if (err instanceof BancoCentralError && err.status === 409) {
        setError('Ese DNI ya está registrado en el Banco Central')
      } else if (err instanceof BancoCentralError) {
        setError(mensajeAmigableBC(err))
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
      if (!quedaOfertaBioPendiente) setProvisioning(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F0F2F5] dark:bg-navy flex items-center justify-center p-4 py-10">
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
          ) : (
          <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl font-semibold text-navy dark:text-white">{STEP_TITLES[step]}</h2>
            <span className="font-body text-xs text-slate-secondary shrink-0 ml-3">Paso {step + 1} de {TOTAL_STEPS}</span>
          </div>

          <div className="flex gap-1.5 mb-6">
            {STEP_TITLES.map((title, i) => (
              <span
                key={title}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? 'w-8 bg-mint' : i < step ? 'w-4 bg-mint/40' : 'w-4 bg-slate-200 dark:bg-white/10'
                }`}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.form
                key="step-0"
                onSubmit={handleNext}
                className="flex flex-col gap-4"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
              >
                <Input
                  label="Email"
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
              </motion.form>
            )}

            {step === 1 && (
              <motion.form
                key="step-1"
                onSubmit={handleNext}
                className="flex flex-col gap-4"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
              >
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Nombre" name="nombre" placeholder="Juan" value={form.nombre} onChange={handleChange} required autoFocus />
                  <Input label="Apellido" name="apellido" placeholder="Pérez" value={form.apellido} onChange={handleChange} required />
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
                <Input label="Teléfono" type="tel" name="telefono" placeholder="1112345678" value={form.telefono} onChange={handleChange} />
                <DatePicker
                  label="Fecha de nacimiento"
                  value={form.fecha_nac}
                  onChange={(iso) => setForm(prev => ({ ...prev, fecha_nac: iso }))}
                />
                <Input label="Domicilio" name="direccion" placeholder="Av. Corrientes 1234" value={form.direccion} onChange={handleChange} />

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
              </motion.form>
            )}

            {step === 2 && (
              <motion.form
                key="step-2"
                onSubmit={handleSubmit}
                className="flex flex-col gap-4"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
              >
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
                  Al crear tu cuenta te acreditamos un bono de bienvenida y queda lista para usar al instante.
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
              </motion.form>
            )}
          </AnimatePresence>

          <p className="text-center text-sm font-body text-slate-secondary mt-6">
            ¿Ya tenés cuenta?{' '}
            <Link to="/login" className="text-navy dark:text-mint hover:text-navy/70 dark:hover:text-mint-hover transition-colors">
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
