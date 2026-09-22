import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MailCheck } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useThemeStore } from '../stores/themeStore'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import monixLogoDark from '../assets/logos/logo-blanco.svg'
import monixLogoLight from '../assets/logos/logo-azul.svg'

export function ForgotPasswordPage() {
  const { theme } = useThemeStore()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/restablecer-contrasena`,
      })
      if (err) throw err
      // No confirmamos si el email existe o no en la respuesta: evita que alguien use este
      // formulario para averiguar qué emails están registrados en Monix.
      setEnviado(true)
    } catch {
      setError('No pudimos enviar el mail. Probá de nuevo en un momento.')
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
          <p className="font-body text-slate-secondary">Recuperá el acceso a tu cuenta</p>
        </div>

        <div className="bg-white dark:bg-navy-card rounded-2xl border border-slate-200 dark:border-white/10 p-8 shadow-sm dark:shadow-none">
          {enviado ? (
            <div className="text-center py-2">
              <div className="w-14 h-14 rounded-full bg-mint/15 text-mint flex items-center justify-center mx-auto mb-4">
                <MailCheck size={26} />
              </div>
              <h2 className="font-display text-xl font-semibold text-navy dark:text-white mb-2">Revisá tu email</h2>
              <p className="font-body text-sm text-slate-secondary mb-6">
                Si <span className="font-medium text-navy dark:text-white">{email.trim()}</span> tiene una cuenta en Monix,
                te mandamos un link para elegir una contraseña nueva.
              </p>
              <Link
                to="/login"
                className="text-mint hover:text-mint-hover transition-colors font-body text-sm font-medium"
              >
                ‹ Volver a iniciar sesión
              </Link>
            </div>
          ) : (
            <>
              <h2 className="font-display text-xl font-semibold text-navy dark:text-white mb-1">¿Olvidaste tu contraseña?</h2>
              <p className="font-body text-sm text-slate-secondary mb-6">
                Ingresá el email de tu cuenta y te mandamos un link para restablecerla.
              </p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                  label="Email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
                {error && (
                  <p className="text-sm text-red-500 dark:text-red-400 font-body bg-red-50 dark:bg-red-400/10 rounded-xl px-4 py-3">
                    {error}
                  </p>
                )}
                <Button type="submit" loading={loading} className="w-full mt-2">
                  Enviar link de recuperación
                </Button>
              </form>
              <p className="text-center text-sm font-body text-slate-secondary mt-6">
                <Link to="/login" className="text-mint hover:text-mint-hover transition-colors">
                  ‹ Volver a iniciar sesión
                </Link>
              </p>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
