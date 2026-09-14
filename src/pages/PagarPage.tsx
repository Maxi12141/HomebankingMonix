import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Nfc, QrCode } from 'lucide-react'
import { useCuenta } from '../hooks/useCuenta'
import { PageWrapper } from '../components/layout/PageWrapper'
import { CobrarNfcPanel, PagarNfcPanel } from '../components/NfcPayPanels'

type Tab = 'cobrar' | 'nfc'

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
}

export function PagarPage() {
  const { cuenta } = useCuenta()
  const [params] = useSearchParams()
  const cobroInicial = params.get('cobro') ?? undefined
  const tabParam = params.get('tab')

  const [tab, setTab] = useState<Tab>(() => {
    if (cobroInicial) return 'nfc'
    if (tabParam === 'nfc') return 'nfc'
    return 'cobrar'
  })

  const query = params.toString()
  useEffect(() => {
    if (params.get('cobro')) {
      setTab('nfc')
      return
    }
    setTab(params.get('tab') === 'nfc' ? 'nfc' : 'cobrar')
  }, [query])

  return (
    <PageWrapper>
      <div className="max-w-md mx-auto">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold text-navy dark:text-white">
            Pagar
          </h1>
          <p className="font-body text-sm text-slate-secondary mt-1">
            Cobro con QR o pago contactless
          </p>
          <div className="grid grid-cols-2 gap-1 mt-4 p-1 rounded-xl bg-slate-input dark:bg-white/5">
            {([
              { id: 'cobrar' as const, label: 'Cobrar', icon: QrCode },
              { id: 'nfc' as const, label: 'NFC', icon: Nfc },
            ]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`rounded-lg py-2 font-body text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  tab === id ? 'bg-mint text-navy' : 'text-slate-secondary hover:text-navy dark:hover:text-white'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
          <p className="font-body text-xs text-slate-secondary mt-2">
            Saldo disponible:{' '}
            <span className="text-mint font-medium">{formatARS(cuenta?.saldo ?? 0)}</span>
          </p>
        </div>

        {tab === 'cobrar' && <CobrarNfcPanel />}
        {tab === 'nfc' && <PagarNfcPanel cobroIdInicial={cobroInicial} />}
      </div>
    </PageWrapper>
  )
}
