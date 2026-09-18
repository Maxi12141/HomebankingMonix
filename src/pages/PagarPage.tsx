import { useEffect, type MouseEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { EscanearYPagar, MiCodigoQr } from '../components/NfcPayPanels'
import { openQrScanDefault, useQrScanStore } from '../stores/qrScanStore'

export function PagarPage() {
  const [params, setParams] = useSearchParams()
  const cobroInicial = params.get('cobro') ?? undefined
  const escanear = params.get('scan') === '1' && !cobroInicial

  useEffect(() => {
    if (!escanear) return
    if (!useQrScanStore.getState().open) openQrScanDefault()
    setParams({}, { replace: true })
  }, [escanear, setParams])

  function irAEscanear(e: MouseEvent<HTMLButtonElement>) {
    useQrScanStore.getState().openFromElement(e.currentTarget)
  }

  function volverAMiQr() {
    setParams({})
  }

  return (
    <PageWrapper>
      <div className="max-w-md mx-auto">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold text-navy dark:text-white">
            QR
          </h1>
          <p className="font-body text-sm text-slate-secondary mt-1">
            Mostrá el tuyo para cobrar o escaneá para pagar
          </p>
        </div>

        {cobroInicial ? (
          <EscanearYPagar
            cobroIdInicial={cobroInicial}
            onCerrarScan={volverAMiQr}
          />
        ) : (
          <>
            <MiCodigoQr />
            <Button className="w-full mt-4" type="button" onClick={irAEscanear}>
              Escanear para pagar
            </Button>
          </>
        )}
      </div>
    </PageWrapper>
  )
}
