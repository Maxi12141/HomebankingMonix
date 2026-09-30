import { useEffect, useState } from 'react'
import { Check, Zap } from 'lucide-react'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useContactos } from '../hooks/useContactos'
import { formatMonto } from '../utils/cuenta'
import {
  buscarPersonaAhora,
  cancelarCobroAhora,
  crearCobroAhora,
  miCobroAhora,
  type CobroAhora,
  type PersonaAhora,
} from '../services/ahora'
import { supabase } from '../lib/supabaseClient'

function restante(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return '0:00'
  const total = Math.ceil(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function AhoraPage() {
  const { contactos } = useContactos()
  const [alias, setAlias] = useState('')
  const [monto, setMonto] = useState('')
  const [concepto, setConcepto] = useState('')
  const [persona, setPersona] = useState<PersonaAhora | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [cobro, setCobro] = useState<CobroAhora | null>(null)
  const [tiempo, setTiempo] = useState('')

  const frecuentes = contactos.filter((c) => c.alias).slice(0, 6)

  useEffect(() => {
    let vivo = true
    void miCobroAhora()
      .then((row) => { if (vivo && row) setCobro(row) })
      .catch(() => undefined)
    return () => { vivo = false }
  }, [])

  useEffect(() => {
    if (!cobro || cobro.estado !== 'pendiente') return
    let channel: ReturnType<typeof supabase.channel> | null = null
    const leer = () => {
      void miCobroAhora().then((row) => setCobro(row)).catch(() => undefined)
    }
    const timer = window.setInterval(leer, 2000)
    try {
      channel = supabase
        .channel(`ahora-out-${cobro.id}-${Math.random().toString(36).slice(2, 7)}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'cobros_ahora',
          filter: `id=eq.${cobro.id}`,
        }, leer)
        .subscribe()
    } catch {
      /* el intervalo alcanza si Realtime no conecta */
    }
    return () => {
      window.clearInterval(timer)
      const ch = channel
      window.setTimeout(() => {
        if (ch) void supabase.removeChannel(ch)
      }, 400)
    }
  }, [cobro?.id, cobro?.estado])

  useEffect(() => {
    if (!cobro || cobro.estado !== 'pendiente') return
    const tick = window.setInterval(() => setTiempo(restante(cobro.expires_at)), 250)
    setTiempo(restante(cobro.expires_at))
    return () => window.clearInterval(tick)
  }, [cobro])

  useEffect(() => {
    const limpio = alias.trim().replace(/^@/, '')
    if (limpio.length < 3) {
      setPersona(null)
      setError('')
      return
    }
    let vivo = true
    const timer = window.setTimeout(() => {
      setBuscando(true)
      void buscarPersonaAhora(limpio)
        .then((row) => { if (vivo) { setPersona(row); setError('') } })
        .catch((err: unknown) => {
          if (!vivo) return
          setPersona(null)
          setError(err instanceof Error ? err.message : 'No encontramos ese alias')
        })
        .finally(() => { if (vivo) setBuscando(false) })
    }, 350)
    return () => {
      vivo = false
      window.clearTimeout(timer)
    }
  }, [alias])

  async function cobrar() {
    const n = parseFloat(monto.replace(',', '.'))
    if (!persona) {
      setError('Elegí a quién le vas a cobrar')
      return
    }
    if (!Number.isFinite(n) || n < 1) {
      setError('El monto mínimo es $1')
      return
    }
    setEnviando(true)
    setError('')
    try {
      const row = await crearCobroAhora(persona.alias, n, concepto.trim())
      setCobro(row)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el cobro')
    } finally {
      setEnviando(false)
    }
  }

  async function cancelar() {
    if (!cobro) return
    try {
      await cancelarCobroAhora(cobro.id)
      setCobro(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cancelar')
    }
  }

  const nombre = cobro ? `${cobro.nombre} ${cobro.apellido}`.trim() : ''

  return (
    <PageWrapper>
      <div className="max-w-lg mx-auto">
        <h1 className="font-display text-2xl font-semibold text-navy dark:text-white">
          Monix Ahora
        </h1>
        <p className="font-body text-sm text-slate-secondary mt-1 mb-6">
          Le cobrás a alguien con cuenta Monix. En su celular aparece tu nombre y el monto: acepta y se paga.
        </p>

        {cobro?.estado === 'pendiente' ? (
          <Card className="p-6 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-mint/15 text-mint flex items-center justify-center mb-4">
              <Zap size={26} className="animate-pulse" />
            </div>
            <p className="font-display text-lg font-semibold text-navy dark:text-white">
              Esperando a {nombre}
            </p>
            <p className="font-display text-3xl font-bold text-navy dark:text-mint mt-2">
              {formatMonto(cobro.monto, 'ARS')}
            </p>
            {cobro.concepto && (
              <p className="font-body text-sm text-slate-secondary mt-1">{cobro.concepto}</p>
            )}
            <p className="font-body text-sm text-slate-secondary mt-3">
              Le queda {tiempo} para aceptar.
            </p>
            <Button type="button" variant="secondary" className="mt-5" onClick={() => { void cancelar() }}>
              Cancelar cobro
            </Button>
          </Card>
        ) : cobro?.estado === 'pagado' ? (
          <Card className="p-6 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-mint/15 text-mint flex items-center justify-center mb-4">
              <Check size={26} />
            </div>
            <p className="font-display text-lg font-semibold text-navy dark:text-white">
              {nombre} pagó
            </p>
            <p className="font-display text-3xl font-bold text-navy dark:text-mint mt-2">
              {formatMonto(cobro.monto, 'ARS')}
            </p>
            <Button type="button" className="mt-5" onClick={() => setCobro(null)}>
              Cobrar otro
            </Button>
          </Card>
        ) : (
          <Card className="p-5">
            {cobro && (
              <p className="font-body text-sm text-slate-secondary mb-4">
                {cobro.estado === 'rechazado' && `${nombre} no aceptó el cobro.`}
                {cobro.estado === 'vencido' && 'Se venció el tiempo y nadie pagó.'}
                {cobro.estado === 'cancelado' && 'Cancelaste el cobro.'}
              </p>
            )}
            <div className="flex flex-col gap-4">
              <Input
                label="Alias de quien paga"
                placeholder="sol.mar.rio"
                value={alias}
                autoCapitalize="off"
                autoCorrect="off"
                onChange={(e) => setAlias(e.target.value)}
              />
              {frecuentes.length > 0 && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {frecuentes.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setAlias(c.alias ?? '')}
                      className="shrink-0 rounded-full border border-slate-200 dark:border-white/10 px-3 py-1.5 font-body text-xs text-navy dark:text-white hover:border-mint"
                    >
                      {c.apodo || `${c.nombre} ${c.apellido}`}
                    </button>
                  ))}
                </div>
              )}
              {persona && (
                <p className="font-body text-sm text-navy dark:text-white">
                  Le vas a cobrar a <span className="font-semibold">{persona.nombre} {persona.apellido}</span>
                  <span className="text-slate-secondary"> · @{persona.alias}</span>
                </p>
              )}
              {buscando && !persona && (
                <p className="font-body text-xs text-slate-secondary">Buscando…</p>
              )}
              <Input
                label="Monto"
                inputMode="decimal"
                placeholder="4000"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
              <Input
                label="Concepto"
                placeholder="Pizza, Uber, apunte"
                maxLength={40}
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
              />
              {error && (
                <p className="font-body text-sm text-red-500 dark:text-red-400">{error}</p>
              )}
              <Button
                type="button"
                loading={enviando}
                loadingLabel="Enviando..."
                disabled={!persona}
                onClick={() => { void cobrar() }}
              >
                Cobrar ahora
              </Button>
            </div>
          </Card>
        )}
      </div>
    </PageWrapper>
  )
}
