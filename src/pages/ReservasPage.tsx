import { useState } from 'react'
import { PiggyBank, TrendingUp } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import { useCuenta } from '../hooks/useCuenta'
import { useCuentaStore } from '../store/cuentaStore'
import { estimacionDiaria, useReserva } from '../hooks/useReserva'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

type Mode = 'ingresar' | 'retirar'

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

function roundMoney(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function ReservasPage() {
  const { cuenta, refreshCuenta } = useCuenta()
  const { updateSaldo } = useCuentaStore()
  const { reserva, loading, interesHoy, refreshReserva } = useReserva(cuenta?.id)

  const [mode, setMode] = useState<Mode>('ingresar')
  const [monto, setMonto] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const montoNum = parseFloat(monto)
  const tasa = Number(reserva?.tasa_anual ?? 32)
  const saldoReserva = Number(reserva?.saldo ?? 0)
  const diario = estimacionDiaria(saldoReserva, tasa)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!cuenta || !reserva) return
    if (isNaN(montoNum) || montoNum <= 0) {
      setError('Ingresá un monto válido')
      return
    }

    setSaving(true)
    setError('')

    try {
      if (mode === 'ingresar') {
        if (montoNum > cuenta.saldo) {
          throw new Error('No tenés saldo suficiente en tu cuenta')
        }
        const nuevoSaldoCuenta = roundMoney(cuenta.saldo - montoNum)
        const nuevoSaldoReserva = roundMoney(saldoReserva + montoNum)

        const { error: errCuenta } = await supabase
          .from('cuentas')
          .update({ saldo: nuevoSaldoCuenta })
          .eq('id', cuenta.id)
        if (errCuenta) throw new Error('No se pudo descontar el saldo')

        const { error: errReserva } = await supabase
          .from('reservas')
          .update({ saldo: nuevoSaldoReserva })
          .eq('id', reserva.id)
        if (errReserva) throw new Error('No se pudo acreditar en la reserva')

        const { error: errMov } = await supabase.from('movimientos').insert({
          cuenta_id: cuenta.id,
          tipo: 'extraccion',
          monto: montoNum,
          saldo_resultante: nuevoSaldoCuenta,
          descripcion: 'Reserva|Ingreso a ahorro MONIX',
        })
        if (errMov) throw new Error('No se pudo registrar el movimiento')

        updateSaldo(nuevoSaldoCuenta)
        toast.success('Dinero ingresado a tu reserva')
      } else {
        if (montoNum > saldoReserva) {
          throw new Error('No tenés ese monto en la reserva')
        }
        const nuevoSaldoCuenta = roundMoney(cuenta.saldo + montoNum)
        const nuevoSaldoReserva = roundMoney(saldoReserva - montoNum)

        const { error: errReserva } = await supabase
          .from('reservas')
          .update({ saldo: nuevoSaldoReserva })
          .eq('id', reserva.id)
        if (errReserva) throw new Error('No se pudo debitar la reserva')

        const { error: errCuenta } = await supabase
          .from('cuentas')
          .update({ saldo: nuevoSaldoCuenta })
          .eq('id', cuenta.id)
        if (errCuenta) throw new Error('No se pudo acreditar el saldo')

        const { error: errMov } = await supabase.from('movimientos').insert({
          cuenta_id: cuenta.id,
          tipo: 'deposito',
          monto: montoNum,
          saldo_resultante: nuevoSaldoCuenta,
          descripcion: 'Reserva|Retiro de ahorro MONIX',
        })
        if (errMov) throw new Error('No se pudo registrar el movimiento')

        updateSaldo(nuevoSaldoCuenta)
        toast.success('Dinero vuelto a tu saldo disponible')
      }

      setMonto('')
      await Promise.all([refreshCuenta(), refreshReserva()])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo completar la operación'
      setError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageWrapper>
      <div className="max-w-md mx-auto">
        <h1 className="font-display text-2xl font-semibold text-navy dark:text-white mb-2">
          Reservas
        </h1>
        <p className="font-body text-sm text-slate-secondary mb-6">
          Separá plata de tu saldo y hacé rendir tu ahorro todos los días.
        </p>

        <Card className="p-6 mb-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="font-body text-xs text-slate-secondary uppercase tracking-wider">
                En reserva
              </p>
              <p className="font-display text-3xl font-bold text-mint mt-1">
                {loading ? '—' : formatARS(saldoReserva)}
              </p>
            </div>
            <div className="rounded-xl bg-mint/15 text-mint p-2.5">
              <PiggyBank size={22} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-input dark:bg-white/5 px-3 py-2.5">
              <p className="font-body text-[10px] uppercase tracking-wider text-slate-secondary">
                TNA
              </p>
              <p className="font-display text-sm font-semibold text-navy dark:text-white mt-0.5">
                {tasa.toFixed(2)}%
              </p>
            </div>
            <div className="rounded-xl bg-slate-input dark:bg-white/5 px-3 py-2.5">
              <p className="font-body text-[10px] uppercase tracking-wider text-slate-secondary">
                Estimado diario
              </p>
              <p className="font-display text-sm font-semibold text-navy dark:text-white mt-0.5">
                +{formatARS(diario)}
              </p>
            </div>
          </div>

          <AnimatePresence>
            {interesHoy > 0 && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-3 flex items-center gap-1.5 font-body text-xs text-mint"
              >
                <TrendingUp size={14} />
                Se acreditaron {formatARS(interesHoy)} de rendimiento
              </motion.p>
            )}
          </AnimatePresence>

          <p className="font-body text-xs text-slate-secondary mt-4">
            Saldo disponible: {formatARS(cuenta?.saldo ?? 0)}
          </p>
        </Card>

        <Card className="p-6">
          <div className="grid grid-cols-2 gap-2 mb-5 p-1 rounded-xl bg-slate-input dark:bg-white/5">
            <button
              type="button"
              onClick={() => { setMode('ingresar'); setError('') }}
              className={`rounded-lg py-2.5 font-body text-sm font-medium transition-colors ${
                mode === 'ingresar'
                  ? 'bg-mint text-navy'
                  : 'text-slate-secondary hover:text-navy dark:hover:text-white'
              }`}
            >
              Ingresar
            </button>
            <button
              type="button"
              onClick={() => { setMode('retirar'); setError('') }}
              className={`rounded-lg py-2.5 font-body text-sm font-medium transition-colors ${
                mode === 'retirar'
                  ? 'bg-mint text-navy'
                  : 'text-slate-secondary hover:text-navy dark:hover:text-white'
              }`}
            >
              Retirar
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label={mode === 'ingresar' ? 'Monto a ingresar' : 'Monto a retirar'}
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              required
            />

            {error && (
              <p className="text-sm text-red-500 dark:text-red-400 font-body bg-red-50 dark:bg-red-400/10 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" loading={saving} disabled={loading || !reserva}>
              {mode === 'ingresar' ? 'Ingresar a reserva' : 'Retirar a mi saldo'}
            </Button>
          </form>
        </Card>
      </div>
    </PageWrapper>
  )
}
