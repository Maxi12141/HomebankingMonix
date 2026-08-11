import { useNavigate } from 'react-router-dom'
import { PiggyBank, TrendingUp } from 'lucide-react'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { estimacionDiaria, useReserva } from '../hooks/useReserva'

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

interface Props {
  cuentaId?: string | null
}

export function ReservasHomeCard({ cuentaId }: Props) {
  const navigate = useNavigate()
  const { reserva, loading, interesHoy } = useReserva(cuentaId)

  const saldo = Number(reserva?.saldo ?? 0)
  const tasa = Number(reserva?.tasa_anual ?? 32)
  const diario = estimacionDiaria(saldo, tasa)

  return (
    <Card className="p-6 mb-8" id="tour-reservas">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="font-display text-lg font-semibold text-navy dark:text-white">
            Reservas
          </p>
          <p className="font-body text-xs text-slate-secondary mt-0.5">
            Ahorrá aparte y sumá rendimiento todos los días
          </p>
        </div>
        <div className="rounded-xl bg-mint/15 text-mint p-2.5 shrink-0">
          <PiggyBank size={20} />
        </div>
      </div>

      <p className="font-body text-xs text-slate-secondary mb-1">Saldo en reserva</p>
      <p className="font-display text-2xl font-bold text-mint mb-3">
        {loading ? '—' : formatARS(saldo)}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4">
        <p className="font-body text-xs text-slate-secondary">
          TNA <span className="text-navy dark:text-white font-medium">{tasa.toFixed(2)}%</span>
        </p>
        <p className="font-body text-xs text-slate-secondary">
          Hoy ~ <span className="text-navy dark:text-white font-medium">+{formatARS(diario)}</span>
        </p>
        {interesHoy > 0 && (
          <p className="font-body text-xs text-mint inline-flex items-center gap-1">
            <TrendingUp size={12} />
            +{formatARS(interesHoy)} acreditados
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant="primary"
          className="flex-1 py-2.5 text-sm"
          onClick={() => navigate('/reservas')}
        >
          {saldo > 0 ? 'Administrar' : 'Empezar a ahorrar'}
        </Button>
        {saldo > 0 && (
          <Button
            variant="secondary"
            className="flex-1 py-2.5 text-sm"
            onClick={() => navigate('/reservas')}
          >
            Ingresar / Retirar
          </Button>
        )}
      </div>
    </Card>
  )
}
