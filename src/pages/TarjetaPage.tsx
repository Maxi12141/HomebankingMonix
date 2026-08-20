import { useEffect, useState } from 'react'
import { CreditCard, Eye, EyeOff, Lock, ShieldCheck, Snowflake, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { useCuenta } from '../hooks/useCuenta'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { MonixCard3D, buildPan, buildCvv } from '../components/MonixCard3D'

function freezeKey(cuentaId: string) {
  return `monix_card_frozen_${cuentaId}`
}

const LIMITES: Record<'ARS' | 'USD', { comercios: string; cajeros: string; online: string }> = {
  ARS: { comercios: '$ 250.000', cajeros: '$ 80.000', online: '$ 150.000' },
  USD: { comercios: 'US$ 1.500', cajeros: 'US$ 500', online: 'US$ 1.000' },
}

export function TarjetaPage() {
  const { persona } = useAuthStore()
  const { cuenta, cuentas } = useCuenta()
  const [frozen, setFrozen] = useState(false)
  const [showSensitive, setShowSensitive] = useState(false)
  const [monedaActiva, setMonedaActiva] = useState<'ARS' | 'USD'>('ARS')

  const cuentaUSD = cuentas.find((c) => c.moneda === 'USD')
  const cuentaMostrada = monedaActiva === 'USD' && cuentaUSD ? cuentaUSD : cuenta

  useEffect(() => {
    if (!cuentaMostrada?.id) return
    setFrozen(localStorage.getItem(freezeKey(cuentaMostrada.id)) === '1')
  }, [cuentaMostrada?.id])

  function toggleFreeze() {
    if (!cuentaMostrada?.id) return
    const next = !frozen
    setFrozen(next)
    localStorage.setItem(freezeKey(cuentaMostrada.id), next ? '1' : '0')
    toast.success(next ? 'Tarjeta congelada' : 'Tarjeta descongelada')
  }

  const tipoLabel = cuentaMostrada?.tipo === 'cuenta_corriente' ? 'Cuenta Corriente' : 'Caja de Ahorro'
  const panDisplay = buildPan(cuentaMostrada?.numero_cuenta, showSensitive, cuentaMostrada?.moneda)
  const cvvDisplay = showSensitive ? buildCvv(cuentaMostrada?.numero_cuenta) : '•••'
  const limites = LIMITES[monedaActiva === 'USD' && cuentaUSD ? 'USD' : 'ARS']

  return (
    <PageWrapper>
      <div className="max-w-lg mx-auto">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold text-mint">
            Mis Tarjetas
          </h1>
          <p className="font-body text-sm text-slate-secondary mt-1">
            Débito MONIX vinculada a tu {tipoLabel.toLowerCase()}
          </p>
        </div>

        {cuentaUSD && (
          <div className="grid grid-cols-2 gap-2 mb-6 p-1 rounded-xl bg-slate-input dark:bg-white/5">
            <button
              type="button"
              onClick={() => setMonedaActiva('ARS')}
              className={`rounded-lg py-2.5 font-body text-sm font-medium transition-colors ${
                monedaActiva === 'ARS' ? 'bg-mint text-navy' : 'text-slate-secondary hover:text-navy dark:hover:text-white'
              }`}
            >
              Tarjeta en pesos
            </button>
            <button
              type="button"
              onClick={() => setMonedaActiva('USD')}
              className={`rounded-lg py-2.5 font-body text-sm font-medium transition-colors ${
                monedaActiva === 'USD' ? 'bg-mint text-navy' : 'text-slate-secondary hover:text-navy dark:hover:text-white'
              }`}
            >
              Tarjeta en dólares
            </button>
          </div>
        )}

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

        <MonixCard3D
          key={cuentaMostrada?.id}
          titular={[persona?.nombre, persona?.apellido].filter(Boolean).join(' ')}
          numeroCuenta={cuentaMostrada?.numero_cuenta}
          cbu={cuentaMostrada?.cbu}
          alias={cuentaMostrada?.alias}
          tipo={cuentaMostrada?.tipo}
          moneda={cuentaMostrada?.moneda}
          showSensitive={showSensitive}
          frozen={frozen}
        />

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
              <dt className="font-body text-xs text-slate-secondary uppercase tracking-wider">CVV</dt>
              <dd className="font-mono text-sm text-navy dark:text-white">{cvvDisplay}</dd>
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
                {cuentaMostrada?.numero_cuenta ?? '—'} · {tipoLabel}
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
            <LimitRow label="Compras en comercios" value={limites.comercios} />
            <LimitRow label="Extracciones en cajeros" value={limites.cajeros} />
            <LimitRow label="Compras online" value={limites.online} />
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
