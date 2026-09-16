import { useEffect, useRef, useState } from 'react'
import { CheckCircle, QrCode, ScanLine } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import { useCuenta } from '../hooks/useCuenta'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { QrBox } from './QrBox'
import { formatMonto } from '../utils/cuenta'
import { encodeCobroQr, encodeCuentaQr, parseRadioPayload } from '../lib/tokens'
import { detectQrUntil, startQrCamera, stopMediaStream, waitForVideo } from '../lib/scanQr'
import { isAbortError } from '../native/monixRadio'
import {
  cancelarCobroNfc,
  crearCobroNfc,
  obtenerCobroNfc,
  pagarCobroQr,
  pagarQrCuenta,
  resolverQrCuenta,
  type CobroNfc,
  type DestinoQr,
} from '../services/nfcPago'

async function leerQrDeCamara(video: HTMLVideoElement, signal: AbortSignal) {
  const stream = await startQrCamera(video)
  try {
    return await detectQrUntil(video, signal)
  } finally {
    stopMediaStream(stream)
    video.srcObject = null
  }
}

export function MiCodigoQr() {
  const { cuenta, refreshCuenta } = useCuenta()
  const [monto, setMonto] = useState('')
  const [cobro, setCobro] = useState<CobroNfc | null>(null)
  const [error, setError] = useState('')
  const cobroIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!cobro || cobro.estado !== 'pendiente') return
    let channel: ReturnType<typeof supabase.channel> | null = null
    try {
      channel = supabase
        .channel(`cobro-${cobro.id}-${Math.random().toString(36).slice(2, 8)}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'cobros_nfc',
          filter: `id=eq.${cobro.id}`,
        }, (payload) => {
          const estado = (payload.new as { estado?: string }).estado
          if (estado === 'pagado') {
            setCobro((c) => c ? { ...c, estado: 'pagado' } : c)
            void refreshCuenta()
            toast.success('Pago recibido')
          }
        })
        .subscribe()
    } catch (err) {
      console.error('No se pudo escuchar el cobro en tiempo real:', err)
      return
    }
    return () => {
      const ch = channel
      window.setTimeout(() => {
        if (ch) void supabase.removeChannel(ch)
      }, 400)
    }
  }, [cobro?.id, cobro?.estado, refreshCuenta])

  useEffect(() => {
    if (!cuenta?.id) return
    const raw = monto.trim().replace(',', '.')
    const n = parseFloat(raw)
    const timer = window.setTimeout(() => {
      void (async () => {
        if (!raw || isNaN(n) || n <= 0) {
          if (cobroIdRef.current) {
            await cancelarCobroNfc(cobroIdRef.current).catch(() => undefined)
            cobroIdRef.current = null
            setCobro(null)
          }
          setError('')
          return
        }
        try {
          if (cobroIdRef.current) {
            await cancelarCobroNfc(cobroIdRef.current).catch(() => undefined)
          }
          const id = await crearCobroNfc(cuenta.id, n, '')
          cobroIdRef.current = id
          setCobro(await obtenerCobroNfc(id))
          setError('')
        } catch (err) {
          setError(err instanceof Error ? err.message : 'No se pudo armar el cobro')
        }
      })()
    }, 650)
    return () => window.clearTimeout(timer)
  }, [monto, cuenta?.id])

  useEffect(() => {
    return () => {
      if (cobroIdRef.current) {
        void cancelarCobroNfc(cobroIdRef.current).catch(() => undefined)
      }
    }
  }, [])

  async function nuevoCobro() {
    if (cobroIdRef.current) {
      await cancelarCobroNfc(cobroIdRef.current).catch(() => undefined)
    }
    cobroIdRef.current = null
    setCobro(null)
    setMonto('')
  }

  if (cobro?.estado === 'pagado') {
    return (
      <Card className="p-8 text-center">
        <CheckCircle size={48} className="text-mint mx-auto mb-3" />
        <h2 className="font-display text-lg font-semibold text-navy dark:text-white">Cobro acreditado</h2>
        <p className="font-display text-2xl font-bold text-mint mt-2">
          {formatMonto(cobro.monto, cobro.moneda)}
        </p>
        <Button className="w-full mt-6" type="button" onClick={() => { void nuevoCobro() }}>
          Nuevo QR
        </Button>
      </Card>
    )
  }

  const qrValue = cobro
    ? encodeCobroQr(cobro.id)
    : cuenta?.id
      ? encodeCuentaQr(cuenta.id)
      : ''

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-1">
        <QrCode size={18} className="text-mint" />
        <h2 className="font-display font-semibold text-navy dark:text-white">Tu QR</h2>
      </div>
      <p className="font-body text-xs text-slate-secondary mb-4">
        Mostralo para cobrar. Si ponés un monto, el que paga ya ve esa cifra; si lo dejás vacío, la carga en el momento.
      </p>
      {qrValue && <QrBox value={qrValue} alt="Tu QR de Monix" />}
      {cuenta?.alias && (
        <p className="font-body text-xs text-slate-secondary text-center mt-3">
          @{cuenta.alias}
        </p>
      )}
      {cobro && (
        <p className="font-display text-xl font-bold text-mint text-center mt-2">
          {formatMonto(cobro.monto, cobro.moneda)}
        </p>
      )}
      <div className="mt-4">
        <Input
          label="Monto (opcional)"
          type="number"
          min="0.01"
          step="0.01"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="Lo carga quien paga"
        />
      </div>
      {error && <p className="text-sm text-red-500 dark:text-red-400 mt-3">{error}</p>}
    </Card>
  )
}

export function EscanearYPagar({
  autoStart = false,
  cobroIdInicial,
  onCerrarScan,
}: {
  autoStart?: boolean
  cobroIdInicial?: string
  onCerrarScan?: () => void
}) {
  const { refreshCuenta } = useCuenta()
  const [cobro, setCobro] = useState<CobroNfc | null>(null)
  const [destino, setDestino] = useState<DestinoQr | null>(null)
  const [montoLibre, setMontoLibre] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pagado, setPagado] = useState<{ nombre: string; monto: number; moneda: 'ARS' | 'USD' } | null>(null)
  const [scanning, setScanning] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const scanAbortRef = useRef<AbortController | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (cobroIdInicial) void cargarCobro(cobroIdInicial)
  }, [cobroIdInicial])

  useEffect(() => {
    if (!autoStart || cobroIdInicial || startedRef.current) return
    startedRef.current = true
    void escanearQr()
  }, [autoStart, cobroIdInicial])

  async function cargarCobro(id: string) {
    setLoading(true)
    setError('')
    try {
      setCobro(await obtenerCobroNfc(id))
      setDestino(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se encontró el cobro')
    } finally {
      setLoading(false)
    }
  }

  async function cargarCuenta(id: string) {
    setLoading(true)
    setError('')
    try {
      setDestino(await resolverQrCuenta(id))
      setCobro(null)
      setMontoLibre('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer ese QR')
    } finally {
      setLoading(false)
    }
  }

  async function escanearQr() {
    scanAbortRef.current?.abort()
    const controller = new AbortController()
    scanAbortRef.current = controller
    setScanning(true)
    setError('')
    try {
      const video = await waitForVideo(() => videoRef.current, controller.signal)
      const raw = await leerQrDeCamara(video, controller.signal)
      const parsed = parseRadioPayload(raw)
      if (parsed?.kind === 'cobro') await cargarCobro(parsed.value)
      else if (parsed?.kind === 'cuenta') await cargarCuenta(parsed.value)
      else if (parsed?.kind === 'pay' || parsed?.kind === 'id') {
        throw new Error('Ese código es de la tarjeta. Para pagar con QR usá el código de esta pantalla.')
      } else {
        await cargarCobro(raw.replace(/^MONIXPAY:/i, ''))
      }
    } catch (err) {
      if (!isAbortError(err)) {
        setError(err instanceof Error ? err.message : 'No se pudo abrir la cámara')
      }
    } finally {
      if (scanAbortRef.current === controller) scanAbortRef.current = null
      setScanning(false)
    }
  }

  async function pagarCobro() {
    if (!cobro) return
    setLoading(true)
    setError('')
    try {
      await pagarCobroQr(cobro.id)
      const fresh = await obtenerCobroNfc(cobro.id)
      await refreshCuenta()
      setPagado({
        nombre: `${fresh.comercio_nombre} ${fresh.comercio_apellido}`.trim(),
        monto: fresh.monto,
        moneda: fresh.moneda,
      })
      toast.success('Pago realizado')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo pagar')
    } finally {
      setLoading(false)
    }
  }

  async function pagarCuenta() {
    if (!destino) return
    const n = parseFloat(montoLibre.replace(',', '.'))
    if (isNaN(n) || n <= 0) {
      setError('Ingresá el monto a pagar')
      return
    }
    setLoading(true)
    setError('')
    try {
      await pagarQrCuenta(destino.cuenta_id, n, '')
      await refreshCuenta()
      setPagado({
        nombre: `${destino.nombre} ${destino.apellido}`.trim(),
        monto: n,
        moneda: destino.moneda,
      })
      toast.success('Pago realizado')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo pagar')
    } finally {
      setLoading(false)
    }
  }

  function volver() {
    scanAbortRef.current?.abort()
    setCobro(null)
    setDestino(null)
    setPagado(null)
    setError('')
    onCerrarScan?.()
  }

  if (pagado) {
    return (
      <Card className="p-8 text-center">
        <CheckCircle size={48} className="text-mint mx-auto mb-3" />
        <h2 className="font-display text-lg font-semibold text-navy dark:text-white">Pago exitoso</h2>
        <p className="font-body text-sm text-slate-secondary mt-1">Le pagaste a {pagado.nombre}</p>
        <p className="font-display text-2xl font-bold text-mint mt-2">{formatMonto(pagado.monto, pagado.moneda)}</p>
        <Button className="w-full mt-6" type="button" onClick={volver}>
          Listo
        </Button>
      </Card>
    )
  }

  if (cobro?.estado === 'pagado') {
    return (
      <Card className="p-8 text-center">
        <CheckCircle size={48} className="text-mint mx-auto mb-3" />
        <h2 className="font-display text-lg font-semibold text-navy dark:text-white">Pago exitoso</h2>
        <p className="font-body text-sm text-slate-secondary mt-1">
          Le pagaste a {cobro.comercio_nombre} {cobro.comercio_apellido}
        </p>
        <p className="font-display text-2xl font-bold text-mint mt-2">{formatMonto(cobro.monto, cobro.moneda)}</p>
        <Button className="w-full mt-6" type="button" onClick={volver}>Listo</Button>
      </Card>
    )
  }

  if (cobro) {
    return (
      <Card className="p-6">
        <p className="font-body text-xs text-slate-secondary">Vas a pagar a</p>
        <p className="font-display font-semibold text-navy dark:text-white">
          {cobro.comercio_nombre} {cobro.comercio_apellido}
        </p>
        {cobro.comercio_alias && <p className="font-body text-xs text-slate-secondary">@{cobro.comercio_alias}</p>}
        <p className="font-display text-2xl font-bold text-mint my-3">{formatMonto(cobro.monto, cobro.moneda)}</p>
        {error && <p className="text-sm text-red-500 dark:text-red-400 mb-3">{error}</p>}
        <Button className="w-full" type="button" loading={loading} onClick={() => { void pagarCobro() }}>
          Pagar
        </Button>
        <Button variant="secondary" className="w-full mt-2" type="button" onClick={volver}>
          Cancelar
        </Button>
      </Card>
    )
  }

  if (destino) {
    return (
      <Card className="p-6">
        <p className="font-body text-xs text-slate-secondary">Vas a pagar a</p>
        <p className="font-display font-semibold text-navy dark:text-white">
          {destino.nombre} {destino.apellido}
        </p>
        {destino.alias && <p className="font-body text-xs text-slate-secondary">@{destino.alias}</p>}
        <div className="mt-4">
          <Input
            label={`Monto en ${destino.moneda === 'USD' ? 'dólares' : 'pesos'}`}
            type="number"
            min="0.01"
            step="0.01"
            value={montoLibre}
            onChange={(e) => setMontoLibre(e.target.value)}
            placeholder="0.00"
          />
        </div>
        {error && <p className="text-sm text-red-500 dark:text-red-400 mt-3">{error}</p>}
        <Button className="w-full mt-4" type="button" loading={loading} onClick={() => { void pagarCuenta() }}>
          Pagar
        </Button>
        <Button variant="secondary" className="w-full mt-2" type="button" onClick={volver}>
          Cancelar
        </Button>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <ScanLine size={18} className="text-mint" />
        <h2 className="font-display font-semibold text-navy dark:text-white">Escanear para pagar</h2>
      </div>
      {scanning ? (
        <>
          <video ref={videoRef} className="w-full rounded-xl bg-black aspect-[4/3] object-cover" muted playsInline />
          <p className="font-body text-xs text-slate-secondary text-center mt-3">Apuntá al QR de Monix</p>
          <Button variant="secondary" className="w-full mt-3" type="button" onClick={() => {
            scanAbortRef.current?.abort()
            onCerrarScan?.()
          }}>
            Cancelar
          </Button>
        </>
      ) : (
        <>
          {error && <p className="text-sm text-red-500 dark:text-red-400 mb-3">{error}</p>}
          <Button className="w-full" type="button" loading={loading} onClick={() => { void escanearQr() }}>
            Abrir cámara
          </Button>
          {onCerrarScan && (
            <Button variant="secondary" className="w-full mt-2" type="button" onClick={onCerrarScan}>
              Volver a mi QR
            </Button>
          )}
        </>
      )}
    </Card>
  )
}
