import { useEffect, useState } from 'react'
import { ArrowLeft, Check, Copy, Plus, Share2, Target, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSearchParams } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { MetasAyuda } from '../components/MetasAyuda'
import { compartirTexto } from '../utils/compartir'
import { useCuenta } from '../hooks/useCuenta'
import { formatMonto } from '../utils/cuenta'
import {
  aportarMetaComun,
  crearMetaComun,
  detalleMetaComun,
  invitarMetaComun,
  listarMetasComunes,
  proponerDesembolsoMeta,
  unirseMetaComun,
  votarMetaComun,
  type MetaAporte,
  type MetaDetalle,
  type MetaResumen,
} from '../services/metasComunes'

function ars(n: number) {
  return formatMonto(n, 'ARS')
}

function etiquetaAporte(a: MetaAporte) {
  if (a.tipo === 'rendimiento') return 'Rendimiento del pool'
  if (a.tipo === 'pago') return 'Pago de la meta'
  if (a.tipo === 'devolucion') return 'Devolución a integrantes'
  const quien = [a.nombre, a.apellido].filter(Boolean).join(' ')
  return quien || 'Aporte'
}

function estadoMeta(estado: MetaResumen['estado']) {
  if (estado === 'votacion') return 'Votando el desembolso'
  if (estado === 'desembolsada') return 'Ya se desembolsó'
  return 'Juntando'
}

export function MetasPage() {
  const { cuentas, refreshCuenta } = useCuenta()
  const cuentaArs = cuentas.find((c) => c.moneda === 'ARS')
  const [params, setParams] = useSearchParams()
  const codigoUrl = (params.get('codigo') ?? '').trim()

  const [lista, setLista] = useState<MetaResumen[]>([])
  const [detalle, setDetalle] = useState<MetaDetalle | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [crear, setCrear] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [proposito, setProposito] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [codigo, setCodigo] = useState(codigoUrl)
  const [aliasInvitar, setAliasInvitar] = useState('')
  const [monto, setMonto] = useState('')
  const [destino, setDestino] = useState('')
  const [conceptoPago, setConceptoPago] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [copiado, setCopiado] = useState(false)

  async function cargarLista() {
    setCargando(true)
    setError('')
    try {
      setLista(await listarMetasComunes())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las metas')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    void cargarLista()
  }, [])

  useEffect(() => {
    if (!codigoUrl) return
    let vivo = true
    void (async () => {
      setEnviando(true)
      try {
        const row = await unirseMetaComun(codigoUrl)
        if (!vivo) return
        setDetalle(row)
        setParams({}, { replace: true })
        toast.success(`Entraste a ${row.titulo}`)
        setLista(await listarMetasComunes())
      } catch (err) {
        if (vivo) setError(err instanceof Error ? err.message : 'No se pudo entrar con ese código')
      } finally {
        if (vivo) setEnviando(false)
      }
    })()
    return () => { vivo = false }
  }, [codigoUrl, setParams])

  async function abrir(id: string) {
    setError('')
    try {
      setDetalle(await detalleMetaComun(id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir la meta')
    }
  }

  async function onCrear(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setError('')
    try {
      const obj = parseFloat(objetivo.replace(',', '.'))
      const row = await crearMetaComun(
        titulo.trim(),
        proposito.trim(),
        Number.isFinite(obj) && obj > 0 ? obj : null,
      )
      setDetalle(row)
      setCrear(false)
      setTitulo('')
      setProposito('')
      setObjetivo('')
      await cargarLista()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la meta')
    } finally {
      setEnviando(false)
    }
  }

  async function onUnirse(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setError('')
    try {
      const row = await unirseMetaComun(codigo)
      setDetalle(row)
      setCodigo('')
      await cargarLista()
      toast.success(`Entraste a ${row.titulo}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo entrar')
    } finally {
      setEnviando(false)
    }
  }

  async function onAportar(e: React.FormEvent) {
    e.preventDefault()
    if (!detalle || !cuentaArs) return
    const n = parseFloat(monto.replace(',', '.'))
    setEnviando(true)
    setError('')
    try {
      const row = await aportarMetaComun(detalle.id, cuentaArs.id, n)
      setDetalle(row)
      setMonto('')
      await refreshCuenta()
      await cargarLista()
      toast.success('Aporte acreditado en la meta')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aportar')
    } finally {
      setEnviando(false)
    }
  }

  async function onInvitar(e: React.FormEvent) {
    e.preventDefault()
    if (!detalle) return
    setEnviando(true)
    setError('')
    try {
      const row = await invitarMetaComun(detalle.id, aliasInvitar)
      setDetalle(row)
      setAliasInvitar('')
      toast.success('Se sumó a la meta')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo invitar')
    } finally {
      setEnviando(false)
    }
  }

  async function onProponer(tipo: 'pagar' | 'devolver') {
    if (!detalle) return
    setEnviando(true)
    setError('')
    try {
      const row = await proponerDesembolsoMeta(
        detalle.id,
        tipo,
        tipo === 'pagar' ? destino : '',
        conceptoPago,
      )
      setDetalle(row)
      setDestino('')
      setConceptoPago('')
      await refreshCuenta()
      await cargarLista()
      if (row.estado === 'desembolsada') toast.success('El desembolso salió')
      else toast.success('Quedó abierta la votación')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo proponer')
    } finally {
      setEnviando(false)
    }
  }

  async function onVotar(aFavor: boolean) {
    if (!detalle?.votacion) return
    setEnviando(true)
    setError('')
    try {
      const row = await votarMetaComun(detalle.votacion.id, aFavor)
      setDetalle(row)
      await refreshCuenta()
      await cargarLista()
      if (row.estado === 'desembolsada') toast.success('La mayoría aprobó y salió el pago')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo votar')
    } finally {
      setEnviando(false)
    }
  }

  async function copiarCodigo() {
    if (!detalle) return
    try {
      await navigator.clipboard.writeText(detalle.codigo)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 1600)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  function compartirInvitacion() {
    if (!detalle) return
    // El link abre /metas con el código ya cargado (codigoUrl más arriba).
    void compartirTexto({
      titulo: `Meta "${detalle.titulo}" en Monix`,
      texto: `Sumate a mi meta "${detalle.titulo}" en Monix. Código de invitación: ${detalle.codigo}`,
      url: `${window.location.origin}/metas?codigo=${detalle.codigo}`,
    })
  }

  if (detalle) {
    const progreso = detalle.objetivo && detalle.objetivo > 0
      ? Math.min(100, Math.round((detalle.saldo / detalle.objetivo) * 100))
      : null
    const cerrada = detalle.estado === 'desembolsada'

    return (
      <PageWrapper>
        <div className="max-w-lg mx-auto">
          <button
            type="button"
            onClick={() => { setDetalle(null); setError(''); void cargarLista() }}
            className="font-body text-sm text-slate-secondary hover:text-navy dark:hover:text-white inline-flex items-center gap-1 mb-4"
          >
            <ArrowLeft size={16} />
            Todas las metas
          </button>

          <div className="flex items-start justify-between gap-2">
            <h1 className="font-display text-2xl font-semibold text-navy dark:text-white">
              {detalle.titulo}
            </h1>
            <MetasAyuda />
          </div>
          {detalle.proposito && (
            <p className="font-body text-sm text-slate-secondary mt-1">{detalle.proposito}</p>
          )}
          <p className="font-body text-xs text-mint mt-2 uppercase tracking-wider">
            {estadoMeta(detalle.estado)}
          </p>

          <Card className="p-6 mt-5 mb-4">
            <p className="font-body text-xs text-slate-secondary uppercase tracking-wider">En custodia</p>
            <p className="font-display text-3xl font-bold text-mint mt-1">{ars(detalle.saldo)}</p>
            {progreso != null && (
              <div className="mt-3">
                <div className="h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                  <div className="h-full bg-mint rounded-full" style={{ width: `${progreso}%` }} />
                </div>
                <p className="font-body text-xs text-slate-secondary mt-1">
                  {progreso}% de {ars(detalle.objetivo ?? 0)}
                </p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="rounded-xl bg-slate-input dark:bg-white/5 px-3 py-2.5">
                <p className="font-body text-[11px] text-slate-secondary uppercase">TNA</p>
                <p className="font-display font-semibold text-navy dark:text-white">{detalle.tasaAnual}%</p>
              </div>
              <div className="rounded-xl bg-slate-input dark:bg-white/5 px-3 py-2.5">
                <p className="font-body text-[11px] text-slate-secondary uppercase">Rinde / día</p>
                <p className="font-display font-semibold text-navy dark:text-white">{ars(detalle.estimacionDiaria)}</p>
              </div>
            </div>
            <p className="font-body text-xs text-slate-secondary mt-3">
              Acumuló {ars(detalle.rendimientoAcumulado)} de interés. Nadie retira solo: hace falta mayoría.
            </p>
          </Card>

          {error && <p className="font-body text-sm text-red-500 dark:text-red-400 mb-4">{error}</p>}

          {!cerrada && (
            <Card className="p-5 mb-4">
              <p className="font-display font-semibold text-navy dark:text-white mb-3">Invitar</p>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-input dark:bg-white/5 px-3 py-2.5 mb-3">
                <div>
                  <p className="font-body text-[11px] text-slate-secondary uppercase">Código</p>
                  <p className="font-display tracking-widest text-navy dark:text-white">{detalle.codigo}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => { void copiarCodigo() }}
                    className="p-2 rounded-lg text-mint hover:bg-mint/10"
                    aria-label="Copiar código"
                    title="Copiar código"
                  >
                    {copiado ? <Check size={18} /> : <Copy size={18} />}
                  </button>
                  <button
                    type="button"
                    onClick={compartirInvitacion}
                    className="p-2 rounded-lg text-mint hover:bg-mint/10"
                    aria-label="Compartir invitación"
                    title="Compartir invitación"
                  >
                    <Share2 size={18} />
                  </button>
                </div>
              </div>
              <form onSubmit={(e) => { void onInvitar(e) }} className="flex flex-col gap-3">
                <Input
                  label="Alias Monix"
                  placeholder="luna.faro.rio"
                  value={aliasInvitar}
                  onChange={(e) => setAliasInvitar(e.target.value)}
                />
                <Button type="submit" variant="secondary" loading={enviando} loadingLabel="Invitando...">
                  Sumar a la meta
                </Button>
              </form>
            </Card>
          )}

          {!cerrada && (
            <Card className="p-5 mb-4">
              <p className="font-display font-semibold text-navy dark:text-white mb-3">Aportar</p>
              <form onSubmit={(e) => { void onAportar(e) }} className="flex flex-col gap-3">
                <Input
                  label="Monto"
                  inputMode="decimal"
                  placeholder="10000"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                />
                <Button type="submit" loading={enviando} loadingLabel="Aportando..." disabled={!cuentaArs}>
                  Meter en la meta
                </Button>
              </form>
            </Card>
          )}

          <Card className="p-5 mb-4">
            <p className="font-display font-semibold text-navy dark:text-white mb-3 flex items-center gap-2">
              <Users size={18} className="text-mint" />
              Quién aportó
            </p>
            <ul className="flex flex-col gap-2">
              {detalle.miembros.map((m) => (
                <li key={m.personaId} className="flex items-center justify-between gap-3">
                  <span className="font-body text-sm text-navy dark:text-white">
                    {m.nombre} {m.apellido}
                    {m.rol === 'creador' && (
                      <span className="text-slate-secondary"> · armó la meta</span>
                    )}
                  </span>
                  <span className="font-body text-sm text-mint">{ars(m.aporteTotal)}</span>
                </li>
              ))}
            </ul>
          </Card>

          {detalle.votacion && detalle.votacion.estado === 'abierta' && (
            <Card className="p-5 mb-4 border-mint/30">
              <p className="font-display font-semibold text-navy dark:text-white">
                {detalle.votacion.tipo === 'devolver' ? '¿Devolvemos lo juntado?' : '¿Pagamos el servicio?'}
              </p>
              <p className="font-body text-sm text-slate-secondary mt-1">
                {detalle.votacion.tipo === 'pagar'
                  ? `A ${detalle.votacion.destinoNombre ?? detalle.votacion.destinoAlias ?? 'una cuenta Monix'}`
                  : 'Cada uno recibe según lo que puso, más el interés.'}
                {detalle.votacion.concepto ? ` · ${detalle.votacion.concepto}` : ''}
              </p>
              <p className="font-body text-xs text-slate-secondary mt-2">
                {detalle.votacion.aFavor} a favor · {detalle.votacion.enContra} en contra · hacen falta {detalle.votacion.necesarios} de {detalle.votacion.miembros}
              </p>
              <ul className="mt-3 flex flex-col gap-1">
                {detalle.votacion.votos.map((v) => (
                  <li key={v.personaId} className="font-body text-sm text-navy dark:text-white">
                    {v.nombre} {v.apellido}: {v.aFavor ? 'sí' : 'no'}
                  </li>
                ))}
              </ul>
              {detalle.votacion.miVoto == null && (
                <div className="flex gap-2 mt-4">
                  <Button type="button" className="flex-1" loading={enviando} onClick={() => { void onVotar(true) }}>
                    Aprobar
                  </Button>
                  <Button type="button" variant="secondary" className="flex-1" loading={enviando} onClick={() => { void onVotar(false) }}>
                    Rechazar
                  </Button>
                </div>
              )}
            </Card>
          )}

          {!cerrada && !detalle.votacion && detalle.saldo > 0 && (
            <Card className="p-5 mb-4">
              <p className="font-display font-semibold text-navy dark:text-white mb-1">Desembolso</p>
              <p className="font-body text-xs text-slate-secondary mb-3">
                La plata no sale si no hay mayoría. El pago va a una cuenta Monix.
              </p>
              <div className="flex flex-col gap-3">
                <Input
                  label="Concepto"
                  placeholder="Alquiler marzo, regalo, pasajes"
                  maxLength={80}
                  value={conceptoPago}
                  onChange={(e) => setConceptoPago(e.target.value)}
                />
                <Input
                  label="Alias o CBU Monix (si pagan un servicio)"
                  placeholder="luna.faro.rio"
                  value={destino}
                  onChange={(e) => setDestino(e.target.value)}
                />
                <Button
                  type="button"
                  loading={enviando}
                  loadingLabel="Proponiendo..."
                  onClick={() => { void onProponer('pagar') }}
                >
                  Proponer pago
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  loading={enviando}
                  onClick={() => { void onProponer('devolver') }}
                >
                  Proponer devolución
                </Button>
              </div>
            </Card>
          )}

          {detalle.aportes.length > 0 && (
            <ul className="flex flex-col gap-2 pb-4">
              {detalle.aportes.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-card px-4 py-3"
                >
                  <span className="font-body text-sm text-navy dark:text-white">{etiquetaAporte(a)}</span>
                  <span className={`font-body text-sm ${a.monto < 0 ? 'text-slate-secondary' : 'text-mint'}`}>
                    {a.monto < 0 ? ars(Math.abs(a.monto)) : `+${ars(a.monto)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-1 mb-6">
          <h1 className="font-display text-2xl font-semibold text-navy dark:text-white">
            Metas comunes
          </h1>
          <MetasAyuda />
        </div>

        {error && <p className="font-body text-sm text-red-500 dark:text-red-400 mb-4">{error}</p>}

        <Card className="p-5 mb-4">
          <form onSubmit={(e) => { void onUnirse(e) }} className="flex flex-col gap-3">
            <Input
              label="Código de invitación"
              placeholder="A1B2C3D4"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            />
            <Button type="submit" variant="secondary" loading={enviando} loadingLabel="Entrando...">
              Entrar a una meta
            </Button>
          </form>
        </Card>

        {crear ? (
          <Card className="p-5 mb-4">
            <form onSubmit={(e) => { void onCrear(e) }} className="flex flex-col gap-3">
              <Input
                label="Nombre"
                placeholder="Viaje a Córdoba"
                maxLength={80}
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
              />
              <Input
                label="Para qué"
                placeholder="Regalo, alquiler, pasajes"
                maxLength={120}
                value={proposito}
                onChange={(e) => setProposito(e.target.value)}
              />
              <Input
                label="Objetivo (opcional)"
                inputMode="decimal"
                placeholder="200000"
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
              />
              <div className="flex gap-2">
                <Button type="submit" className="flex-1" loading={enviando} loadingLabel="Creando...">
                  Crear meta
                </Button>
                <Button type="button" variant="ghost" onClick={() => setCrear(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          <Button type="button" className="w-full mb-4 inline-flex items-center justify-center gap-2" onClick={() => setCrear(true)}>
            <Plus size={18} />
            Nueva meta
          </Button>
        )}

        {cargando ? (
          <p className="font-body text-sm text-slate-secondary">Cargando metas...</p>
        ) : lista.length === 0 ? (
          <Card className="p-6 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-mint/15 text-mint flex items-center justify-center mb-3">
              <Target size={26} />
            </div>
            <p className="font-display font-semibold text-navy dark:text-white">Todavía no hay ninguna</p>
            <p className="font-body text-sm text-slate-secondary mt-1">
              Creá un fondo o pedile el código a quien ya lo armó.
            </p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {lista.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => { void abrir(m.id) }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-card px-4 py-3 text-left hover:border-mint/40"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mint/20 text-mint">
                    <Target size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-body font-medium text-navy dark:text-white truncate">{m.titulo}</span>
                    <span className="block font-body text-xs text-slate-secondary">
                      {m.miembros} {m.miembros === 1 ? 'persona' : 'personas'} · {estadoMeta(m.estado)}
                    </span>
                  </span>
                  <span className="font-body text-sm text-mint shrink-0">{ars(m.saldo)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageWrapper>
  )
}
