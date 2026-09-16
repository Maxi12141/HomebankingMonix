import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Fingerprint } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../store/authStore'
import { esCancelacionBiometrica, verificarHuella } from '../lib/biometria'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import monixLogo from '../assets/logos/logo-blanco.svg'

interface Props {
  onUnlock: () => void
}

export function HuellaLockScreen({ onUnlock }: Props) {
  const { user, persona } = useAuthStore()
  const [error, setError] = useState('')
  const [conClave, setConClave] = useState(false)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const askedRef = useRef(false)

  async function pedirHuella() {
    if (!user) return
    setError('')
    setLoading(true)
    try {
      await verificarHuella(user.id)
      onUnlock()
    } catch (err) {
      if (!esCancelacionBiometrica(err)) {
        setError(err instanceof Error ? err.message : 'No se pudo validar la huella')
      } else {
        setError('No se reconoció. Probá de nuevo.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (askedRef.current || !user) return
    askedRef.current = true
    const t = window.setTimeout(() => { void pedirHuella() }, 420)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function entrarConClave(e: React.FormEvent) {
    e.preventDefault()
    if (!persona) return
    setLoading(true)
    setError('')
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: persona.email,
        password,
      })
      if (authError) {
        setError('Contraseña incorrecta')
        return
      }
      onUnlock()
    } catch {
      toast.error('No se pudo validar la contraseña')
    } finally {
      setLoading(false)
    }
  }

  const nombre = persona?.nombre ?? ''

  return (
    <motion.div
      className="fixed inset-0 z-[10000] bg-navy flex flex-col items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <img src={monixLogo} alt="Monix" className="h-8 w-auto mb-10 opacity-90" />

      <p className="font-display text-2xl font-semibold text-white mb-1">
        Hola{nombre ? `, ${nombre}` : ''}
      </p>
      <p className="font-body text-sm text-white/55 mb-10 text-center">
        {conClave ? 'Ingresá tu contraseña para continuar' : 'Desbloqueá con tu huella para entrar'}
      </p>

      {!conClave && (
        <button
          type="button"
          onClick={() => { void pedirHuella() }}
          className="relative flex h-36 w-36 items-center justify-center mb-8"
          aria-label="Ingresar con huella"
        >
          <span className="huella-ring absolute inset-0 rounded-full border border-mint/25" />
          <span className="huella-ring huella-ring-delay absolute inset-3 rounded-full border border-mint/40" />
          <span className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-mint/15 border border-mint/40">
            <Fingerprint size={40} className="text-mint" strokeWidth={1.6} />
          </span>
        </button>
      )}

      {error && (
        <p className="font-body text-sm text-red-400 text-center mb-4 max-w-xs">{error}</p>
      )}

      {conClave ? (
        <form onSubmit={(e) => { void entrarConClave(e) }} className="w-full max-w-xs flex flex-col gap-3">
          <Input
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
          <Button type="submit" loading={loading} className="w-full">
            Entrar
          </Button>
          <button
            type="button"
            onClick={() => { setConClave(false); setError('') }}
            className="font-body text-sm text-mint"
          >
            Volver a la huella
          </button>
        </form>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <Button type="button" loading={loading} onClick={() => { void pedirHuella() }}>
            Usar huella
          </Button>
          <button
            type="button"
            onClick={() => { setConClave(true); setError('') }}
            className="font-body text-sm text-white/60 hover:text-white transition-colors"
          >
            Usar contraseña
          </button>
        </div>
      )}
    </motion.div>
  )
}
