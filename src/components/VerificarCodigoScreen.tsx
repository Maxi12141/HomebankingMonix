import { useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import { mensajeError } from '../lib/errores'
import { usarCodigoRecuperacion, verificarCodigo } from '../services/dosPasos'
import { recordarEsteDispositivo } from '../services/dispositivoConfianza'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import monixLogo from '../assets/logos/logo-blanco.svg'

const CODIGO_INCORRECTO = 'Ese código no es correcto o ya venció. Probá con el que muestra tu app ahora.'

/** Segundo paso del ingreso. Mientras se muestra, la app no pide ningún dato de la cuenta. */
export function VerificarCodigoScreen() {
  const [modo, setModo] = useState<'codigo' | 'recuperacion'>('codigo')
  const [codigo, setCodigo] = useState('')
  const [recuperacion, setRecuperacion] = useState('')
  const [recordar, setRecordar] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function enviarCodigo(valor: string) {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      // Al verificar, useAuth recibe la sesión nueva y esta pantalla se va sola.
      await verificarCodigo(valor)
      if (recordar) await recordarEsteDispositivo()
    } catch (err) {
      setError(mensajeError(err, CODIGO_INCORRECTO))
      setCodigo('')
    } finally {
      setLoading(false)
    }
  }

  function cambiarCodigo(texto: string) {
    const digitos = texto.replace(/\D/g, '').slice(0, 6)
    setCodigo(digitos)
    if (digitos.length === 6) void enviarCodigo(digitos)
  }

  async function enviarRecuperacion(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const sirvio = await usarCodigoRecuperacion(recuperacion)
      if (sirvio) {
        toast.success('Apagamos la verificación en dos pasos. Volvé a activarla desde Perfil.')
      } else {
        setError('Ese código no sirve o ya se usó. Revisalo y probá de nuevo.')
      }
    } catch (err) {
      setError(mensajeError(err, 'No pudimos comprobar el código. Probá de nuevo en un momento.'))
    } finally {
      setLoading(false)
    }
  }

  function cambiarModo(nuevo: 'codigo' | 'recuperacion') {
    setModo(nuevo)
    setError('')
  }

  return (
    <motion.main
      className="dark fixed inset-0 z-[10000] bg-navy flex flex-col items-center justify-center px-6 overflow-y-auto py-10 pt-[max(2.5rem,env(safe-area-inset-top))]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <img src={monixLogo} alt="Monix" className="h-8 w-auto mb-8" />

      {modo === 'codigo' ? (
        <>
          <h1 className="font-display text-2xl font-semibold text-white mb-2 text-center">Ingresá tu código</h1>
          <p className="font-body text-sm text-white/70 mb-8 text-center max-w-xs">
            Abrí tu app autenticadora y escribí los 6 números que muestra para Monix.
          </p>
          <form
            onSubmit={(e) => { e.preventDefault(); if (codigo.length === 6) void enviarCodigo(codigo) }}
            className="w-full max-w-xs flex flex-col gap-4"
          >
            <Input
              aria-label="Código de 6 números"
              autoFocus
              autoComplete="one-time-code"
              inputMode="numeric"
              placeholder="000000"
              value={codigo}
              onChange={(e) => cambiarCodigo(e.target.value)}
              className="text-center text-2xl tracking-[0.3em] tabular-nums"
            />
            <Button type="submit" loading={loading} loadingLabel="Verificando..." disabled={codigo.length < 6} className="w-full">
              Verificar
            </Button>
            <label className="min-h-11 flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={recordar}
                onChange={(e) => setRecordar(e.target.checked)}
                className="h-5 w-5 accent-mint shrink-0"
              />
              <span className="font-body text-sm text-white/70">Recordar este dispositivo. No lo marques en una compu ajena.</span>
            </label>
          </form>
        </>
      ) : (
        <>
          <h1 className="font-display text-2xl font-semibold text-white mb-2 text-center">Usá un código de recuperación</h1>
          <p className="font-body text-sm text-white/70 mb-8 text-center max-w-xs">
            Es uno de los 8 que guardaste al activar la verificación en dos pasos. Al usarlo la apagamos y cerramos tu cuenta en los demás dispositivos.
          </p>
          <form onSubmit={(e) => { void enviarRecuperacion(e) }} className="w-full max-w-xs flex flex-col gap-4">
            <Input
              aria-label="Código de recuperación"
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="XXXXX-XXXXX"
              value={recuperacion}
              onChange={(e) => setRecuperacion(e.target.value)}
              required
              className="text-center tracking-wider"
            />
            <Button type="submit" loading={loading} loadingLabel="Comprobando..." className="w-full">
              Usar código
            </Button>
          </form>
        </>
      )}

      {error && (
        <p role="alert" className="font-body text-sm text-red-400 text-center mt-4 max-w-xs">{error}</p>
      )}

      <div className="mt-6 flex flex-col items-center">
        <button
          type="button"
          onClick={() => cambiarModo(modo === 'codigo' ? 'recuperacion' : 'codigo')}
          className="min-h-11 px-3 font-body text-sm font-medium text-mint"
        >
          {modo === 'codigo' ? 'Perdí mi celular' : 'Tengo mi código de 6 números'}
        </button>
        <button
          type="button"
          onClick={() => { void supabase.auth.signOut() }}
          className="min-h-11 px-3 font-body text-sm text-white/70 hover:text-white transition-colors"
        >
          Salir
        </button>
      </div>
    </motion.main>
  )
}
