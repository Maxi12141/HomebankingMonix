import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { useMovimientos } from '../hooks/useMovimientos'
import { useBankNames } from '../hooks/useBankNames'
import { DatePicker } from '../components/ui/DatePicker'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { TransactionDetailModal } from '../components/TransactionDetailModal'
import type { Movimiento } from '../types'

type Filtro = 'todos' | 'entradas' | 'salidas'

const tipoLabel: Record<string, string> = {
  deposito: 'Depósito',
  extraccion: 'Extracción',
  transferencia_entrada: 'Transferencia recibida',
  transferencia_salida: 'Transferencia enviada',
}

function esEntrada(tipo: Movimiento['tipo']) {
  return tipo === 'deposito' || tipo === 'transferencia_entrada'
}

function coincideBusqueda(mov: Movimiento, termino: string): boolean {
  const t = termino.toLowerCase()
  return (
    (tipoLabel[mov.tipo] ?? '').toLowerCase().includes(t) ||
    (mov.descripcion ?? '').toLowerCase().includes(t) ||
    (mov.destinatario_nombre ?? '').toLowerCase().includes(t) ||
    (mov.destinatario_apellido ?? '').toLowerCase().includes(t) ||
    (mov.destino_cbu ?? '').includes(t) ||
    (mov.destino_alias ?? '').toLowerCase().includes(t)
  )
}

export function HistorialPage() {
  const { movimientos, loading } = useMovimientos(100)
  const bankNames = useBankNames(movimientos)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [aliasFilter, setAliasFilter] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [selectedMovimiento, setSelectedMovimiento] = useState<Movimiento | null>(null)

  const hayFiltrosAvanzados = aliasFilter.trim() || fechaDesde || fechaHasta

  function limpiarFiltros() {
    setAliasFilter('')
    setFechaDesde('')
    setFechaHasta('')
  }

  const movimientosFiltrados = movimientos.filter((m) => {
    if (filtro === 'entradas' && !esEntrada(m.tipo)) return false
    if (filtro === 'salidas' && esEntrada(m.tipo)) return false
    if (busqueda.trim() && !coincideBusqueda(m, busqueda.trim())) return false
    if (aliasFilter.trim()) {
      const a = aliasFilter.trim().toLowerCase()
      const matchAlias = (m.destino_alias ?? '').toLowerCase().includes(a)
      const matchNombre = (m.destinatario_nombre ?? '').toLowerCase().includes(a)
      const matchApellido = (m.destinatario_apellido ?? '').toLowerCase().includes(a)
      const matchCbu = (m.destino_cbu ?? '').includes(aliasFilter.trim())
      if (!matchAlias && !matchNombre && !matchApellido && !matchCbu) return false
    }
    if (fechaDesde) {
      if (new Date(m.created_at) < new Date(fechaDesde + 'T00:00:00')) return false
    }
    if (fechaHasta) {
      if (new Date(m.created_at) > new Date(fechaHasta + 'T23:59:59')) return false
    }
    return true
  })

  return (
    <PageWrapper>
      <div className="max-w-2xl mx-auto">
        <h1 className="font-display text-2xl font-semibold text-navy dark:text-white mb-6">Historial</h1>

        {/* Filtros por tipo */}
        <div className="flex gap-2 mb-4">
          {(['todos', 'entradas', 'salidas'] as Filtro[]).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-4 py-2 rounded-xl font-body text-sm font-medium transition-colors
                ${filtro === f
                  ? 'bg-mint text-navy'
                  : 'bg-white dark:bg-navy-card border border-slate-200 dark:border-white/10 text-slate-secondary hover:text-navy dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20'
                }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Búsqueda por texto */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-secondary pointer-events-none" />
          <input
            className="w-full bg-white dark:bg-navy-card border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-10 py-2.5 font-body text-sm text-navy dark:text-white placeholder-slate-secondary focus:outline-none focus:border-mint/50 transition-colors"
            placeholder="Buscar por nombre, descripción o CBU..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-secondary hover:text-navy dark:hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filtros avanzados: alias + rango de fecha */}
        <div className="flex flex-col gap-2 mb-6">
          {/* Alias */}
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-secondary font-body text-sm pointer-events-none select-none">@</span>
            <input
              className="w-full bg-white dark:bg-navy-card border border-slate-200 dark:border-white/10 rounded-xl pl-8 pr-10 py-2.5 font-body text-sm text-navy dark:text-white placeholder-slate-secondary focus:outline-none focus:border-mint/50 transition-colors"
              placeholder="Filtrar por alias de destinatario o emisor..."
              value={aliasFilter}
              onChange={(e) => setAliasFilter(e.target.value)}
            />
            {aliasFilter && (
              <button
                onClick={() => setAliasFilter('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-secondary hover:text-navy dark:hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Rango de fecha */}
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <DatePicker value={fechaDesde} onChange={setFechaDesde} placeholder="Desde" />
            </div>
            <div className="flex-1">
              <DatePicker value={fechaHasta} onChange={setFechaHasta} placeholder="Hasta" />
            </div>
            {hayFiltrosAvanzados && (
              <button
                onClick={limpiarFiltros}
                className="shrink-0 text-xs font-body text-slate-secondary hover:text-red-500 dark:hover:text-red-400 transition-colors px-2 py-1 rounded-lg border border-slate-200 dark:border-white/10 hover:border-red-200 dark:hover:border-red-400/20"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-secondary font-body text-sm">Cargando movimientos...</div>
        ) : movimientosFiltrados.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="font-body text-slate-secondary">
              {busqueda || filtro !== 'todos' ? 'No hay movimientos que coincidan con la búsqueda' : 'No hay movimientos para mostrar'}
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {movimientosFiltrados.map((mov) => {
              const entrada = esEntrada(mov.tipo)
              const montoFormateado = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(mov.monto)
              const saldoFormateado = mov.saldo_resultante !== null
                ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(mov.saldo_resultante)
                : null

              return (
                <Card
                  key={mov.id}
                  className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-navy/5 dark:hover:bg-white/5 transition-colors"
                  onClick={() => setSelectedMovimiento(mov)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-body font-medium text-navy dark:text-white text-sm">{tipoLabel[mov.tipo]}</p>
                    {mov.destinatario_nombre && (
                      <p className="font-body text-xs text-slate-secondary mt-0.5 truncate">
                        {mov.destinatario_nombre} {mov.destinatario_apellido}
                      </p>
                    )}
                    {mov.descripcion && (
                      <p className="font-body text-xs text-slate-secondary mt-0.5 truncate">
                        {mov.descripcion.includes('|') ? mov.descripcion.split('|')[0] : mov.descripcion}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <p className="font-body text-xs text-slate-secondary">
                        {new Date(mov.created_at).toLocaleString('es-AR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                      {saldoFormateado && (
                        <p className="font-body text-xs text-slate-secondary">Saldo: {saldoFormateado}</p>
                      )}
                    </div>
                  </div>
                  <span className={`font-display font-semibold text-base ml-4 shrink-0 ${entrada ? 'text-mint' : 'text-red-500 dark:text-red-400'}`}>
                    {entrada ? '+' : '-'}{montoFormateado}
                  </span>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <TransactionDetailModal
        movimiento={selectedMovimiento}
        bankName={
          selectedMovimiento?.banco_codigo_origen != null
            ? bankNames[selectedMovimiento.banco_codigo_origen]
            : undefined
        }
        onClose={() => setSelectedMovimiento(null)}
      />
    </PageWrapper>
  )
}
