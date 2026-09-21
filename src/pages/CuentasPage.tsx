import { useState } from 'react'
import { Copy, Check, Lock, ShieldCheck, Landmark, DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../store/authStore'
import { useCuenta } from '../hooks/useCuenta'
import { abrirCuenta, asignarAliasCuenta } from '../services/bancoCentral'
import { generateNumeroCuenta, generateAlias, formatMonto } from '../utils/cuenta'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import type { Cuenta } from '../types'

type Estado = 'idle' | 'confirmar' | 'abriendo'

function CopyField({ label, value }: { label: string; value: string }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    await navigator.clipboard.writeText(value)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className="flex items-center justify-between gap-3 w-full rounded-xl bg-slate-input dark:bg-white/5 px-3 py-2.5 text-left hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors"
    >
      <span className="min-w-0">
        <span className="block font-body text-[10px] uppercase tracking-wider text-slate-secondary">{label}</span>
        <span className="block font-body text-sm text-navy dark:text-white truncate">{value}</span>
      </span>
      {copiado ? <Check size={16} className="text-mint shrink-0" /> : <Copy size={16} className="text-slate-secondary shrink-0" />}
    </button>
  )
}

function CuentaCard({ cuenta, titulo }: { cuenta: Cuenta; titulo: string }) {
  const Icon = cuenta.moneda === 'USD' ? DollarSign : Landmark
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="font-body text-xs text-slate-secondary uppercase tracking-wider">{titulo}</p>
          <p className="font-display text-3xl font-bold text-mint mt-1">
            {formatMonto(Number(cuenta.saldo), cuenta.moneda)}
          </p>
        </div>
        <div className="rounded-xl bg-mint/15 text-mint p-2.5 shrink-0">
          <Icon size={22} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <CopyField label="CBU" value={cuenta.cbu ?? '—'} />
        <CopyField label="Alias" value={cuenta.alias ?? '—'} />
      </div>
    </Card>
  )
}

export function CuentasPage() {
  const { persona } = useAuthStore()
  const { cuenta, cuentas, refreshCuenta } = useCuenta()
  const [estado, setEstado] = useState<Estado>('idle')
  const [error, setError] = useState('')
  const [aceptaTerminos, setAceptaTerminos] = useState(false)

  const cuentaUSD = cuentas.find((c) => c.moneda === 'USD')

  async function solicitarUSD() {
    if (!persona) return
    setEstado('abriendo')
    setError('')

    try {
      const bcCuenta = await abrirCuenta(persona.dni, 'USD')
      const alias = generateAlias()
      // El Banco Central tiene que conocer nuestro alias sí o sí, igual que con
      // la caja en pesos — si esto falla, no seguimos con una cuenta cuyo alias
      // real no coincide con el que le informamos al banco.
      await asignarAliasCuenta(bcCuenta.cbu, alias)

      const { error: insertError } = await supabase.from('cuentas').insert({
        persona_id: persona.id,
        numero_cuenta: generateNumeroCuenta(),
        tipo: 'caja_ahorro',
        moneda: 'USD',
        saldo: 0,
        activa: true,
        cbu: bcCuenta.cbu,
        alias,
      })
      if (insertError) throw insertError

      await refreshCuenta()
      setEstado('idle')
      setAceptaTerminos(false)
      toast.success('¡Ya tenés tu cuenta en dólares!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo abrir la cuenta'
      setError(msg)
      setEstado('idle')
      toast.error(msg)
    }
  }

  return (
    <PageWrapper>
      <div className="max-w-lg mx-auto">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold text-mint">Cuentas</h1>
          <p className="font-body text-sm text-slate-secondary mt-1">
            Tus cajas de ahorro en Monix, una por moneda.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {cuenta && <CuentaCard cuenta={cuenta} titulo="Caja de ahorro en pesos" />}

          {cuentaUSD ? (
            <CuentaCard cuenta={cuentaUSD} titulo="Caja de ahorro en dólares" />
          ) : (
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="rounded-xl bg-slate-input dark:bg-white/5 p-2.5 text-slate-secondary">
                  <Lock size={20} />
                </div>
                <div>
                  <p className="font-display text-base font-semibold text-navy dark:text-white">
                    Caja de ahorro en dólares
                  </p>
                  <p className="font-body text-xs text-slate-secondary">Todavía no la tenés</p>
                </div>
              </div>

              <p className="font-body text-sm text-slate-secondary mb-4">
                Abrí una cuenta en USD con CBU y alias propios. Te mantendremos actualizado sobre tu solicitud.
              </p>

              {error && (
                <p className="text-sm text-red-500 dark:text-red-400 font-body bg-red-50 dark:bg-red-400/10 rounded-xl px-4 py-3 mb-4">
                  {error}
                </p>
              )}

              <Button onClick={() => setEstado('confirmar')} className="w-full">
                Solicitar cuenta en dólares
              </Button>
            </Card>
          )}
        </div>
      </div>

      <Modal
        open={estado === 'confirmar' || estado === 'abriendo'}
        onClose={() => {
          if (estado === 'abriendo') return
          setEstado('idle')
          setAceptaTerminos(false)
        }}
      >
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl bg-mint/15 text-mint p-2.5">
              <ShieldCheck size={20} />
            </div>
            <p className="font-display text-base font-semibold text-navy dark:text-white">
              Solicitar cuenta en dólares
            </p>
          </div>

          <p className="font-body text-sm text-slate-secondary mb-4">
            Vamos a abrirte una caja de ahorro en dólares con CBU y alias propios.
          </p>

          <div className="rounded-xl bg-slate-input dark:bg-white/5 p-4 mb-4 max-h-48 overflow-y-auto">
            <p className="font-body text-xs font-semibold text-navy dark:text-white mb-2">
              Términos y condiciones
            </p>
            <ul className="font-body text-xs text-slate-secondary space-y-1.5 list-disc pl-4">
              <li>La cuenta en dólares es independiente de tu caja de ahorro en pesos, con CBU y alias propios.</li>
              <li>Sin costo de apertura ni de mantenimiento.</li>
              <li>Las transferencias y depósitos en esta cuenta se acreditan en dólares estadounidenses (USD).</li>
              <li>Podés operar la compra y venta de dólares desde Monix en cualquier momento.</li>
              <li>Los datos que informamos al Banco Central (CBU y alias) quedan asociados a tu DNI, igual que tu cuenta en pesos.</li>
            </ul>
          </div>

          <label className="flex items-start gap-2 mb-6 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={aceptaTerminos}
              onChange={(e) => setAceptaTerminos(e.target.checked)}
              disabled={estado === 'abriendo'}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-white/20 accent-mint cursor-pointer shrink-0"
            />
            <span className="font-body text-sm text-navy dark:text-white">
              Leí y acepto los términos y condiciones de la cuenta en dólares.
            </span>
          </label>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => { setEstado('idle'); setAceptaTerminos(false) }}
              disabled={estado === 'abriendo'}
            >
              Cancelar
            </Button>
            <Button className="flex-1" onClick={solicitarUSD} loading={estado === 'abriendo'} disabled={!aceptaTerminos}>
              Continuar
            </Button>
          </div>
        </Card>
      </Modal>
    </PageWrapper>
  )
}
