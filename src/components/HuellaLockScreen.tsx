import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Fingerprint, ScanFace } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../store/authStore'
import { esCancelacionBiometrica, metodosBio, verificarHuella } from '../lib/biometria'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import monixLogo from '../assets/logos/logo-blanco.svg'

interface Props {
  onUnlock: () => void
}

export function HuellaLockScreen({ onUnlock }: Props) {
  const { user, persona } = useAuthStore()
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [loadingBio, setLoadingBio] = useState(false)
  const [loadingClave, setLoadingClave] = useState(false)
  const metodos = user ? metodosBio(user.id) : { huella: false, face: false }

  const email = persona?.email || user?.email || ''
  const nombre = persona?.nombre ?? ''

  async function pedirBiometria() {
    if (!user) return
    setError('')
    setLoadingBio(true)
    try {
      await verificarHuella(user.id)
      onUnlock()
    } catch (err) {
      if (esCancelacionBiometrica(err)) {
        setError('No se pudo leer. Entrá con tu contraseña.')
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo validar. Entrá con tu contraseña.')
      }
    } finally {
      setLoadingBio(false)
    }
  }

  useEffect(() => {
    const t = window.setTimeout(() => { void pedirBiometria() }, 350)
    return () => window.clearTimeout(t)
  }, [])

  async function entrarConClave(e: React.FormEvent) {
    e.preventDefault()
    if (!email) {
      setError('No encontramos el email de la cuenta. Cerrá sesión e ingresá de nuevo.')
      return
    }
    setLoadingClave(true)
    setError('')
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (authError) {
        setError('Contraseña incorrecta')
        return
      }
      onUnlock()
    } catch {
      setError('No se pudo validar la contraseña')
    } finally {
      setLoadingClave(false)
    }
  }

  async function cerrarSesion() {
    await supabase.auth.signOut()
  }

  const subtitulo = metodos.huella && metodos.face
    ? 'Entrá con huella, Face ID o tu contraseña.'
    : metodos.face
      ? 'Entrá con Face ID o tu contraseña.'
      : 'Entrá con tu huella o tu contraseña.'

  return (
    <motion.div
      className="fixed inset-0 z-[10000] bg-navy flex flex-col items-center justify-center px-6 overflow-y-auto py-10 pt-[max(2.5rem,env(safe-area-inset-top))]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <img src={monixLogo} alt="Monix" className="h-8 w-auto mb-8 opacity-90" />

      <p className="font-display text-2xl font-semibold text-white mb-1">
        Hola{nombre ? `, ${nombre}` : ''}
      </p>
      <p className="font-body text-sm text-white/55 mb-8 text-center max-w-xs">
        {subtitulo}
      </p>

      <div className="flex items-center justify-center gap-6 mb-6">
        {metodos.huella && (
          <button
            type="button"
            onClick={() => { void pedirBiometria() }}
            className="relative flex h-28 w-28 items-center justify-center"
            aria-label="Ingresar con huella"
          >
            <span className="huella-ring absolute inset-0 rounded-full border border-mint/25" />
            <span className="huella-ring huella-ring-delay absolute inset-3 rounded-full border border-mint/40" />
            <span className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-mint/15 border border-mint/40">
              <Fingerprint size={34} className="text-mint" strokeWidth={1.6} />
            </span>
          </button>
        )}
        {metodos.face && (
          <button
            type="button"
            onClick={() => { void pedirBiometria() }}
            className="relative flex h-28 w-28 items-center justify-center"
            aria-label="Ingresar con Face ID"
          >
            <span className="huella-ring absolute inset-0 rounded-full border border-mint/25" />
            <span className="huella-ring huella-ring-delay absolute inset-3 rounded-full border border-mint/40" />
            <span className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-mint/15 border border-mint/40">
              <ScanFace size={34} className="text-mint" strokeWidth={1.6} />
            </span>
          </button>
        )}
      </div>

      <Button
        type="button"
        loading={loadingBio}
        onClick={() => { void pedirBiometria() }}
        className="w-full max-w-xs mb-6"
      >
        {metodos.huella && metodos.face
          ? 'Usar huella o Face ID'
          : metodos.face
            ? 'Usar Face ID'
            : 'Usar huella'}
      </Button>

      {error && (
        <p className="font-body text-sm text-red-400 text-center mb-4 max-w-xs">{error}</p>
      )}

      <form onSubmit={(e) => { void entrarConClave(e) }} className="w-full max-w-xs flex flex-col gap-3">
        <Input
          label="Contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" loading={loadingClave} className="w-full">
          Entrar con contraseña
        </Button>
      </form>

      <button
        type="button"
        onClick={() => { void cerrarSesion() }}
        className="font-body text-sm text-white/50 hover:text-white mt-8 transition-colors"
      >
        Cerrar sesión
      </button>
    </motion.div>
  )
}
