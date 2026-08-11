import { useEffect, useState } from 'react'
import { CreditCard, Eye, EyeOff, Lock, ShieldCheck, Snowflake, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { useCuenta } from '../hooks/useCuenta'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { MonixCard3D } from '../components/MonixCard3D'

function freezeKey(cuentaId: string) {
  return `monix_card_frozen_${cuentaId}`
}

export function TarjetaPage() {
  const { persona } = useAuthStore()
  const { cuenta } = useCuenta()
  const [frozen, setFrozen] = useState(false)
  const [showSensitive, setShowSensitive] = useState(false)

  useEffect(() => {
    if (!cuenta?.id) return
    setFrozen(localStorage.getItem(freezeKey(cuenta.id)) === '1')
  }, [cuenta?.id])

  function toggleFreeze() {
    if (!cuenta?.id) return
    const next = !frozen
    setFrozen(next)
    localStorage.setItem(freezeKey(cuenta.id), next ? '1' : '0')
    toast.success(next ? 'Tarjeta congelada' : 'Tarjeta descongelada')
  }

  const tipoLabel = cuenta?.tipo === 'cuenta_corriente' ? 'Cuenta Corriente' : 'Caja de Ahorro'
  const last4 = (cuenta?.numero_cuenta ?? '').replace(/\D/g, '').slice(-4).padStart(4, '0')
  const panDisplay = showSensitive
    ? `4532  8814  62${(cuenta?.numero_cuenta ?? '0000').replace(/\D/g, '').slice(0, 2).padEnd(2, '0')}  ${last4}`
    : `4532  ••••  ••••  ${last4}`

  return (
    <PageWrapper>
      <div className="max-w-lg mx-auto">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold text-navy dark:text-white">
            Mi tarjeta
          </h1>
          <p className="font-body text-sm text-slate-secondary mt-1">
            Débito MONIX vinculada a tu {tipoLabel.toLowerCase()}
          </p>
        </div>

        {frozen && (
          <Card className="p-4 mb-4 flex items-start gap-3 border-amber-400/30 bg-amber-50 dark:bg-amber-400/10">
            <Snowflake size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-body text-sm font-medium text-navy dark:text-white">
                Tarjeta congelada
              </p>
              <p className="font-body text-xs text-slate-secondary mt-0.5">
                Las compras con esta tarjeta quedan bloqueadas hasta que la descongeles.
              </p>
            </div>
          </Card>
        )}

        <div className={frozen ? 'opacity-70 grayscale-[0.35] transition-all' : 'transition-all'}>
          <MonixCard3D
            titular={[persona?.nombre, persona?.apellido].filter(Boolean).join(' ')}
            numeroCuenta={cuenta?.numero_cuenta}
            cbu={cuenta?.cbu}
            alias={cuenta?.alias}
            tipo={cuenta?.tipo}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <Button
            variant="secondary"
            className="flex items-center justify-center gap-2"
            onClick={toggleFreeze}
          >
            {frozen ? <Lock size={16} /> : <Snowflake size={16} />}
            {frozen ? 'Descongelar' : 'Congelar'}
          </Button>
          <Button
            variant="secondary"
            className="flex items-center justify-center gap-2"
            onClick={() => setShowSensitive((v) => !v)}
          >
            {showSensitive ? <EyeOff size={16} /> : <Eye size={16} />}
            {showSensitive ? 'Ocultar datos' : 'Ver datos'}
          </Button>
        </div>

        <Card className="p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={18} className="text-mint" />
            <h2 className="font-display text-base font-semibold text-navy dark:text-white">
              Datos de la tarjeta
            </h2>
          </div>

          <dl className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <dt className="font-body text-xs text-slate-secondary uppercase tracking-wider">Número</dt>
              <dd className="font-mono text-sm text-navy dark:text-white">{panDisplay}</dd>
            </div>
            <div className="h-px bg-slate-200 dark:bg-white/10" />
            <div className="flex items-center justify-between gap-3">
              <dt className="font-body text-xs text-slate-secondary uppercase tracking-wider">Titular</dt>
              <dd className="font-body text-sm text-navy dark:text-white text-right">
                {[persona?.nombre, persona?.apellido].filter(Boolean).join(' ') || '—'}
              </dd>
            </div>
            <div className="h-px bg-slate-200 dark:bg-white/10" />
            <div className="flex items-center justify-between gap-3">
              <dt className="font-body text-xs text-slate-secondary uppercase tracking-wider">Vencimiento</dt>
              <dd className="font-mono text-sm text-navy dark:text-white">12/29</dd>
            </div>
            <div className="h-px bg-slate-200 dark:bg-white/10" />
            <div className="flex items-center justify-between gap-3">
              <dt className="font-body text-xs text-slate-secondary uppercase tracking-wider">Estado</dt>
              <dd className={`font-body text-sm font-medium ${frozen ? 'text-amber-500' : 'text-mint'}`}>
                {frozen ? 'Congelada' : 'Activa'}
              </dd>
            </div>
            <div className="h-px bg-slate-200 dark:bg-white/10" />
            <div className="flex items-center justify-between gap-3">
              <dt className="font-body text-xs text-slate-secondary uppercase tracking-wider">Cuenta</dt>
              <dd className="font-body text-sm text-navy dark:text-white text-right">
                {cuenta?.numero_cuenta ?? '—'} · {tipoLabel}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Wallet size={18} className="text-mint" />
            <h2 className="font-display text-base font-semibold text-navy dark:text-white">
              Límites diarios
            </h2>
          </div>
          <div className="space-y-3">
            <LimitRow label="Compras en comercios" value="$ 250.000" />
            <LimitRow label="Extracciones en cajeros" value="$ 80.000" />
            <LimitRow label="Compras online" value="$ 150.000" />
          </div>
        </Card>

        <Card className="p-5 flex items-start gap-3">
          <ShieldCheck size={20} className="text-mint shrink-0 mt-0.5" />
          <div>
            <p className="font-body text-sm font-medium text-navy dark:text-white">
              Protección MONIX
            </p>
            <p className="font-body text-xs text-slate-secondary mt-1">
              Si perdés la tarjeta, congelala al instante. El dorso tiene tu CBU y alias para recibir
              transferencias sin compartir el número completo.
            </p>
          </div>
        </Card>
      </div>
    </PageWrapper>
  )
}

function LimitRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-body text-sm text-slate-secondary">{label}</span>
      <span className="font-display text-sm font-semibold text-navy dark:text-white">{value}</span>
    </div>
  )
}
