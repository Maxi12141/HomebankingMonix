import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { KeyRound } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import { useThemeStore } from '../stores/themeStore'
import { Button } from '../components/ui/Button'
import { PasswordInput } from '../components/ui/PasswordInput'
import monixLogoDark from '../assets/logos/logo-blanco.svg'
import monixLogoLight from '../assets/logos/logo-azul.svg'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const { theme } = useThemeStore()
  const [listo, setListo] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // El link del mail autentica solo (sesión de "recovery"): supabase-js la procesa
    // sola al cargar la página — sólo hace falta confirmar que ya está lista.
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setError('Este link ya venció o no es válido. Pedí uno nuevo.')
      }
      setListo(true)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden')
      return
    }
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw err
      toast.success('Contraseña actualizada')
      navigate('/dashboard')
    } catch {
      setError('No pudimos actualizar la contraseña. Pedí un link nuevo e intentá de nuevo.')
    } finally {
      setLoading(false)
    }
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
          <p className="font-body text-slate-secondary">Elegí tu nueva contraseña</p>
        </div>

        <div className="bg-white dark:bg-navy-card rounded-2xl border border-slate-200 dark:border-white/10 p-8 shadow-sm dark:shadow-none">
          <div className="w-14 h-14 rounded-full bg-mint/15 text-mint flex items-center justify-center mx-auto mb-5">
            <KeyRound size={26} />
          </div>

          {!listo ? (
            <p className="text-center font-body text-sm text-slate-secondary">Verificando el link…</p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <PasswordInput
                label="Contraseña nueva"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoFocus
              />
              <PasswordInput
                label="Repetí la contraseña nueva"
                placeholder="Mínimo 6 caracteres"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                required
                minLength={6}
              />
              {error && (
                <p className="text-sm text-red-500 dark:text-red-400 font-body bg-red-50 dark:bg-red-400/10 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}
              <Button type="submit" loading={loading} className="w-full mt-2">
                Guardar contraseña nueva
              </Button>
            </form>
          )}

          <p className="text-center text-sm font-body text-slate-secondary mt-6">
            <Link to="/login" className="text-mint hover:text-mint-hover transition-colors">
              ‹ Volver a iniciar sesión
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
