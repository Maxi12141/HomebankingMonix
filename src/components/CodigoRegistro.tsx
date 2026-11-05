import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { mensajeError } from '../lib/errores'
import { ESPERA_REENVIO_MS, minutosYSegundos, VIGENCIA_CODIGO_MS } from '../utils/codigoRegistro'
import { Button } from './ui/Button'
import { Input } from './ui/Input'

interface CodigoRegistroProps {
  email: string
  progreso: string
  onVerificar: (codigo: string) => Promise<void>
  onReenviar: () => Promise<void>
  onCorregir: () => void
}

const CODIGO_INCORRECTO = 'Ese código no es correcto o ya venció. Revisalo o pedí uno nuevo.'

export function CodigoRegistro({ email, progreso, onVerificar, onReenviar, onCorregir }: CodigoRegistroProps) {
  const [codigo, setCodigo] = useState('')
  const [verificando, setVerificando] = useState(false)
  const [reenviando, setReenviando] = useState(false)
  const [error, setError] = useState('')
  const [venceEn, setVenceEn] = useState(() => Date.now() + VIGENCIA_CODIGO_MS)
  const [reenvioEn, setReenvioEn] = useState(() => Date.now() + ESPERA_REENVIO_MS)
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const vencido = ahora >= venceEn
  const puedeReenviar = ahora >= reenvioEn

  async function verificar(valor: string) {
    if (verificando || vencido) return
    setVerificando(true)
    setError('')
    try {
      // Si sale bien, RegisterPage sigue con el alta y cambia de pantalla.
      await onVerificar(valor)
    } catch (err) {
      setError(mensajeError(err, CODIGO_INCORRECTO))
      setCodigo('')
    } finally {
      setVerificando(false)
    }
  }

  function cambiarCodigo(texto: string) {
    const digitos = texto.replace(/\D/g, '').slice(0, 6)
    setCodigo(digitos)
    if (digitos.length === 6) void verificar(digitos)
  }

  async function reenviar() {
    setReenviando(true)
    setError('')
    try {
      await onReenviar()
      const momento = Date.now()
      setAhora(momento)
      setVenceEn(momento + VIGENCIA_CODIGO_MS)
      setReenvioEn(momento + ESPERA_REENVIO_MS)
      setCodigo('')
      toast.success('Te mandamos un código nuevo')
    } catch (err) {
      setError(mensajeError(err, 'No pudimos mandar el código. Probá de nuevo en un minuto.'))
    } finally {
      setReenviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-xl font-semibold text-navy dark:text-white">Revisá tu mail</h2>
      <p className="font-body text-sm text-slate-secondary">
        Mandamos un código de 6 números a <span className="font-medium text-navy dark:text-white break-all">{email}</span>. Si no lo ves, mirá en spam.
      </p>

      <form
        onSubmit={(e) => { e.preventDefault(); if (codigo.length === 6) void verificar(codigo) }}
        className="flex flex-col gap-4"
      >
        <Input
          aria-label="Código de 6 números"
          autoFocus
          autoComplete="one-time-code"
          inputMode="numeric"
          placeholder="000000"
          value={codigo}
          onChange={(e) => cambiarCodigo(e.target.value)}
          disabled={vencido || verificando}
          className="text-center text-2xl tracking-[0.3em] tabular-nums"
        />
        <p className={`font-body text-sm text-center ${vencido ? 'text-red-500 dark:text-red-400' : 'text-slate-secondary'}`} role={vencido ? 'alert' : undefined}>
          {vencido ? 'El código venció. Pedí uno nuevo.' : `Vence en ${minutosYSegundos(venceEn - ahora)}`}
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-500 dark:text-red-400 font-body bg-red-50 dark:bg-red-400/10 rounded-xl px-4 py-3">
            {error}
          </p>
        )}
        {verificando && (
          <p role="status" className="text-center text-xs font-body text-slate-secondary">{progreso}</p>
        )}
        <Button type="submit" loading={verificando} loadingLabel="Verificando..." disabled={codigo.length < 6 || vencido} className="w-full">
          Confirmar
        </Button>
      </form>

      <Button
        type="button"
        variant="secondary"
        loading={reenviando}
        loadingLabel="Enviando..."
        disabled={!puedeReenviar || verificando}
        onClick={() => { void reenviar() }}
        className="w-full"
      >
        {puedeReenviar ? 'Mandar otro código' : `Mandar otro código en ${minutosYSegundos(reenvioEn - ahora)}`}
      </Button>
      <button
        type="button"
        onClick={onCorregir}
        disabled={verificando}
        className="min-h-11 font-body text-sm font-medium text-navy dark:text-mint underline underline-offset-2"
      >
        Corregir mi mail
      </button>
    </div>
  )
}
