import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { CheckCircle, Search, Star, Home, UserPlus, ChevronDown, ArrowLeft, ArrowRight, AlertTriangle } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import { transferir, buscarDestinatarioBC } from '../services/bancoCentral'
import { useCuenta } from '../hooks/useCuenta'
import { useCuentaStore } from '../store/cuentaStore'
import { useAuthStore } from '../store/authStore'
import { useContactos } from '../hooks/useContactos'
import { useTransferenciasRecientes } from '../hooks/useTransferenciasRecientes'
import { useMercadoFinanciero } from '../hooks/useMercadoFinanciero'
import { formatMonto } from '../utils/cuenta'
import { AgendaContactosPanel } from '../components/AgendaContactosPanel'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

type Step = 'buscar' | 'detalle' | 'resumen' | 'exito'
type Moneda = 'ARS' | 'USD'

interface Destinatario {
  nombre: string
  apellido: string
  dni: string | null
  cbu: string
  alias: string | null
  moneda: Moneda
  cuentaId?: string
  saldoActual?: number
}

function Iniciales({ nombre, apellido }: { nombre: string; apellido: string }) {
  return (
    <div className="w-10 h-10 rounded-full bg-mint/20 text-mint flex items-center justify-center font-body font-bold text-sm shrink-0 select-none">
      {(nombre[0] ?? '').toUpperCase()}{(apellido[0] ?? '').toUpperCase()}
    </div>
  )
}

const MOTIVOS_GRUPOS: { grupo: string; items: string[] }[] = [
  { grupo: 'General', items: ['Varios', 'Gastos compartidos', 'Regalo', 'Donación'] },
  {
    grupo: 'Vivienda',
    items: ['Alquiler', 'Expensas', 'Cuota', 'Depósito en garantía', 'Mantenimiento'],
  },
  {
    grupo: 'Trabajo e ingresos',
    items: ['Sueldo', 'Haberes', 'Jornal', 'Honorarios', 'Viáticos', 'Aguinaldo'],
  },
  {
    grupo: 'Comercio y servicios',
    items: [
      'Factura',
      'Servicio',
      'Mercadería',
      'Compra',
      'Venta',
      'Seguro',
      'Suscripción',
      'Impuestos',
    ],
  },
  {
    grupo: 'Educación y salud',
    items: ['Aranceles', 'Educación', 'Salud'],
  },
  {
    grupo: 'Finanzas',
    items: ['Préstamo', 'Deuda', 'Reintegro', 'Ahorro', 'Inversión'],
  },
  {
    grupo: 'Otros',
    items: ['Transporte', 'Viajes', 'Comisiones'],
  },
]

const stepVariants = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, x: -40, transition: { duration: 0.2 } },
}

const REFRESH_COTIZACION_MS = 30_000

function roundMoney(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Convierte un monto entre ARS y USD a la cotización oficial del día — misma
 * convención que la pantalla de Compra y Venta: comprar USD usa "venta",
 * vender USD usa "compra". */
function convertir(monto: number, monedaOrigen: Moneda, monedaDestino: Moneda, oficial: { compra: number; venta: number }): number {
  if (monedaOrigen === monedaDestino) return monto
  if (monedaOrigen === 'ARS' && monedaDestino === 'USD') return roundMoney(monto / oficial.venta)
  return roundMoney(monto * oficial.compra)
}

export function TransferPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { cuenta, cuentas, refreshCuenta } = useCuenta()
  const { updateSaldoCuenta } = useCuentaStore()
  const { persona } = useAuthStore()
  const { isGuardado, guardar, eliminar } = useContactos()
  const { data: mercado } = useMercadoFinanciero(REFRESH_COTIZACION_MS)

  const [step, setStep] = useState<Step>('buscar')
  const [monedaOrigen, setMonedaOrigen] = useState<Moneda>('ARS')
  const [destino, setDestino] = useState('')
  const [destinatario, setDestinatario] = useState<Destinatario | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [busquedaError, setBusquedaError] = useState('')

  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('Varios')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const cuentaUSD = cuentas.find((c) => c.moneda === 'USD')
  const cuentaOrigen = monedaOrigen === 'USD' && cuentaUSD ? cuentaUSD : cuenta
  const recientes = useTransferenciasRecientes(cuentaOrigen?.id, 6)

  const oficial = mercado?.dolares.find((d) => d.casa === 'oficial')
  const montoNum = parseFloat(monto) || 0
  const esConversion = !!(cuentaOrigen && destinatario && cuentaOrigen.moneda !== destinatario.moneda)
  const montoDestino = esConversion && oficial && cuentaOrigen && destinatario
    ? convertir(montoNum, cuentaOrigen.moneda, destinatario.moneda, oficial)
    : montoNum
  const precioUsado = esConversion && oficial && cuentaOrigen
    ? (cuentaOrigen.moneda === 'ARS' ? oficial.venta : oficial.compra)
    : null

  useEffect(() => {
    const state = location.state as { cbu?: string; fromCerca?: boolean } | null
    if (state?.cbu) {
      setDestino(state.cbu)
      buscarDestinatario(state.cbu)
      if (state.fromCerca) {
        toast.success('Persona identificada al acercar el celular')
      }
    }
  }, [])

  async function buscarDestinatario(override?: string) {
    const input = (override ?? destino).trim()
    if (!input) return
    setBuscando(true)
    setBusquedaError('')
    setDestinatario(null)

    try {
      const esCBU = /^\d{22}$/.test(input)

      let localQuery = supabase
        .from('cuentas')
        .select('id, saldo, cbu, alias, moneda, personas(nombre, apellido, dni)')
        .eq('activa', true)
      localQuery = esCBU ? localQuery.eq('cbu', input) : localQuery.ilike('alias', input)
      const { data: cuentaLocal } = await localQuery.maybeSingle()

      if (cuentaLocal) {
        const p = cuentaLocal.personas as unknown as { nombre: string; apellido: string; dni: string }
        setDestinatario({
          nombre: p.nombre,
          apellido: p.apellido,
          dni: p.dni,
          cbu: cuentaLocal.cbu,
          alias: cuentaLocal.alias,
          moneda: cuentaLocal.moneda,
          cuentaId: cuentaLocal.id,
          saldoActual: cuentaLocal.saldo,
        })
        return
      }

      const bc = await buscarDestinatarioBC(input, esCBU)
      setDestinatario({
        nombre: bc.nombre,
        apellido: bc.apellido,
        dni: bc.dni,
        cbu: bc.cbu,
        alias: bc.alias,
        moneda: bc.moneda,
      })
    } catch {
      setBusquedaError('No se encontró ninguna cuenta con ese CBU o alias')
    } finally {
      setBuscando(false)
    }
  }

  async function seleccionarAcceso(cbu: string) {
    setDestino(cbu)
    await buscarDestinatario(cbu)
  }

  function toggleAgenda() {
    if (!destinatario) return
    if (isGuardado(destinatario.cbu)) {
      eliminar(destinatario.cbu)
    } else {
      guardar({
        nombre: destinatario.nombre,
        apellido: destinatario.apellido,
        cbu: destinatario.cbu,
        alias: destinatario.alias,
        apodo: null,
      })
    }
  }

  function irADetalle() {
    if (!destinatario) return
    // Si el destinatario es de la otra moneda, arrancamos el origen en la
    // misma moneda que él para que el caso simple (sin conversión) sea el
    // default — el usuario puede cambiarlo igual en el paso siguiente.
    if (destinatario.moneda !== monedaOrigen && !(destinatario.moneda === 'USD' && !cuentaUSD)) {
      setMonedaOrigen(destinatario.moneda)
    }
    setError('')
    setStep('detalle')
  }

  function handleDetalleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!cuentaOrigen || !destinatario) return
    if (isNaN(montoNum) || montoNum <= 0) { setError('Ingresá un monto válido'); return }
    if (montoNum > cuentaOrigen.saldo) { setError('Saldo insuficiente para realizar la transferencia'); return }
    if (destinatario.cbu === cuentaOrigen.cbu) { setError('No podés transferirte a vos mismo'); return }
    if (esConversion && !oficial) { setError('No pudimos obtener la cotización del día. Probá de nuevo en un momento.'); return }
    setStep('resumen')
  }

  async function handleConfirm() {
    if (!destinatario || !cuentaOrigen) return
    if (!cuentaOrigen.cbu) { setError('Tu cuenta no tiene CBU asignado. Contactá al soporte.'); return }
    setLoading(true)
    setError('')

    try {
      // El importe que viaja al Banco Central es el que recibe la cuenta
      // destino, en SU moneda — así lo puede acreditar cualquier banco que
      // lea la transacción (nuestro propio sync incluido).
      await transferir(cuentaOrigen.cbu, destinatario.cbu, montoDestino, cuentaOrigen.saldo)

      const nuevoSaldoOrigen = roundMoney(cuentaOrigen.saldo - montoNum)
      const descValue = mensaje.trim() ? `${descripcion}|${mensaje.trim()}` : descripcion

      const { error: errSaldoOrigen } = await supabase
        .from('cuentas').update({ saldo: nuevoSaldoOrigen }).eq('id', cuentaOrigen.id)
      if (errSaldoOrigen) throw new Error()

      if (destinatario.cuentaId && destinatario.saldoActual !== undefined) {
        const nuevoSaldoDestino = roundMoney(destinatario.saldoActual + montoDestino)
        await supabase.from('cuentas').update({ saldo: nuevoSaldoDestino }).eq('id', destinatario.cuentaId)
        await supabase.from('movimientos').insert({
          cuenta_id: destinatario.cuentaId,
          tipo: 'transferencia_entrada',
          monto: montoDestino,
          saldo_resultante: nuevoSaldoDestino,
          descripcion: descValue,
          cuenta_destino_id: cuentaOrigen.id,
          destinatario_nombre: persona?.nombre ?? null,
          destinatario_apellido: persona?.apellido ?? null,
          destinatario_dni: persona?.dni ?? null,
          destino_cbu: cuentaOrigen.cbu ?? null,
          destino_alias: cuentaOrigen.alias ?? null,
        })
      }

      await supabase.from('movimientos').insert({
        cuenta_id: cuentaOrigen.id,
        tipo: 'transferencia_salida',
        monto: montoNum,
        saldo_resultante: nuevoSaldoOrigen,
        descripcion: descValue,
        cuenta_destino_id: destinatario.cuentaId ?? null,
        destinatario_nombre: destinatario.nombre,
        destinatario_apellido: destinatario.apellido,
        destinatario_dni: destinatario.dni ?? null,
        destino_cbu: destinatario.cbu,
        destino_alias: destinatario.alias ?? null,
      })

      updateSaldoCuenta(cuentaOrigen.id, nuevoSaldoOrigen)
      await refreshCuenta()
      setStep('exito')
      toast.success('¡Transferencia realizada con éxito!')
    } catch {
      setError('Ocurrió un error al procesar la transferencia')
      toast.error('No se pudo completar la transferencia')
      setStep('resumen')
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setStep('buscar')
    setDestino('')
    setDestinatario(null)
    setBusquedaError('')
    setMonto('')
    setDescripcion('Varios')
    setMensaje('')
    setError('')
  }

  const monedaActual = cuentaOrigen?.moneda ?? 'ARS'
  const saldoFormateado = formatMonto(cuentaOrigen?.saldo ?? 0, monedaActual)
  const montoFormateado = formatMonto(montoNum || 0, monedaActual)
  const montoDestinoFormateado = destinatario ? formatMonto(montoDestino, destinatario.moneda) : ''
  const recientesFiltrados = recientes.filter((r) => !isGuardado(r.cbu))

  return (
    <PageWrapper>
      <div className="flex gap-6 items-start max-w-4xl mx-auto">

        {/* Agenda — sólo en el paso de búsqueda, desktop */}
        {step === 'buscar' && (
          <aside className="hidden lg:block w-72 shrink-0 sticky top-6">
            <AgendaContactosPanel onSelectContacto={seleccionarAcceso} />
          </aside>
        )}

        {/* Columna principal */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <h1 className="font-display text-2xl font-semibold text-navy dark:text-white">Transferir</h1>

          {/* Agenda en mobile — sólo en el paso de búsqueda */}
          {step === 'buscar' && <MobileAgendaAccordion onSelectContacto={seleccionarAcceso} />}

          {/* Steps con AnimatePresence */}
          <AnimatePresence mode="wait">

            {/* ── Paso 1: Buscar destinatario ── */}
            {step === 'buscar' && (
              <motion.div key="buscar" variants={stepVariants} initial="initial" animate="animate" exit="exit">
                <Card className="p-8">
                  <div>
                    <label className="block text-sm font-body text-slate-secondary mb-1">CBU o alias destino</label>
                    <div className="flex gap-2">
                      <input
                        className="flex-1 bg-slate-input dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-3 text-navy dark:text-white font-body text-sm placeholder-slate-secondary focus:outline-none focus:border-mint/50 transition-colors"
                        placeholder="22 dígitos o alias.banco"
                        value={destino}
                        onChange={(e) => { setDestino(e.target.value); setDestinatario(null); setBusquedaError('') }}
                        onKeyDown={(e) => e.key === 'Enter' && buscarDestinatario()}
                      />
                      <button
                        type="button"
                        onClick={() => buscarDestinatario()}
                        disabled={!destino.trim() || buscando}
                        className="px-4 rounded-xl bg-mint/10 border border-mint/20 text-mint hover:bg-mint/20 transition-colors disabled:opacity-40"
                      >
                        <Search size={18} />
                      </button>
                    </div>

                    {busquedaError && <p className="text-xs text-red-500 dark:text-red-400 font-body mt-1">{busquedaError}</p>}
                    {buscando && <p className="text-xs text-slate-secondary font-body mt-1">Buscando...</p>}

                    {destinatario && (
                      <div className="mt-3 px-4 py-3 rounded-xl bg-mint/10 border border-mint/20 flex items-center gap-3">
                        <Iniciales nombre={destinatario.nombre} apellido={destinatario.apellido} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-body font-medium text-mint truncate">
                            {destinatario.nombre} {destinatario.apellido}
                          </p>
                          <p className="text-xs font-body text-slate-secondary mt-0.5 truncate">
                            CBU: {destinatario.cbu}
                          </p>
                          <span className={`inline-block mt-1 text-[10px] font-body font-medium uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            destinatario.moneda === 'USD' ? 'bg-mint/20 text-mint' : 'bg-navy/10 text-navy dark:bg-white/10 dark:text-white'
                          }`}>
                            {destinatario.moneda === 'USD' ? 'Cuenta en dólares' : 'Cuenta en pesos'}
                          </span>
                        </div>
                        {isGuardado(destinatario.cbu) ? (
                          <button
                            type="button"
                            onClick={toggleAgenda}
                            title="En tu agenda — click para quitar"
                            className="shrink-0 text-mint hover:text-mint/60 transition-colors"
                          >
                            <Star size={18} fill="currentColor" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={toggleAgenda}
                            title="Agregar a agenda"
                            className="shrink-0 text-slate-secondary hover:text-mint transition-colors"
                          >
                            <UserPlus size={17} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <Button
                    type="button"
                    className="w-full mt-6 flex items-center justify-center gap-2"
                    disabled={!destinatario}
                    onClick={irADetalle}
                  >
                    Continuar
                    <ArrowRight size={16} />
                  </Button>
                </Card>
              </motion.div>
            )}

            {/* ── Paso 2: Monto y cuenta origen ── */}
            {step === 'detalle' && destinatario && (
              <motion.div key="detalle" variants={stepVariants} initial="initial" animate="animate" exit="exit">
                <Card className="p-8">
                  <button
                    type="button"
                    onClick={() => setStep('buscar')}
                    className="flex items-center gap-1.5 text-sm font-body text-slate-secondary hover:text-navy dark:hover:text-white transition-colors mb-4"
                  >
                    <ArrowLeft size={15} />
                    Cambiar destinatario
                  </button>

                  <div className="flex items-center gap-3 mb-6 px-4 py-3 rounded-xl bg-slate-input dark:bg-white/5">
                    <Iniciales nombre={destinatario.nombre} apellido={destinatario.apellido} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-body font-medium text-navy dark:text-white truncate">
                        {destinatario.nombre} {destinatario.apellido}
                      </p>
                      <p className="text-xs font-body text-slate-secondary truncate">{destinatario.alias ?? destinatario.cbu}</p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-body font-medium uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      destinatario.moneda === 'USD' ? 'bg-mint/20 text-mint' : 'bg-navy/10 text-navy dark:bg-white/10 dark:text-white'
                    }`}>
                      {destinatario.moneda === 'USD' ? 'USD' : 'ARS'}
                    </span>
                  </div>

                  {cuentaUSD && (
                    <div className="grid grid-cols-2 gap-2 mb-6 p-1 rounded-xl bg-slate-input dark:bg-white/5">
                      <button
                        type="button"
                        onClick={() => setMonedaOrigen('ARS')}
                        className={`rounded-lg py-2.5 font-body text-sm font-medium transition-colors ${
                          monedaOrigen === 'ARS' ? 'bg-mint text-navy' : 'text-slate-secondary hover:text-navy dark:hover:text-white'
                        }`}
                      >
                        Desde pesos
                      </button>
                      <button
                        type="button"
                        onClick={() => setMonedaOrigen('USD')}
                        className={`rounded-lg py-2.5 font-body text-sm font-medium transition-colors ${
                          monedaOrigen === 'USD' ? 'bg-mint text-navy' : 'text-slate-secondary hover:text-navy dark:hover:text-white'
                        }`}
                      >
                        Desde dólares
                      </button>
                    </div>
                  )}

                  <p className="font-body text-sm text-slate-secondary mb-1">Saldo disponible</p>
                  <p className="font-display text-2xl font-bold text-mint mb-6">{saldoFormateado}</p>

                  <form onSubmit={handleDetalleSubmit} className="flex flex-col gap-4">
                    <Input label={`Monto en ${monedaActual === 'USD' ? 'dólares' : 'pesos'}`} type="number" min="0.01" step="0.01" placeholder="0.00"
                      value={monto} onChange={(e) => setMonto(e.target.value)} required />

                    {esConversion && (
                      <div className="rounded-xl bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/20 px-4 py-3 flex gap-2.5">
                        <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                        <p className="font-body text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                          {montoNum > 0 && oficial ? (
                            <>Este monto se convertirá a <strong>{montoDestinoFormateado}</strong> según la cotización oficial del día (${oficial.compra.toLocaleString('es-AR')} / ${oficial.venta.toLocaleString('es-AR')}).{' '}</>
                          ) : (
                            'El monto se va a convertir según la cotización oficial del día. '
                          )}
                          Recordá que la cuenta destino es {destinatario.moneda === 'USD' ? 'una cuenta en dólares' : 'una cuenta en pesos'}.
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-body font-medium text-slate-secondary">
                        Motivo
                      </label>
                      <div className="relative">
                        <select
                          value={descripcion}
                          onChange={(e) => setDescripcion(e.target.value)}
                          className="w-full appearance-none rounded-xl px-4 py-3 pr-10 font-body text-sm text-navy dark:text-white bg-slate-input dark:bg-white/5 border border-slate-300 dark:border-white/10 focus:outline-none focus:border-mint focus:ring-1 focus:ring-mint/20 transition-colors cursor-pointer"
                        >
                          {MOTIVOS_GRUPOS.map(({ grupo, items }) => (
                            <optgroup key={grupo} label={grupo}>
                              {items.map((m) => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <ChevronDown
                          size={16}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-secondary pointer-events-none"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-body font-medium text-slate-secondary">
                        Mensaje <span className="font-normal text-slate-secondary/60">(opcional)</span>
                      </label>
                      <input
                        className="w-full rounded-xl px-4 py-3 font-body text-sm text-navy dark:text-white bg-slate-input dark:bg-white/5 border border-slate-300 dark:border-white/10 focus:outline-none focus:border-mint/50 transition-colors placeholder-slate-secondary/60"
                        placeholder="Ej: Pago alquiler enero"
                        value={mensaje}
                        onChange={(e) => setMensaje(e.target.value)}
                        maxLength={120}
                      />
                    </div>

                    {error && <p className="text-sm text-red-500 dark:text-red-400 font-body bg-red-50 dark:bg-red-400/10 rounded-xl px-4 py-3">{error}</p>}

                    <Button type="submit" className="w-full mt-2 flex items-center justify-center gap-2">
                      Continuar
                      <ArrowRight size={16} />
                    </Button>
                  </form>
                </Card>
              </motion.div>
            )}

            {/* ── Paso 3: Resumen y confirmación ── */}
            {step === 'resumen' && destinatario && cuentaOrigen && (
              <motion.div key="resumen" variants={stepVariants} initial="initial" animate="animate" exit="exit">
                <Card className="p-8">
                  <button
                    type="button"
                    onClick={() => setStep('detalle')}
                    className="flex items-center gap-1.5 text-sm font-body text-slate-secondary hover:text-navy dark:hover:text-white transition-colors mb-4"
                    disabled={loading}
                  >
                    <ArrowLeft size={15} />
                    Volver
                  </button>

                  <h2 className="font-display text-lg font-semibold text-navy dark:text-white mb-6">Revisá la transferencia</h2>
                  <div className="flex flex-col gap-4 mb-8">
                    <div className="flex justify-between">
                      <span className="font-body text-slate-secondary text-sm">Destinatario</span>
                      <span className="font-body font-medium text-navy dark:text-white text-sm text-right">{destinatario.nombre} {destinatario.apellido}</span>
                    </div>
                    <div className="h-px bg-slate-200 dark:bg-white/10" />
                    <div className="flex justify-between">
                      <span className="font-body text-slate-secondary text-sm">CBU</span>
                      <span className="font-body text-navy dark:text-white text-sm text-right">{destinatario.cbu}</span>
                    </div>
                    <div className="h-px bg-slate-200 dark:bg-white/10" />
                    <div className="flex justify-between">
                      <span className="font-body text-slate-secondary text-sm">Desde</span>
                      <span className="font-body text-navy dark:text-white text-sm">
                        {cuentaOrigen.moneda === 'USD' ? 'Tu cuenta en dólares' : 'Tu cuenta en pesos'}
                      </span>
                    </div>
                    <div className="h-px bg-slate-200 dark:bg-white/10" />
                    <div className="flex justify-between">
                      <span className="font-body text-slate-secondary text-sm">Enviás</span>
                      <span className="font-display font-bold text-mint text-lg">{montoFormateado}</span>
                    </div>
                    {esConversion && (
                      <>
                        <div className="h-px bg-slate-200 dark:bg-white/10" />
                        <div className="flex justify-between">
                          <span className="font-body text-slate-secondary text-sm">
                            {destinatario.nombre} recibe
                          </span>
                          <span className="font-display font-bold text-navy dark:text-white text-lg">{montoDestinoFormateado}</span>
                        </div>
                        {precioUsado != null && (
                          <p className="font-body text-xs text-slate-secondary -mt-2">
                            Cotización oficial utilizada: ${precioUsado.toLocaleString('es-AR')}
                          </p>
                        )}
                      </>
                    )}
                    <div className="h-px bg-slate-200 dark:bg-white/10" />
                    <div className="flex justify-between">
                      <span className="font-body text-slate-secondary text-sm">Motivo</span>
                      <span className="font-body text-navy dark:text-white text-sm">{descripcion}</span>
                    </div>
                    {mensaje.trim() && (
                      <>
                        <div className="h-px bg-slate-200 dark:bg-white/10" />
                        <div className="flex justify-between">
                          <span className="font-body text-slate-secondary text-sm">Mensaje</span>
                          <span className="font-body text-navy dark:text-white text-sm text-right max-w-[60%]">{mensaje.trim()}</span>
                        </div>
                      </>
                    )}
                  </div>
                  {error && <p className="text-sm text-red-500 dark:text-red-400 font-body bg-red-50 dark:bg-red-400/10 rounded-xl px-4 py-3 mb-4">{error}</p>}
                  <div className="flex gap-3">
                    <Button variant="secondary" className="flex-1" onClick={() => setStep('detalle')} disabled={loading}>Editar</Button>
                    <Button className="flex-1" loading={loading} onClick={handleConfirm}>Confirmar</Button>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ── Paso 4: Éxito ── */}
            {step === 'exito' && (
              <motion.div key="exito" variants={stepVariants} initial="initial" animate="animate" exit="exit">
                <Card className="p-8 text-center">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                  >
                    <CheckCircle size={56} className="text-mint mx-auto mb-4" />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.25 }}
                  >
                    <h2 className="font-display text-xl font-semibold text-navy dark:text-white mb-2">¡Transferencia exitosa!</h2>
                    <p className="font-body text-slate-secondary mb-2">
                      Enviaste {montoFormateado} a {destinatario?.nombre} {destinatario?.apellido}
                      {esConversion && <> ({destinatario?.nombre} recibió {montoDestinoFormateado})</>}
                    </p>
                    <p className="font-body text-sm text-slate-secondary mb-8">
                      Nuevo saldo: <span className="text-mint font-medium">{saldoFormateado}</span>
                    </p>
                    <div className="flex flex-col gap-3">
                      {destinatario && !isGuardado(destinatario.cbu) && (
                        <button
                          onClick={() => guardar({
                            nombre: destinatario.nombre,
                            apellido: destinatario.apellido,
                            cbu: destinatario.cbu,
                            alias: destinatario.alias,
                            apodo: null,
                          })}
                          className="w-full py-2.5 rounded-xl border border-mint/30 bg-mint/10 text-mint font-body font-medium text-sm hover:bg-mint/20 transition-colors flex items-center justify-center gap-2"
                        >
                          <UserPlus size={15} />
                          Agregar a contactos
                        </button>
                      )}
                      {destinatario && isGuardado(destinatario.cbu) && (
                        <p className="text-sm font-body text-mint/80 text-center">
                          ✓ Guardado en tu agenda
                        </p>
                      )}
                      <Button className="w-full" onClick={handleReset}>Nueva transferencia</Button>
                      <Button variant="secondary" className="w-full flex items-center justify-center gap-2" onClick={() => navigate('/dashboard')}>
                        <Home size={16} />
                        Volver al inicio
                      </Button>
                    </div>
                  </motion.div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Transferencias recientes — sólo en el paso de búsqueda */}
          {step === 'buscar' && recientesFiltrados.length > 0 && (
            <div>
              <p className="font-body text-xs text-slate-secondary uppercase tracking-wider mb-3">Recientes</p>
              <div className="flex flex-col gap-1.5">
                {recientesFiltrados.map((r) => (
                  <button
                    key={r.cbu}
                    onClick={() => seleccionarAcceso(r.cbu)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-navy-card border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/25 transition-colors text-left w-full"
                  >
                    <Iniciales nombre={r.nombre} apellido={r.apellido} />
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm font-medium text-navy dark:text-white truncate">{r.nombre} {r.apellido}</p>
                      <p className="font-body text-xs text-slate-secondary truncate">{r.cbu}</p>
                    </div>
                    <span className="font-body text-xs text-slate-secondary shrink-0">
                      {new Date(r.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}

function MobileAgendaAccordion({ onSelectContacto }: { onSelectContacto: (cbu: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="lg:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-white dark:bg-navy-card border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-colors text-sm font-body text-slate-secondary hover:text-navy dark:hover:text-white"
      >
        <span>Agenda de contactos</span>
        <span className="text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="mt-2">
          <AgendaContactosPanel onSelectContacto={(cbu) => { onSelectContacto(cbu); setOpen(false) }} />
        </div>
      )}
    </div>
  )
}
