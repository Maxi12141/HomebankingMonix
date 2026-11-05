import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMovimientos } from '../hooks/useMovimientos'
import { useCuentaStore } from '../store/cuentaStore'
import { formatMonto } from '../utils/cuenta'
import { CATEGORIA_VARIOS, resumenGastos } from '../utils/gastos'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { MovimientosSkeleton } from '../components/ui/Skeleton'

function nombreMes(anio: number, mes: number) {
  const texto = new Date(anio, mes, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function GastosPage() {
  const { movimientos, loading } = useMovimientos()
  const cuentas = useCuentaStore((s) => s.cuentas)
  const hoy = new Date()
  const [desfase, setDesfase] = useState(0)
  const [abierta, setAbierta] = useState<string | null>(null)

  const propias = useMemo(() => new Set(cuentas.map((c) => c.id)), [cuentas])

  const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - desfase, 1)
  const anterior = new Date(fecha.getFullYear(), fecha.getMonth() - 1, 1)
  const resumen = resumenGastos(movimientos, propias, fecha.getFullYear(), fecha.getMonth())
  const previo = resumenGastos(movimientos, propias, anterior.getFullYear(), anterior.getMonth())

  const mayor = resumen.categorias[0]
  const varios = resumen.categorias.find((c) => c.categoria === CATEGORIA_VARIOS)
  const diferencia = resumen.total - previo.total

  function cambiarMes(delta: number) {
    setDesfase((d) => d + delta)
    setAbierta(null)
  }

  return (
    <PageWrapper>
      <div className="max-w-2xl mx-auto">
        <h1 className="font-display text-2xl font-semibold text-navy dark:text-white mb-1">Mis gastos</h1>
        <p className="font-body text-sm text-slate-secondary mb-6">En qué se fue tu dinero en pesos, por concepto.</p>

        <div className="flex items-center justify-between gap-2 mb-4">
          <button
            type="button"
            onClick={() => cambiarMes(1)}
            aria-label="Mes anterior"
            className="w-11 h-11 flex items-center justify-center rounded-xl text-navy dark:text-white hover:bg-navy/5 dark:hover:bg-white/5 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <p className="font-display text-base font-semibold text-navy dark:text-white" aria-live="polite">
            {nombreMes(fecha.getFullYear(), fecha.getMonth())}
          </p>
          <button
            type="button"
            onClick={() => cambiarMes(-1)}
            disabled={desfase === 0}
            aria-label="Mes siguiente"
            className="w-11 h-11 flex items-center justify-center rounded-xl text-navy dark:text-white hover:bg-navy/5 dark:hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {loading ? (
          <MovimientosSkeleton filas={3} label="Cargando tus gastos" />
        ) : resumen.categorias.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="font-body text-sm text-slate-secondary">No tenés gastos registrados en este mes.</p>
          </Card>
        ) : (
          <>
            <Card className="p-6 mb-4">
              <p className="font-body text-sm text-slate-secondary">Gastaste</p>
              <p className="font-display text-3xl font-bold text-navy dark:text-white mt-1">
                {formatMonto(resumen.total, 'ARS')}
              </p>
              <p className="font-body text-sm text-slate-secondary mt-2">
                {mayor.categoria} se llevó el {mayor.porcentaje}%
                {previo.total > 0 && diferencia !== 0 && (
                  <> · {formatMonto(Math.abs(diferencia), 'ARS')} {diferencia > 0 ? 'más' : 'menos'} que el mes anterior</>
                )}
              </p>
            </Card>

            <Card className="p-2 sm:p-3">
              <ul>
                {resumen.categorias.map((c, i) => {
                  const estaAbierta = abierta === c.categoria
                  return (
                    <li key={c.categoria}>
                      <button
                        type="button"
                        onClick={() => setAbierta(estaAbierta ? null : c.categoria)}
                        aria-expanded={estaAbierta}
                        className="w-full min-h-11 text-left px-3 py-3 rounded-xl hover:bg-navy/5 dark:hover:bg-white/5 transition-colors"
                      >
                        <span className="flex items-baseline justify-between gap-3 mb-2">
                          <span className="font-body font-medium text-sm text-navy dark:text-white flex items-center gap-1">
                            {c.categoria}
                            <ChevronDown
                              size={14}
                              className={`text-slate-secondary transition-transform ${estaAbierta ? 'rotate-180' : ''}`}
                            />
                          </span>
                          <span className="font-body text-sm text-navy dark:text-white tabular-nums whitespace-nowrap">
                            {formatMonto(c.total, 'ARS')}
                            <span className="text-slate-secondary"> · {c.porcentaje}%</span>
                          </span>
                        </span>
                        <span className="block h-2 rounded-full bg-navy/5 dark:bg-white/10 overflow-hidden" aria-hidden="true">
                          <span
                            className={`block h-full rounded-full ${i === 0 ? 'bg-mint-tinta dark:bg-mint' : 'bg-navy/40 dark:bg-white/50'}`}
                            style={{ width: `${Math.max((c.total / mayor.total) * 100, 2)}%` }}
                          />
                        </span>
                      </button>

                      {estaAbierta && (
                        <ul className="px-3 pb-3">
                          {c.movimientos.map((m) => {
                            const nombre = [m.destinatario_nombre, m.destinatario_apellido].filter(Boolean).join(' ')
                            return (
                              <li
                                key={m.id}
                                className="flex items-baseline justify-between gap-3 py-2 border-t border-slate-200 dark:border-white/10"
                              >
                                <span className="min-w-0">
                                  <span className="block font-body text-sm text-navy dark:text-white truncate">
                                    {nombre || (m.descripcion ?? '').split('|').pop()}
                                  </span>
                                  <span className="block font-body text-xs text-slate-secondary">
                                    {new Date(m.created_at).toLocaleDateString('es-AR')}
                                  </span>
                                </span>
                                <span className="font-body text-sm text-navy dark:text-white tabular-nums whitespace-nowrap">
                                  {formatMonto(m.monto, 'ARS')}
                                </span>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            </Card>

            {varios && varios.porcentaje >= 30 && (
              <p className="font-body text-sm text-slate-secondary mt-4">
                Tip: elegí el motivo cuando transferís y tus gastos se ordenan solos.
              </p>
            )}
          </>
        )}

        <Link to="/historial" className="toque-texto inline-block font-body text-sm font-medium text-navy dark:text-mint mt-4">
          Ver todos los movimientos
        </Link>
      </div>
    </PageWrapper>
  )
}
