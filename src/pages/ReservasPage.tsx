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
import { Monto } from '../components/ui/Monto'
import { parseMonto } from '../utils/monto'
import { mensajeError } from '../lib/errores'
import Segmentado from '../components/ui/Segmentado'

type Mode = 'ingresar' | 'retirar'

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

export function ReservasPage() {
  const { cuenta, refreshCuenta } = useCuenta()
  const { updateSaldo } = useCuentaStore()
  const { reserva, loading, interesHoy, refreshReserva } = useReserva(cuenta?.id)

  const [mode, setMode] = useState<Mode>('ingresar')
  const [monto, setMonto] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const montoNum = parseMonto(monto)
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
      // Débito, crédito y movimiento en una sola transacción del servidor (S-1):
      // antes eran tres llamadas y una falla a mitad dejaba la plata en el aire.
      const { data, error: errRpc } = await supabase.rpc('mover_reserva', {
        p_cuenta_id: cuenta.id,
        p_monto: montoNum,
        p_modo: mode,
      })
      if (errRpc) throw new Error(errRpc.message)
      updateSaldo(Number((data as { saldo_cuenta: number }).saldo_cuenta))
      toast.success(mode === 'ingresar' ? 'Dinero ingresado a tu reserva' : 'Dinero vuelto a tu saldo disponible')

      setMonto('')
      await Promise.all([refreshCuenta(), refreshReserva()])
    } catch (err) {
      const msg = mensajeError(err, 'No pudimos completar la operación. Tu plata no se movió: probá de nuevo en unos minutos.')
      setError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageWrapper>
      <div className="max-w-md mx-auto">
        <h1 className="font-display text-2xl font-semibold text-navy dark:text-mint mb-2">
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
              <Monto as="p" tamaño="grande" className="font-display text-3xl font-bold mt-1">
                {loading ? '—' : formatARS(saldoReserva)}
              </Monto>
            </div>
            <div className="rounded-xl bg-mint/15 text-navy dark:text-mint p-2.5">
              <PiggyBank size={22} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-input dark:bg-white/5 px-3 py-2.5">
              <p className="font-body text-2xs uppercase tracking-wider text-slate-secondary">
                TNA
              </p>
              <p className="font-display text-sm font-semibold text-navy dark:text-white mt-0.5">
                {tasa.toFixed(2)}%
              </p>
            </div>
            <div className="rounded-xl bg-slate-input dark:bg-white/5 px-3 py-2.5">
              <p className="font-body text-2xs uppercase tracking-wider text-slate-secondary">
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
                className="mt-3 flex items-center gap-1.5 font-body text-xs text-mint-tinta-fuerte dark:text-mint"
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
          <Segmentado
            ariaLabel="Operación"
            value={mode}
            onChange={(m) => { setMode(m); setError('') }}
            opciones={[{ value: 'ingresar', label: 'Ingresar' }, { value: 'retirar', label: 'Retirar' }]}
            className="mb-5"
          />

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label={mode === 'ingresar' ? 'Monto a ingresar' : 'Monto a retirar'}
              type="text"
              inputMode="decimal"
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
