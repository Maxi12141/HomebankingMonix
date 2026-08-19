import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { CheckCircle, Search, Star, Home, UserPlus, ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import { transferir, buscarDestinatarioBC } from '../services/bancoCentral'
import { useCuenta } from '../hooks/useCuenta'
import { useCuentaStore } from '../store/cuentaStore'
import { useAuthStore } from '../store/authStore'
import { useContactos } from '../hooks/useContactos'
import { useTransferenciasRecientes } from '../hooks/useTransferenciasRecientes'
import { AgendaContactosPanel } from '../components/AgendaContactosPanel'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

type Step = 'form' | 'confirm' | 'success'

interface Destinatario {
  nombre: string
  apellido: string
  dni: string | null
  cbu: string
  alias: string | null
  moneda: 'ARS' | 'USD'
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

export function TransferPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { cuenta, refreshCuenta } = useCuenta()
  const { updateSaldo } = useCuentaStore()
  const { persona } = useAuthStore()
  const { isGuardado, guardar, eliminar } = useContactos()
  const recientes = useTransferenciasRecientes(6)

  const [step, setStep] = useState<Step>('form')
  const [destino, setDestino] = useState('')
  const [destinatario, setDestinatario] = useState<Destinatario | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [busquedaError, setBusquedaError] = useState('')

  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('Varios')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const montoNum = parseFloat(monto)

  useEffect(() => {
    const state = location.state as { cbu?: string } | null
    if (state?.cbu) {
      setDestino(state.cbu)
      buscarDestinatario(state.cbu)
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

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!cuenta || !destinatario) return
    if (isNaN(montoNum) || montoNum <= 0) { setError('Ingresá un monto válido'); return }
    if (montoNum > cuenta.saldo) { setError('Saldo insuficiente para realizar la transferencia'); return }
    if (destinatario.cbu === cuenta.cbu) { setError('No podés transferirte a vos mismo'); return }
    if (destinatario.moneda !== cuenta.moneda) { setError('Todavía no se pueden hacer transferencias entre cuentas de distinta moneda'); return }
    setStep('confirm')
  }

  async function handleConfirm() {
    if (!destinatario) return
    if (!cuenta?.cbu) { setError('Tu cuenta no tiene CBU asignado. Contactá al soporte.'); return }
    setLoading(true)
    setError('')

    try {
      await transferir(cuenta.cbu, destinatario.cbu, montoNum, cuenta.saldo)

      const nuevoSaldoOrigen = cuenta.saldo - montoNum
      const descValue = mensaje.trim() ? `${descripcion}|${mensaje.trim()}` : descripcion

      const { error: errSaldoOrigen } = await supabase
        .from('cuentas').update({ saldo: nuevoSaldoOrigen }).eq('id', cuenta.id)
      if (errSaldoOrigen) throw new Error()

      if (destinatario.cuentaId && destinatario.saldoActual !== undefined) {
        const nuevoSaldoDestino = destinatario.saldoActual + montoNum
        await supabase.from('cuentas').update({ saldo: nuevoSaldoDestino }).eq('id', destinatario.cuentaId)
        await supabase.from('movimientos').insert({
          cuenta_id: destinatario.cuentaId,
          tipo: 'transferencia_entrada',
          monto: montoNum,
          saldo_resultante: nuevoSaldoDestino,
          descripcion: descValue,
          cuenta_destino_id: cuenta.id,
          destinatario_nombre: persona?.nombre ?? null,
          destinatario_apellido: persona?.apellido ?? null,
          destinatario_dni: persona?.dni ?? null,
          destino_cbu: cuenta.cbu ?? null,
          destino_alias: cuenta.alias ?? null,
        })
      }

      await supabase.from('movimientos').insert({
        cuenta_id: cuenta.id,
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

      updateSaldo(nuevoSaldoOrigen)
      await refreshCuenta()
      setStep('success')
      toast.success('¡Transferencia realizada con éxito!')
    } catch {
      setError('Ocurrió un error al procesar la transferencia')
      toast.error('No se pudo completar la transferencia')
      setStep('form')
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setStep('form')
    setDestino('')
    setDestinatario(null)
    setBusquedaError('')
    setMonto('')
    setDescripcion('Varios')
    setMensaje('')
    setError('')
  }

  const saldoFormateado = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(cuenta?.saldo ?? 0)
  const montoFormateado = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(montoNum || 0)
  const recientesFiltrados = recientes.filter((r) => !isGuardado(r.cbu))

  return (
    <PageWrapper>
      <div className="flex gap-6 items-start max-w-4xl mx-auto">

        {/* Agenda — solo desktop */}
        <aside className="hidden lg:block w-72 shrink-0 sticky top-6">
          <AgendaContactosPanel onSelectContacto={seleccionarAcceso} />
        </aside>

        {/* Columna principal */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <h1 className="font-display text-2xl font-semibold text-navy dark:text-white">Transferir</h1>

          {/* Agenda en mobile */}
          <MobileAgendaAccordion onSelectContacto={seleccionarAcceso} />

          {/* Steps con AnimatePresence */}
          <AnimatePresence mode="wait">

            {/* ── Paso: Formulario ── */}
            {step === 'form' && (
              <motion.div key="form" variants={stepVariants} initial="initial" animate="animate" exit="exit">
                <Card className="p-8">
                  <p className="font-body text-sm text-slate-secondary mb-1">Saldo disponible</p>
                  <p className="font-display text-2xl font-bold text-mint mb-6">{saldoFormateado}</p>

                  <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
                    <div>
                      <label className="block text-sm font-body text-slate-secondary mb-1">CBU o alias destino</label>
                      <div className="flex gap-2">
                        <input
                          className="flex-1 bg-slate-input dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-3 text-navy dark:text-white font-body text-sm placeholder-slate-secondary focus:outline-none focus:border-mint/50 transition-colors"
                          placeholder="22 dígitos o alias.banco"
                          value={destino}
                          onChange={(e) => { setDestino(e.target.value); setDestinatario(null); setBusquedaError('') }}
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
                        <div className="mt-2 px-4 py-3 rounded-xl bg-mint/10 border border-mint/20 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-body font-medium text-mint truncate">
                              {destinatario.nombre} {destinatario.apellido}
                            </p>
                            <p className="text-xs font-body text-slate-secondary mt-0.5 truncate">
                              CBU: {destinatario.cbu}
                              {!destinatario.cuentaId && ' · Banco externo'}
                            </p>
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

                    <Input label="Monto" type="number" min="0.01" step="0.01" placeholder="0.00"
                      value={monto} onChange={(e) => setMonto(e.target.value)} required />
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

                    <Button type="submit" className="w-full mt-2" disabled={!destinatario}>
                      Continuar
                    </Button>
                  </form>
                </Card>
              </motion.div>
            )}

            {/* ── Paso: Confirmar ── */}
            {step === 'confirm' && destinatario && (
              <motion.div key="confirm" variants={stepVariants} initial="initial" animate="animate" exit="exit">
                <Card className="p-8">
                  <h2 className="font-display text-lg font-semibold text-navy dark:text-white mb-6">Confirmá la transferencia</h2>
                  <div className="flex flex-col gap-4 mb-8">
                    <div className="flex justify-between">
                      <span className="font-body text-slate-secondary text-sm">Destinatario</span>
                      <span className="font-body font-medium text-navy dark:text-white text-sm">{destinatario.nombre} {destinatario.apellido}</span>
                    </div>
                    <div className="h-px bg-slate-200 dark:bg-white/10" />
                    <div className="flex justify-between">
                      <span className="font-body text-slate-secondary text-sm">CBU</span>
                      <span className="font-body text-navy dark:text-white text-sm">{destinatario.cbu}</span>
                    </div>
                    <div className="h-px bg-slate-200 dark:bg-white/10" />
                    <div className="flex justify-between">
                      <span className="font-body text-slate-secondary text-sm">Monto</span>
                      <span className="font-display font-bold text-mint text-lg">{montoFormateado}</span>
                    </div>
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
                    <Button variant="secondary" className="flex-1" onClick={() => setStep('form')} disabled={loading}>Volver</Button>
                    <Button className="flex-1" loading={loading} onClick={handleConfirm}>Confirmar</Button>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* ── Paso: Éxito ── */}
            {step === 'success' && (
              <motion.div key="success" variants={stepVariants} initial="initial" animate="animate" exit="exit">
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

          {/* Transferencias recientes */}
          {step === 'form' && recientesFiltrados.length > 0 && (
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
