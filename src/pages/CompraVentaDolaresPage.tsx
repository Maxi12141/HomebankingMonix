import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, Lock, RefreshCw } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import { useCuenta } from '../hooks/useCuenta'
import { useCuentaStore } from '../store/cuentaStore'
import { useMercadoFinanciero } from '../hooks/useMercadoFinanciero'
import { formatMonto } from '../utils/cuenta'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

type Modo = 'comprar' | 'vender'
type Step = 'form' | 'success'

const REFRESH_MS = 20_000

const stepVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, y: -16, transition: { duration: 0.2 } },
}

function roundMoney(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function CompraVentaDolaresPage() {
  const navigate = useNavigate()
  const { cuenta, cuentas, refreshCuenta } = useCuenta()
  const { updateSaldoCuenta } = useCuentaStore()
  const { data: mercado, loading: loadingCotizacion } = useMercadoFinanciero(REFRESH_MS)

  const [modo, setModo] = useState<Modo>('comprar')
  const [montoUsdStr, setMontoUsdStr] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<Step>('form')

  const cuentaUSD = cuentas.find((c) => c.moneda === 'USD')
  const oficial = mercado?.dolares.find((d) => d.casa === 'oficial')
  const precio = oficial ? (modo === 'comprar' ? oficial.venta : oficial.compra) : null

  const montoUsd = parseFloat(montoUsdStr) || 0
  const montoArs = precio ? roundMoney(montoUsd * precio) : 0

  function handleReset() {
    setStep('form')
    setMontoUsdStr('')
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!cuenta || !cuentaUSD || !precio) return
    if (isNaN(montoUsd) || montoUsd <= 0) {
      setError('Ingresá un monto en dólares válido')
      return
    }
    if (modo === 'comprar' && montoArs > cuenta.saldo) {
      setError('No tenés saldo suficiente en pesos')
      return
    }
    if (modo === 'vender' && montoUsd > cuentaUSD.saldo) {
      setError('No tenés saldo suficiente en dólares')
      return
    }

    setLoading(true)
    setError('')

    try {
      const nuevoSaldoArs = modo === 'comprar' ? cuenta.saldo - montoArs : cuenta.saldo + montoArs
      const nuevoSaldoUsd = modo === 'comprar' ? cuentaUSD.saldo + montoUsd : cuentaUSD.saldo - montoUsd
      const descripcion = `${modo === 'comprar' ? 'Compra' : 'Venta'} de USD|Cotización oficial ${formatMonto(precio, 'ARS')} por dólar`

      const { error: errArs } = await supabase.from('cuentas').update({ saldo: nuevoSaldoArs }).eq('id', cuenta.id)
      if (errArs) throw new Error('No se pudo actualizar tu cuenta en pesos')

      const { error: errUsd } = await supabase.from('cuentas').update({ saldo: nuevoSaldoUsd }).eq('id', cuentaUSD.id)
      if (errUsd) throw new Error('No se pudo actualizar tu cuenta en dólares')

      await supabase.from('movimientos').insert([
        {
          cuenta_id: cuenta.id,
          tipo: modo === 'comprar' ? 'extraccion' : 'deposito',
          monto: montoArs,
          saldo_resultante: nuevoSaldoArs,
          descripcion,
        },
        {
          cuenta_id: cuentaUSD.id,
          tipo: modo === 'comprar' ? 'deposito' : 'extraccion',
          monto: montoUsd,
          saldo_resultante: nuevoSaldoUsd,
          descripcion,
        },
      ])

      updateSaldoCuenta(cuenta.id, nuevoSaldoArs)
      updateSaldoCuenta(cuentaUSD.id, nuevoSaldoUsd)
      await refreshCuenta()
      setStep('success')
      toast.success(modo === 'comprar' ? '¡Compra realizada con éxito!' : '¡Venta realizada con éxito!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ocurrió un error al procesar la operación'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!cuentaUSD) {
    return (
      <PageWrapper>
        <div className="max-w-md mx-auto">
          <h1 className="font-display text-2xl font-semibold text-navy dark:text-white mb-6">Compra y Venta de dólares</h1>
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-xl bg-slate-input dark:bg-white/5 p-2.5 text-slate-secondary">
                <Lock size={20} />
              </div>
              <div>
                <p className="font-display text-base font-semibold text-navy dark:text-white">Necesitás una cuenta en dólares</p>
                <p className="font-body text-xs text-slate-secondary">Todavía no tenés una</p>
              </div>
            </div>
            <p className="font-body text-sm text-slate-secondary mb-4">
              Para comprar o vender dólares primero tenés que abrir tu caja de ahorro en USD.
            </p>
            <Button className="w-full" onClick={() => navigate('/cuentas')}>Abrir cuenta en dólares</Button>
          </Card>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      <div className="max-w-md mx-auto">
        <h1 className="font-display text-2xl font-semibold text-navy dark:text-white mb-6">Compra y Venta de dólares</h1>

        <AnimatePresence mode="wait">
          {step === 'form' && (
            <motion.div key="form" variants={stepVariants} initial="initial" animate="animate" exit="exit">
              <Card className="p-8">
                <div className="grid grid-cols-2 gap-2 mb-6 p-1 rounded-xl bg-slate-input dark:bg-white/5">
                  <button
                    type="button"
                    onClick={() => { setModo('comprar'); setError('') }}
                    className={`rounded-lg py-2.5 font-body text-sm font-medium transition-colors ${
                      modo === 'comprar' ? 'bg-mint text-navy' : 'text-slate-secondary hover:text-navy dark:hover:text-white'
                    }`}
                  >
                    Comprar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setModo('vender'); setError('') }}
                    className={`rounded-lg py-2.5 font-body text-sm font-medium transition-colors ${
                      modo === 'vender' ? 'bg-mint text-navy' : 'text-slate-secondary hover:text-navy dark:hover:text-white'
                    }`}
                  >
                    Vender
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3 mb-6 rounded-xl bg-slate-input dark:bg-white/5 px-4 py-3">
                  <div>
                    <p className="font-body text-[10px] uppercase tracking-wider text-slate-secondary">Dólar oficial</p>
                    <p className="font-display text-sm font-semibold text-navy dark:text-white mt-0.5">
                      {oficial ? `Compra ${formatMonto(oficial.compra, 'ARS')} · Venta ${formatMonto(oficial.venta, 'ARS')}` : loadingCotizacion ? 'Cargando...' : 'No disponible'}
                    </p>
                  </div>
                  <RefreshCw size={14} className={`text-slate-secondary shrink-0 ${loadingCotizacion ? 'animate-spin' : ''}`} />
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <Input
                    label={modo === 'comprar' ? 'Monto a comprar (USD)' : 'Monto a vender (USD)'}
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={montoUsdStr}
                    onChange={(e) => setMontoUsdStr(e.target.value)}
                    required
                  />

                  <div className="rounded-xl bg-slate-input dark:bg-white/5 px-4 py-3">
                    <p className="font-body text-xs text-slate-secondary">
                      {modo === 'comprar' ? 'Vas a pagar' : 'Vas a recibir'}
                    </p>
                    <p className="font-display text-xl font-bold text-mint mt-0.5">
                      {formatMonto(montoArs, 'ARS')}
                    </p>
                  </div>

                  <p className="font-body text-xs text-slate-secondary">
                    Saldo en pesos: {formatMonto(cuenta?.saldo ?? 0, 'ARS')} · Saldo en dólares: {formatMonto(cuentaUSD.saldo, 'USD')}
                  </p>

                  {error && (
                    <p className="text-sm text-red-500 dark:text-red-400 font-body bg-red-50 dark:bg-red-400/10 rounded-xl px-4 py-3">{error}</p>
                  )}

                  <Button type="submit" className="w-full mt-2" loading={loading} disabled={!precio}>
                    {modo === 'comprar' ? 'Comprar dólares' : 'Vender dólares'}
                  </Button>
                </form>
              </Card>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div key="success" variants={stepVariants} initial="initial" animate="animate" exit="exit">
              <Card className="p-8 text-center">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <CheckCircle size={56} className="text-mint mx-auto mb-4" />
                </motion.div>
                <h2 className="font-display text-xl font-semibold text-navy dark:text-white mb-2">
                  {modo === 'comprar' ? '¡Compra exitosa!' : '¡Venta exitosa!'}
                </h2>
                <p className="font-body text-slate-secondary mb-8">
                  {modo === 'comprar'
                    ? `Compraste ${formatMonto(montoUsd, 'USD')} por ${formatMonto(montoArs, 'ARS')}`
                    : `Vendiste ${formatMonto(montoUsd, 'USD')} por ${formatMonto(montoArs, 'ARS')}`}
                </p>
                <Button className="w-full" onClick={handleReset}>Nueva operación</Button>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageWrapper>
  )
}
