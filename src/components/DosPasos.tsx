import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { mensajeError } from '../lib/errores'
import { esModoPrueba, frenarSiEsPrueba } from '../lib/modoPrueba'
import {
  confirmarActivacion,
  desactivar,
  hayVerificacionActiva,
  nuevosCodigos,
  prepararActivacion,
  type Activacion,
} from '../services/dosPasos'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'

const CODIGO_INCORRECTO = 'Ese código no es correcto o ya venció. Probá con el que muestra tu app ahora.'

type Estado = 'cargando' | 'apagada' | 'activando' | 'activa' | 'desactivando' | 'error'

async function copiar(texto: string, aviso: string) {
  try {
    await navigator.clipboard.writeText(texto)
    toast.success(aviso)
  } catch {
    toast.error('No pudimos copiar. Seleccionalo y copialo a mano.')
  }
}

function descargarCodigos(codigos: string[]) {
  const texto = `Códigos de recuperación de Monix\nCada uno sirve una sola vez. Guardalos en un lugar seguro.\n\n${codigos.join('\n')}\n`
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/plain;charset=utf-8' }))
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = 'monix-codigos-de-recuperacion.txt'
  enlace.click()
  URL.revokeObjectURL(url)
}

export function DosPasos() {
  const [estado, setEstado] = useState<Estado>('cargando')
  const [activacion, setActivacion] = useState<Activacion | null>(null)
  const [codigo, setCodigo] = useState('')
  const [codigos, setCodigos] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function cargar() {
    if (esModoPrueba()) {
      setEstado('apagada')
      return
    }
    setEstado('cargando')
    try {
      setEstado((await hayVerificacionActiva()) ? 'activa' : 'apagada')
    } catch (err) {
      console.error('Error al consultar la verificación en dos pasos:', err)
      setEstado('error')
    }
  }

  useEffect(() => { void cargar() }, [])

  function cambiarCodigo(texto: string) {
    setCodigo(texto.replace(/\D/g, '').slice(0, 6))
  }

  async function empezar() {
    if (frenarSiEsPrueba()) return
    setLoading(true)
    setError('')
    try {
      setActivacion(await prepararActivacion())
      setCodigo('')
      setEstado('activando')
    } catch (err) {
      toast.error(mensajeError(err, 'No pudimos empezar la activación. Probá de nuevo.'))
    } finally {
      setLoading(false)
    }
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    if (!activacion) return
    setLoading(true)
    setError('')
    try {
      const generados = await confirmarActivacion(activacion.factorId, codigo)
      setActivacion(null)
      setCodigo('')
      setEstado('activa')
      setCodigos(generados)
      if (generados) {
        toast.success('Verificación en dos pasos activada. Cerramos tu cuenta en los demás dispositivos.')
      } else {
        toast.error('Quedó activada, pero no pudimos crear tus códigos de recuperación. Generalos ahora.')
      }
    } catch (err) {
      setError(mensajeError(err, CODIGO_INCORRECTO))
      setCodigo('')
    } finally {
      setLoading(false)
    }
  }

  async function apagar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await desactivar(codigo)
      setCodigo('')
      setCodigos(null)
      setEstado('apagada')
      toast.success('Verificación en dos pasos desactivada')
    } catch (err) {
      setError(mensajeError(err, CODIGO_INCORRECTO))
      setCodigo('')
    } finally {
      setLoading(false)
    }
  }

  async function generar() {
    setLoading(true)
    try {
      setCodigos(await nuevosCodigos())
      toast.success('Listo. Los códigos anteriores ya no sirven.')
    } catch (err) {
      toast.error(mensajeError(err, 'No pudimos generar los códigos. Probá de nuevo.'))
    } finally {
      setLoading(false)
    }
  }

  function cancelar() {
    setActivacion(null)
    setCodigo('')
    setError('')
    setEstado(estado === 'desactivando' ? 'activa' : 'apagada')
  }

  return (
    <Card className="p-8">
      <div className="flex items-center gap-3 mb-2">
        <ShieldCheck size={18} className="text-slate-secondary" />
        <h2 className="font-display text-lg font-semibold text-navy dark:text-white">Verificación en dos pasos</h2>
      </div>

      {estado === 'cargando' && (
        <p role="status" className="font-body text-sm text-slate-secondary">Cargando...</p>
      )}

      {estado === 'error' && (
        <div className="flex flex-col items-start gap-3">
          <p className="font-body text-sm text-slate-secondary">No pudimos consultar este ajuste.</p>
          <Button variant="secondary" onClick={() => { void cargar() }} className="min-h-11">Probar de nuevo</Button>
        </div>
      )}

      {estado === 'apagada' && (
        <>
          <p className="font-body text-sm text-slate-secondary mb-4">
            Aunque alguien tenga tu contraseña, sin el código de tu celular no entra. Necesitás una app autenticadora, como Google Authenticator. Es gratis y no usa SMS ni mails.
          </p>
          <Button onClick={() => { void empezar() }} loading={loading} loadingLabel="Preparando..." className="w-full">
            Activar
          </Button>
        </>
      )}

      {estado === 'activando' && activacion && (
        <div className="flex flex-col gap-4">
          <p className="font-body text-sm text-slate-secondary">1. Escaneá este QR con tu app autenticadora.</p>
          <img
            src={activacion.qr}
            alt="Código QR para agregar Monix a tu app autenticadora"
            className="w-48 h-48 mx-auto rounded-xl bg-white p-2"
          />
          <p className="font-body text-sm text-slate-secondary">¿Estás en este mismo celular? Abrila directo o copiá la clave.</p>
          <div className="grid grid-cols-2 gap-3">
            <a
              href={activacion.uri}
              className="min-h-11 flex items-center justify-center rounded-xl border border-slate-300 dark:border-white/20 font-body text-sm font-medium text-navy dark:text-white"
            >
              Abrir la app
            </a>
            <Button
              variant="secondary"
              type="button"
              onClick={() => { void copiar(activacion.clave, 'Clave copiada') }}
              className="min-h-11 !py-2 text-sm"
            >
              Copiar la clave
            </Button>
          </div>
          <p className="font-mono text-xs text-slate-secondary break-all">{activacion.clave}</p>

          <form onSubmit={(e) => { void confirmar(e) }} className="flex flex-col gap-3">
            <Input
              label="2. Escribí el código que te muestra"
              aria-label="Código de 6 números"
              autoComplete="one-time-code"
              inputMode="numeric"
              placeholder="000000"
              value={codigo}
              onChange={(e) => cambiarCodigo(e.target.value)}
              error={error}
            />
            <Button type="submit" loading={loading} loadingLabel="Verificando..." disabled={codigo.length < 6} className="w-full">
              Confirmar
            </Button>
            <Button type="button" variant="ghost" onClick={cancelar} className="w-full min-h-11">Cancelar</Button>
          </form>
        </div>
      )}

      {(estado === 'activa' || estado === 'desactivando') && (
        <p className="font-body text-sm text-slate-secondary mb-4">
          Está activa. Te vamos a pedir el código cada vez que inicies sesión, también con biometría.
        </p>
      )}

      {estado === 'activa' && codigos && (
        <div className="rounded-xl border border-slate-300 dark:border-white/20 p-4 mb-4">
          <h3 className="font-display text-base font-semibold text-navy dark:text-white mb-1">Guardá tus códigos de recuperación</h3>
          <p className="font-body text-sm text-slate-secondary mb-3">
            Te sirven si perdés el celular. Te los mostramos una sola vez y cada uno sirve para un solo ingreso. Sin celular y sin estos códigos no vas a poder entrar por tu cuenta: vas a tener que pedirnos ayuda.
          </p>
          <ul className="grid grid-cols-2 gap-2 mb-4">
            {codigos.map((c) => (
              <li key={c} className="font-mono text-sm text-navy dark:text-white">{c}</li>
            ))}
          </ul>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Button
              variant="secondary"
              onClick={() => { void copiar(codigos.join('\n'), 'Códigos copiados') }}
              className="min-h-11 !py-2 text-sm"
            >
              Copiar
            </Button>
            <Button variant="secondary" onClick={() => descargarCodigos(codigos)} className="min-h-11 !py-2 text-sm">
              Descargar
            </Button>
          </div>
          <Button onClick={() => setCodigos(null)} className="w-full">Ya los guardé</Button>
        </div>
      )}

      {estado === 'activa' && !codigos && (
        <div className="flex flex-col gap-3">
          <Button variant="secondary" onClick={() => { void generar() }} loading={loading} loadingLabel="Generando..." className="w-full">
            Generar códigos de recuperación nuevos
          </Button>
          <Button
            variant="secondary"
            onClick={() => { setError(''); setCodigo(''); setEstado('desactivando') }}
            className="w-full"
          >
            Desactivar
          </Button>
        </div>
      )}

      {estado === 'desactivando' && (
        <form onSubmit={(e) => { void apagar(e) }} className="flex flex-col gap-3">
          <Input
            label="Para desactivarla, escribí el código de tu app"
            aria-label="Código de 6 números"
            autoComplete="one-time-code"
            inputMode="numeric"
            placeholder="000000"
            value={codigo}
            onChange={(e) => cambiarCodigo(e.target.value)}
            error={error}
          />
          <Button type="submit" loading={loading} loadingLabel="Desactivando..." disabled={codigo.length < 6} className="w-full">
            Desactivar
          </Button>
          <Button type="button" variant="ghost" onClick={cancelar} className="w-full min-h-11">Cancelar</Button>
        </form>
      )}
    </Card>
  )
}
