import { CalendarClock } from 'lucide-react'
import toast from 'react-hot-toast'
import { esModoPrueba } from '../lib/modoPrueba'
import { simularMesPrueba } from '../lib/operacionesPrueba'
import { formatMonto } from '../utils/cuenta'
import { Button } from './ui/Button'

/** Solo en la prueba: los intereses y las cuotas pasan con los días, y en una demo no se verían. */
export function SimularMes({ className = '' }: { className?: string }) {
  if (!esModoPrueba()) return null

  function simular() {
    const { intereses, cuotasPagadas, cuotasAtrasadas } = simularMesPrueba()
    const partes = [`Pasó un mes: ganaste ${formatMonto(intereses, 'ARS')} de intereses`]
    if (cuotasPagadas > 0) partes.push(cuotasPagadas === 1 ? 'se cobró 1 cuota' : `se cobraron ${cuotasPagadas} cuotas`)
    if (cuotasAtrasadas > 0) partes.push('no te alcanzó el saldo para una cuota')
    toast.success(`${partes.join(' y ')}.`)
  }

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-300 dark:border-white/20 px-4 py-3 ${className}`}>
      <p className="font-body text-sm text-slate-secondary flex-1 min-w-[12rem]">
        Mirá cómo se acreditan los intereses y se cobran las cuotas.
      </p>
      <Button variant="secondary" onClick={simular} className="min-h-11 !py-2 text-sm inline-flex items-center gap-2">
        <CalendarClock size={16} aria-hidden="true" />
        Simular un mes
      </Button>
    </div>
  )
}
