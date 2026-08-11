import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import { useThemeStore } from '../stores/themeStore'
import monixLogoDark from '../assets/logos/logo-blanco.svg'
import monixLogoLight from '../assets/logos/logo-azul.svg'
import { registrarPersona, asignarAlias } from '../services/bancoCentral'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { DatePicker } from '../components/ui/DatePicker'
import type { RegisterFormData } from '../types'

const PALABRAS = [
  'sol', 'mar', 'rio', 'paz', 'luz', 'rey', 'pan', 'oro', 'voz',
  'tren', 'nave', 'isla', 'faro', 'cabo', 'pino', 'roca', 'vino', 'miel',
  'lago', 'flor', 'nube', 'vela', 'luna', 'boca', 'loma', 'duna', 'nota',
  'pala', 'rama', 'zona', 'alba', 'foca', 'lana', 'mano', 'puma', 'ruta',
  'taza', 'arco', 'cima', 'hoja', 'mesa', 'olmo', 'polo', 'soga', 'toro',
]

function generateNumeroCuenta(): string {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString()
}

function generateAlias(): string {
  const pick = () => PALABRAS[Math.floor(Math.random() * PALABRAS.length)]
  return `${pick()}.${pick()}.${pick()}`
}

export function RegisterPage() {
  const navigate = useNavigate()
  const { theme } = useThemeStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
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
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: `${form.nombre} ${form.apellido}`,
            phone: form.telefono,
          },
        },
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('No se pudo crear el usuario')

      const userId = authData.user.id

      const { cbu } = await registrarPersona(form.nombre, form.apellido, form.dni)

      const alias = generateAlias()
      await asignarAlias(cbu, alias)

      const { error: personaError } = await supabase.from('personas').insert({
        id: userId,
        nombre: form.nombre,
        apellido: form.apellido,
        dni: form.dni,
        email: form.email,
        telefono: form.telefono || null,
        fecha_nac: form.fecha_nac || null,
        direccion: form.direccion || null,
      })

      if (personaError) throw personaError

      const { error: cuentaError } = await supabase.from('cuentas').insert({
        persona_id: userId,
        numero_cuenta: generateNumeroCuenta(),
        tipo: 'caja_ahorro',
        saldo: 150000,
        activa: true,
        cbu,
        alias,
      })

      if (cuentaError) throw cuentaError

      localStorage.setItem('monix_new_user', '1')
      navigate('/dashboard')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al registrarse'
      if (msg.includes('already registered')) {
        setError('Ese email ya está registrado')
      } else if (msg.includes('duplicate') && msg.includes('dni')) {
        setError('Ese DNI ya está registrado')
      } else if (msg.includes('409') || msg.toLowerCase().includes('dni')) {
        setError('Ese DNI ya está registrado en el Banco Central')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
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
          <h2 className="font-display text-xl font-semibold text-navy dark:text-white mb-6">Crear cuenta</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Nombre" name="nombre" placeholder="Juan" value={form.nombre} onChange={handleChange} required />
              <Input label="Apellido" name="apellido" placeholder="Pérez" value={form.apellido} onChange={handleChange} required />
            </div>

            <Input label="DNI" name="dni" placeholder="12345678" value={form.dni} onChange={handleChange} required />
            <Input label="Email" type="email" name="email" placeholder="juan@email.com" value={form.email} onChange={handleChange} required />
            <Input label="Teléfono" type="tel" name="telefono" placeholder="1112345678" value={form.telefono} onChange={handleChange} />
            <DatePicker
              label="Fecha de nacimiento"
              value={form.fecha_nac}
              onChange={(iso) => setForm(prev => ({ ...prev, fecha_nac: iso }))}
            />
            <Input label="Domicilio" name="direccion" placeholder="Av. Corrientes 1234" value={form.direccion} onChange={handleChange} />
            <Input label="Contraseña" type="password" name="password" placeholder="Mínimo 6 caracteres" value={form.password} onChange={handleChange} required minLength={6} />

            {error && (
              <p className="text-sm text-red-500 dark:text-red-400 font-body bg-red-50 dark:bg-red-400/10 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <Button type="submit" loading={loading} className="w-full mt-2">
              Crear cuenta
            </Button>
          </form>

          <p className="text-center text-sm font-body text-slate-secondary mt-6">
            ¿Ya tenés cuenta?{' '}
            <Link to="/login" className="text-mint hover:text-mint-hover transition-colors">
              Iniciá sesión
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
