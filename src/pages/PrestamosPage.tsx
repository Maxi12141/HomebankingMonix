import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  HandCoins, ShieldAlert, CalendarClock, CircleCheck, TrendingUp, Info, ListOrdered, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../store/authStore'
import { useCuenta } from '../hooks/useCuenta'
import { usePrestamos } from '../hooks/usePrestamos'
import { consultarSituacion } from '../services/bancoCentral'
import {
  addMonths, calcularCuota, calcularOferta, calcularTablaAmortizacion,
  nivelPorSituacion, type FilaAmortizacion,
} from '../utils/prestamos'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import type { Prestamo } from '../types'

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

const PLAZOS_CANDIDATOS = [3, 6, 12, 18, 24]

export function PrestamosPage() {
  const { persona } = useAuthStore()
  const { cuenta, refreshCuenta } = useCuenta()
  const { prestamos, loading: loadingPrestamos, refreshPrestamos } = usePrestamos(cuenta ?? null)

  const [situacion, setSituacion] = useState<number | null>(null)

  const [monto, setMonto] = useState('')
  const [cuotasSel, setCuotasSel] = useState(6)
  const [solicitando, setSolicitando] = useState(false)
  const [error, setError] = useState('')
  const [verEsquema, setVerEsquema] = useState(false)

  useEffect(() => {
    if (!persona) return
    consultarSituacion(persona.dni)
      .then((r) => setSituacion(r.situacion))
      .catch(() => setSituacion(1))
  }, [persona])

  const nivel = nivelPorSituacion(situacion ?? 1)
  const oferta = useMemo(
    () => calcularOferta(situacion ?? 1, persona?.sueldo_acreditado ?? false),
    [situacion, persona?.sueldo_acreditado],
  )
  const plazos = useMemo(
    () => PLAZOS_CANDIDATOS.filter((p) => p <= oferta.cuotasMax),
    [oferta.cuotasMax],
  )

  useEffect(() => {
    if (plazos.length && !plazos.includes(cuotasSel)) setCuotasSel(plazos[plazos.length - 1])
  }, [plazos]) // eslint-disable-line react-hooks/exhaustive-deps

  const montoNum = parseFloat(monto) || 0
  const tablaSimulada = useMemo(
    () => calcularTablaAmortizacion(montoNum, oferta.tna, cuotasSel),
    [montoNum, oferta.tna, cuotasSel],
  )
  const cuota = calcularCuota(montoNum, oferta.tna, cuotasSel)
  const total = Math.round(cuota * cuotasSel * 100) / 100
  const okMonto = montoNum > 0 && montoNum <= oferta.montoMax
  const ingresoDeclarado = persona?.ingreso_mensual ?? null
  const topeCuota = ingresoDeclarado != null ? ingresoDeclarado * oferta.ratioIngreso : null
  const superaRatio = topeCuota != null && cuota > topeCuota

  async function solicitar() {
    if (!persona || !cuenta) return
    setError('')

    if (!nivel.disponible) {
      setError('Por ahora no podemos ofrecerte un préstamo.')
      return
    }
    if (!okMonto) {
      setError(`Esta oferta admite hasta ${formatARS(oferta.montoMax)}`)
      return
    }
    if (ingresoDeclarado == null) {
      setError('Declará tu ingreso mensual en tu Perfil para poder solicitar un préstamo.')
      return
    }
    if (superaRatio) {
      setError(`La cuota no puede superar el ${Math.round(oferta.ratioIngreso * 100)}% de tu ingreso declarado (${formatARS(topeCuota!)}).`)
      return
    }

    setSolicitando(true)
    try {
      const nuevoSaldo = Math.round((cuenta.saldo + montoNum) * 100) / 100
      const proximaCuota = new Date()
      proximaCuota.setMonth(proximaCuota.getMonth() + 1)

      const { error: errInsert } = await supabase.from('prestamos').insert({
        cuenta_id: cuenta.id,
        monto: montoNum,
        cuotas_totales: cuotasSel,
        cuota_monto: cuota,
        tna: oferta.tna,
        situacion_bcra: situacion ?? 1,
        sueldo_acreditado: persona.sueldo_acreditado,
        proxima_cuota_at: proximaCuota.toISOString(),
      })
      if (errInsert) throw new Error('No se pudo registrar el préstamo')

      const { error: errCuenta } = await supabase.from('cuentas').update({ saldo: nuevoSaldo }).eq('id', cuenta.id)
      if (errCuenta) throw new Error('No se pudo acreditar el préstamo en tu cuenta')

      await supabase.from('movimientos').insert({
        cuenta_id: cuenta.id,
        tipo: 'deposito',
        monto: montoNum,
        saldo_resultante: nuevoSaldo,
        descripcion: 'Préstamo otorgado',
      })

      setMonto('')
      await Promise.all([refreshCuenta(), refreshPrestamos()])
      toast.success('¡Préstamo acreditado en tu cuenta!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo solicitar el préstamo'
      setError(msg)
      toast.error(msg)
    } finally {
      setSolicitando(false)
    }
  }

  const activos = prestamos.filter((p) => p.estado === 'activo')
  const pagados = prestamos.filter((p) => p.estado === 'pagado')

  return (
    <PageWrapper>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold text-mint">Préstamos</h1>
          <p className="font-body text-sm text-slate-secondary mt-1">
            Simulá y pedí un préstamo personal en pesos.
          </p>
        </div>

        {ingresoDeclarado == null && nivel.disponible && (
          <p className="font-body text-xs text-slate-secondary mb-4 flex items-center gap-1.5">
            <Info size={13} className="shrink-0" />
            <Link to="/perfil" className="text-mint hover:text-mint-hover transition-colors">
              Declará tu ingreso mensual en Perfil
            </Link>
            &nbsp;para poder solicitar el préstamo.
          </p>
        )}

        {!nivel.disponible ? (
          <Card className="p-6 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <ShieldAlert size={20} className="text-red-500 dark:text-red-400" />
              <p className="font-display text-base font-semibold text-navy dark:text-white">
                No podés acceder a un préstamo por ahora
              </p>
            </div>
            <p className="font-body text-sm text-slate-secondary">
              Por ahora no podemos ofrecerte un préstamo. Volvé a intentar más adelante.
            </p>
          </Card>
        ) : (
          <Card className="p-6 mb-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="rounded-xl bg-mint/15 text-mint p-2.5">
                <HandCoins size={20} />
              </div>
              <div>
                <p className="font-display text-base font-semibold text-navy dark:text-white">Simulador</p>
                <p className="font-body text-xs text-slate-secondary">
                  TNA {oferta.tna.toFixed(1)}% · hasta {formatARS(oferta.montoMax)} · hasta {oferta.cuotasMax} cuotas
                </p>
              </div>
            </div>

            <Input
              label="Monto a solicitar"
              type="number"
              min="1"
              step="1000"
              placeholder="0"
              value={monto}
              onChange={(e) => { setMonto(e.target.value); setError('') }}
            />

            <div className="mt-4 mb-1">
              <p className="font-body text-xs text-slate-secondary uppercase tracking-wider mb-2">Plazo</p>
              <div className="flex flex-wrap gap-2">
                {plazos.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCuotasSel(p)}
                    className={`rounded-lg px-3.5 py-2 font-body text-sm font-medium transition-colors ${
                      cuotasSel === p
                        ? 'bg-mint text-navy'
                        : 'bg-slate-input dark:bg-white/5 text-slate-secondary hover:text-navy dark:hover:text-white'
                    }`}
                  >
                    {p} {p === 1 ? 'cuota' : 'cuotas'}
                  </button>
                ))}
              </div>
            </div>

            {montoNum > 0 && (
              <div className="rounded-xl bg-slate-input dark:bg-white/5 px-4 py-3 space-y-2 mt-4">
                <div className="flex justify-between gap-3">
                  <span className="font-body text-sm text-slate-secondary">Cuota mensual</span>
                  <span className="font-display font-bold text-mint">{formatARS(cuota)}</span>
                </div>
                <p className="font-body text-[11px] text-slate-secondary leading-relaxed flex items-start gap-1.5">
                  <Info size={12} className="shrink-0 mt-0.5" />
                  Sistema francés: la cuota es fija, pero la parte de interés y la de capital que la componen cambian
                  cada mes (al principio pagás más interés porque el saldo es más alto). El detalle mes a mes está en
                  &quot;Ver esquema de pago&quot;.
                </p>
                <div className="h-px bg-slate-200 dark:bg-white/10" />
                <div className="flex justify-between gap-3">
                  <span className="font-body text-sm text-slate-secondary">Total a pagar</span>
                  <span className="font-display font-semibold text-navy dark:text-white">{formatARS(total)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="font-body text-sm text-slate-secondary">Intereses totales</span>
                  <span className="font-body text-sm text-navy dark:text-white">{formatARS(total - montoNum)}</span>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full mt-2 flex items-center justify-center gap-2 py-2 text-sm"
                  onClick={() => setVerEsquema(true)}
                >
                  <ListOrdered size={15} />
                  Ver esquema de pago mes a mes
                </Button>
              </div>
            )}

            {!okMonto && montoNum > 0 && (
              <p className="font-body text-xs text-red-500 dark:text-red-400 mt-3">
                El monto supera el máximo disponible para esta oferta ({formatARS(oferta.montoMax)}).
              </p>
            )}
            {superaRatio && okMonto && (
              <p className="font-body text-xs text-red-500 dark:text-red-400 mt-3">
                La cuota supera el {Math.round(oferta.ratioIngreso * 100)}% de tu ingreso declarado. Elegí un plazo más largo o un monto menor.
              </p>
            )}
            {error && (
              <p className="font-body text-xs text-red-500 dark:text-red-400 mt-3">{error}</p>
            )}

            <Button
              className="w-full mt-5"
              onClick={solicitar}
              loading={solicitando}
              disabled={!okMonto || montoNum <= 0}
            >
              Solicitar préstamo
            </Button>
          </Card>
        )}

        {/* Mis préstamos */}
        {(activos.length > 0 || pagados.length > 0) && (
          <div className="mb-6">
            <h2 className="font-display text-base font-semibold text-navy dark:text-white mb-3">Mis préstamos</h2>
            <div className="flex flex-col gap-3">
              {[...activos, ...pagados].map((p) => (
                <PrestamoCard key={p.id} prestamo={p} />
              ))}
            </div>
          </div>
        )}

        {loadingPrestamos && prestamos.length === 0 && (
          <p className="font-body text-sm text-slate-secondary text-center py-4">Cargando tus préstamos…</p>
        )}
      </div>

      <EsquemaPagoModal
        open={verEsquema}
        onClose={() => setVerEsquema(false)}
        titulo={`Esquema de pago · ${cuotasSel} cuotas`}
        filas={tablaSimulada}
        fechaInicio={addMonths(new Date().toISOString(), 1)}
      />
    </PageWrapper>
  )
}

function PrestamoCard({ prestamo }: { prestamo: Prestamo }) {
  const [verCuotas, setVerCuotas] = useState(false)
  const progreso = Math.min(100, Math.round((prestamo.cuotas_pagadas / prestamo.cuotas_totales) * 100))
  const atrasada = prestamo.estado === 'activo' && new Date(prestamo.proxima_cuota_at).getTime() <= Date.now()
  const cuotasRestantes = prestamo.cuotas_totales - prestamo.cuotas_pagadas

  // Se recalcula la tabla completa (es determinística) y se recorta desde la última cuota pagada.
  const restantes = useMemo(() => {
    const tabla = calcularTablaAmortizacion(Number(prestamo.monto), Number(prestamo.tna), prestamo.cuotas_totales)
    return tabla.slice(prestamo.cuotas_pagadas)
  }, [prestamo.monto, prestamo.tna, prestamo.cuotas_totales, prestamo.cuotas_pagadas])

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-display text-lg font-bold text-navy dark:text-white">{formatARS(prestamo.monto)}</p>
          <p className="font-body text-xs text-slate-secondary mt-0.5">
            TNA {Number(prestamo.tna).toFixed(1)}% · {prestamo.cuotas_totales} cuotas de {formatARS(prestamo.cuota_monto)}
          </p>
        </div>
        {prestamo.estado === 'pagado' ? (
          <span className="flex items-center gap-1 rounded-full bg-mint/15 text-mint px-2.5 py-1 font-body text-xs font-medium shrink-0">
            <CircleCheck size={13} /> Pagado
          </span>
        ) : atrasada ? (
          <span className="flex items-center gap-1 rounded-full bg-red-500/15 text-red-500 dark:text-red-400 px-2.5 py-1 font-body text-xs font-medium shrink-0">
            <ShieldAlert size={13} /> Cuota atrasada
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-slate-input dark:bg-white/10 text-slate-secondary px-2.5 py-1 font-body text-xs font-medium shrink-0">
            <TrendingUp size={13} /> Al día
          </span>
        )}
      </div>

      <div className="h-1.5 rounded-full bg-slate-input dark:bg-white/10 overflow-hidden mb-2">
        <div className="h-full bg-mint rounded-full transition-all" style={{ width: `${progreso}%` }} />
      </div>
      <div className="flex items-center justify-between flex-wrap gap-y-1">
        <span className="font-body text-xs text-slate-secondary">
          {prestamo.cuotas_pagadas} pagadas · {cuotasRestantes} restantes
        </span>
        {prestamo.estado === 'activo' && (
          <span className="flex items-center gap-1 font-body text-xs text-slate-secondary">
            <CalendarClock size={13} />
            Próxima: {new Date(prestamo.proxima_cuota_at).toLocaleDateString('es-AR')}
          </span>
        )}
      </div>

      {prestamo.estado === 'activo' && cuotasRestantes > 0 && (
        <button
          type="button"
          onClick={() => setVerCuotas(true)}
          className="flex items-center gap-1.5 font-body text-xs text-mint hover:text-mint-hover transition-colors mt-3"
        >
          <ListOrdered size={13} />
          Ver cuotas restantes
        </button>
      )}

      <EsquemaPagoModal
        open={verCuotas}
        onClose={() => setVerCuotas(false)}
        titulo={`Cuotas restantes · ${formatARS(prestamo.monto)}`}
        filas={restantes}
        fechaInicio={prestamo.proxima_cuota_at}
      />
    </Card>
  )
}

function EsquemaPagoModal({
  open, onClose, titulo, filas, fechaInicio,
}: {
  open: boolean
  onClose: () => void
  titulo: string
  filas: FilaAmortizacion[]
  fechaInicio: string
}) {
  return (
    <Modal open={open} onClose={onClose}>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-display text-sm font-semibold text-navy dark:text-white pr-2">{titulo}</p>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-secondary hover:text-navy dark:hover:text-white transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[60vh] flex flex-col gap-2 pr-0.5">
          {filas.map((f, idx) => {
            const interesPct = f.cuota > 0 ? Math.min(100, Math.round((f.interes / f.cuota) * 100)) : 0
            return (
              <div
                key={f.numero}
                className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-input/60 dark:bg-white/[0.03] px-3.5 py-3"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy/5 dark:bg-white/10 font-body text-[11px] font-bold text-navy dark:text-white">
                      {f.numero}
                    </span>
                    <span className="font-body text-xs text-slate-secondary truncate">
                      {new Date(addMonths(fechaInicio, idx)).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })}
                    </span>
                  </div>
                  <span className="font-display text-sm font-bold text-navy dark:text-white shrink-0">
                    {formatARS(f.cuota)}
                  </span>
                </div>

                <div className="h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-white/10 flex mb-2">
                  <div className="h-full bg-amber-400" style={{ width: `${interesPct}%` }} />
                  <div className="h-full bg-mint" style={{ width: `${100 - interesPct}%` }} />
                </div>

                <div className="flex items-center justify-between font-body text-[11px] text-slate-secondary">
                  <span>Interés {formatARS(f.interes)}</span>
                  <span>Capital {formatARS(f.amortizacion)}</span>
                  <span>Saldo {formatARS(f.saldoPendiente)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </Modal>
  )
}
