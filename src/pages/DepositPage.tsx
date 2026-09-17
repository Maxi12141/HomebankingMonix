import { useMemo, useState } from 'react'
import { CheckCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import { useCuenta } from '../hooks/useCuenta'
import { useCuentaStore } from '../store/cuentaStore'
import { formatMonto } from '../utils/cuenta'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

type Step = 'form' | 'success'

const stepVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, y: -16, transition: { duration: 0.2 } },
}

function parseMonto(raw: string) {
  const n = parseFloat(raw.replace(/\s/g, '').replace(',', '.'))
  return n
}

export function DepositPage() {
  const { cuenta, cuentas, refreshCuenta } = useCuenta()
  const { updateSaldoCuenta } = useCuentaStore()

  const [step, setStep] = useState<Step>('form')
  const [cuentaId, setCuentaId] = useState<string | null>(null)
  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [depositado, setDepositado] = useState<{ monto: number; saldo: number; moneda: 'ARS' | 'USD' } | null>(null)

  const cuentaARS = useMemo(
    () => cuentas.find((c) => c.moneda === 'ARS') ?? cuenta,
    [cuentas, cuenta],
  )
  const cuentaUSD = useMemo(
    () => cuentas.find((c) => c.moneda === 'USD') ?? null,
    [cuentas],
  )
  const cuentaDestino = useMemo(
    () => cuentas.find((c) => c.id === cuentaId) ?? cuentaARS ?? null,
    [cuentas, cuentaId, cuentaARS],
  )

  const montoNum = parseMonto(monto)
  const moneda = cuentaDestino?.moneda ?? 'ARS'
  const saldoFormateado = formatMonto(cuentaDestino?.saldo ?? depositado?.saldo ?? 0, moneda)
  const montoFormateado = formatMonto(Number.isFinite(montoNum) ? montoNum : depositado?.monto ?? 0, moneda)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!cuentaDestino) {
      setError('No encontramos tu cuenta. Probá recargar.')
      return
    }
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      setError('Ingresá un monto válido')
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data, error: errDep } = await supabase.rpc('depositar_en_cuenta', {
        p_cuenta_id: cuentaDestino.id,
        p_monto: montoNum,
        p_descripcion: descripcion.trim() || null,
      })
      if (errDep) throw new Error(errDep.message || 'No se pudo depositar')

      const nuevoSaldo = Number(data)
      if (!Number.isFinite(nuevoSaldo)) throw new Error('No se pudo depositar')

      updateSaldoCuenta(cuentaDestino.id, nuevoSaldo)
      setDepositado({ monto: montoNum, saldo: nuevoSaldo, moneda: cuentaDestino.moneda })
      setStep('success')
      toast.success('¡Depósito realizado con éxito!')
      void refreshCuenta()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ocurrió un error al procesar el depósito'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setStep('form')
    setMonto('')
    setDescripcion('')
    setError('')
    setDepositado(null)
  }

  return (
    <PageWrapper>
      <div className="max-w-md mx-auto">
        <h1 className="font-display text-2xl font-semibold text-navy dark:text-white mb-6">Depositar</h1>

        <AnimatePresence mode="wait">
          {step === 'form' && (
            <motion.div key="form" variants={stepVariants} initial="initial" animate="animate" exit="exit">
              <Card className="p-8">
                {cuentaUSD && cuentaARS && (
                  <div className="grid grid-cols-2 gap-2 mb-6 p-1 rounded-xl bg-slate-input dark:bg-white/5">
                    <button
                      type="button"
                      onClick={() => setCuentaId(cuentaARS.id)}
                      className={`rounded-lg py-2.5 font-body text-sm font-medium transition-colors ${
                        moneda === 'ARS'
                          ? 'bg-mint text-navy'
                          : 'text-slate-secondary hover:text-navy dark:hover:text-white'
                      }`}
                    >
                      Cuenta en pesos
                    </button>
                    <button
                      type="button"
                      onClick={() => setCuentaId(cuentaUSD.id)}
                      className={`rounded-lg py-2.5 font-body text-sm font-medium transition-colors ${
                        moneda === 'USD'
                          ? 'bg-mint text-navy'
                          : 'text-slate-secondary hover:text-navy dark:hover:text-white'
                      }`}
                    >
                      Cuenta en dólares
                    </button>
                  </div>
                )}

                <p className="font-body text-sm text-slate-secondary mb-1">Saldo actual</p>
                <p className="font-display text-2xl font-bold text-mint mb-6">{saldoFormateado}</p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <Input
                    label="Monto a depositar"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    required
                  />
                  <Input
                    label="Descripción (opcional)"
                    placeholder="Ej: Depósito en efectivo"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                  />

                  {error && (
                    <p className="text-sm text-red-500 dark:text-red-400 font-body bg-red-50 dark:bg-red-400/10 rounded-xl px-4 py-3">{error}</p>
                  )}

                  <Button type="submit" className="w-full mt-2" loading={loading} disabled={!cuentaDestino}>
                    {!loading && Number.isFinite(montoNum) && montoNum > 0 ? `Depositar ${montoFormateado}` : 'Depositar'}
                  </Button>
                </form>
              </Card>
            </motion.div>
          )}

          {step === 'success' && depositado && (
            <motion.div key="success" variants={stepVariants} initial="initial" animate="animate" exit="exit">
              <Card className="p-8 text-center">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <CheckCircle size={56} className="text-mint mx-auto mb-4" />
                </motion.div>
                <h2 className="font-display text-xl font-semibold text-navy dark:text-white mb-2">¡Depósito exitoso!</h2>
                <p className="font-body text-slate-secondary mb-2">
                  Depositaste {formatMonto(depositado.monto, depositado.moneda)}
                </p>
                <p className="font-body text-sm text-slate-secondary mb-8">
                  Nuevo saldo: <span className="text-mint font-medium">{formatMonto(depositado.saldo, depositado.moneda)}</span>
                </p>
                <Button className="w-full" onClick={handleReset}>Nuevo depósito</Button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageWrapper>
  )
}
