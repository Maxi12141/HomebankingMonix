import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'
import { useThemeStore } from '../stores/themeStore'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import monixLogoDark from '../assets/logos/logo-blanco.svg'
import monixLogoLight from '../assets/logos/logo-azul.svg'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const { theme } = useThemeStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch {
      setError('Email o contraseña incorrectos')
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
          <p className="font-body text-slate-secondary">Tu banco digital, simple y seguro</p>
        </div>

        <div className="bg-white dark:bg-navy-card rounded-2xl border border-slate-200 dark:border-white/10 p-8 shadow-sm dark:shadow-none">
          <h2 className="font-display text-xl font-semibold text-navy dark:text-white mb-6">Iniciar sesión</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Contraseña"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
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
