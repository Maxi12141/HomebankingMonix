import { useEffect, useRef, useState } from 'react'
import { CheckCircle, Nfc, QrCode, ScanLine, Smartphone } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import { useCuenta } from '../hooks/useCuenta'
import { useCuentaStore } from '../store/cuentaStore'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { QrBox } from './QrBox'
import { NfcWaves } from './NfcWaves'
import { formatMonto } from '../utils/cuenta'
import { encodeCobroQr, encodePayPayload, parseRadioPayload, randomToken } from '../lib/tokens'
import { detectQrUntil, isIosDevice, startQrCamera, stopMediaStream, waitForVideo } from '../lib/scanQr'
import { isAbortError, monixRadio, radioCapabilities } from '../native/monixRadio'
import {
  cancelarCobroNfc,
  crearCobroNfc,
  generarCriptogramaNfc,
  obtenerCobroNfc,
  pagarCobroNfc,
  type CobroNfc,
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

export function CobrarNfcPanel() {
  const { cuenta, refreshCuenta } = useCuenta()
  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [cobro, setCobro] = useState<CobroNfc | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const scanAbortRef = useRef<AbortController | null>(null)
  const apple = isIosDevice()
  const caps = radioCapabilities()

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
    if (!cobro || cobro.estado !== 'pendiente') return
    const off = monixRadio.onNfc((payload) => {
      const parsed = parseRadioPayload(payload)
      if (parsed?.kind !== 'pay' && parsed?.kind !== 'id') return
      void pagarCobroNfc(cobro.id, parsed.value)
        .then(async () => {
          const fresh = await obtenerCobroNfc(cobro.id)
          setCobro(fresh)
          await refreshCuenta()
          toast.success('Pago recibido')
        })
        .catch((err) => toast.error(err instanceof Error ? err.message : 'No se pudo cobrar'))
    })
    monixRadio.startNfcListen().catch(() => undefined)
    return () => { off() }
  }, [cobro, refreshCuenta])

  async function escanearChipCliente() {
    if (!cobro) return
    scanAbortRef.current?.abort()
    const controller = new AbortController()
    scanAbortRef.current = controller
    setScanning(true)
    setError('')
    try {
      const video = await waitForVideo(() => videoRef.current, controller.signal)
      const raw = await leerQrDeCamara(video, controller.signal)
      const parsed = parseRadioPayload(raw)
      if (parsed?.kind !== 'pay' && parsed?.kind !== 'id') {
        throw new Error('Ese QR no es un chip Monix. Pedile que muestre el QR de su tarjeta.')
      }
      await pagarCobroNfc(cobro.id, parsed.value)
      const fresh = await obtenerCobroNfc(cobro.id)
      setCobro(fresh)
      await refreshCuenta()
      toast.success('Pago recibido')
    } catch (err) {
      if (!isAbortError(err)) {
        setError(err instanceof Error ? err.message : 'No se pudo leer el QR')
        toast.error(err instanceof Error ? err.message : 'No se pudo leer el QR')
      }
    } finally {
      if (scanAbortRef.current === controller) scanAbortRef.current = null
      setScanning(false)
    }
  }

  async function crear() {
    if (!cuenta) return
    const n = parseFloat(monto)
    if (isNaN(n) || n <= 0) { setError('Ingresá un monto válido'); return }
    setLoading(true)
    setError('')
    try {
      const id = await crearCobroNfc(cuenta.id, n, descripcion)
      setCobro(await obtenerCobroNfc(id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el cobro')
    } finally {
      setLoading(false)
    }
  }

  async function cancelar() {
    scanAbortRef.current?.abort()
    if (!cobro) return
    await cancelarCobroNfc(cobro.id)
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
        <Button className="w-full mt-6" type="button" onClick={() => { setCobro(null); setMonto('') }}>
          Nuevo cobro
        </Button>
      </Card>
    )
  }

  if (cobro) {
    return (
      <Card className="p-6">
        <p className="font-body text-xs text-slate-secondary uppercase tracking-wider text-center">
          {apple || !caps.nfc ? 'Mostrá el QR a quien paga' : 'Mostrá el QR o acercá la tarjeta'}
        </p>
        <p className="font-display text-2xl font-bold text-mint text-center my-3">
          {formatMonto(cobro.monto, cobro.moneda)}
        </p>
        <QrBox value={encodeCobroQr(cobro.id)} alt="QR de cobro Monix" />
        {scanning ? (
          <div className="mt-4">
            <video ref={videoRef} className="w-full rounded-xl bg-black aspect-[4/3] object-cover" muted playsInline />
            <Button variant="secondary" className="w-full mt-3" type="button" onClick={() => scanAbortRef.current?.abort()}>
              Cancelar cámara
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 mt-4 text-mint">
              <NfcWaves className="w-8 h-8" />
              <p className="font-body text-sm">
                {apple || !caps.nfc ? 'Esperando que escaneen tu QR…' : 'Esperando chip, QR o teléfono…'}
              </p>
            </div>
            <Button
              variant="secondary"
              className="w-full mt-4"
              type="button"
              onClick={() => { void escanearChipCliente() }}
            >
              Escanear QR del cliente
            </Button>
          </>
        )}
        {error && <p className="text-sm text-red-500 dark:text-red-400 mt-3">{error}</p>}
        <Button variant="secondary" className="w-full mt-5" type="button" onClick={() => { void cancelar() }}>
          Cancelar cobro
        </Button>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <QrCode size={18} className="text-mint" />
        <h2 className="font-display font-semibold text-navy dark:text-white">Cobrar con QR o NFC</h2>
      </div>
      <div className="flex flex-col gap-3">
        <Input label="Monto" type="number" min="0.01" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" />
        <Input label="Concepto (opcional)" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Café, almuerzo…" />
        {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
        <Button type="button" loading={loading} onClick={() => { void crear() }}>
          Generar cobro
        </Button>
      </div>
    </Card>
  )
}

export function PagarNfcPanel({ cobroIdInicial }: { cobroIdInicial?: string }) {
  const { cuenta, refreshCuenta } = useCuenta()
  const { updateSaldoCuenta } = useCuentaStore()
  const [cobroId, setCobroId] = useState(cobroIdInicial ?? '')
  const [cobro, setCobro] = useState<CobroNfc | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [listoParaTocar, setListoParaTocar] = useState(false)
  const cryptoRef = useRef('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const [scanning, setScanning] = useState(false)
  const scanAbortRef = useRef<AbortController | null>(null)
  const caps = radioCapabilities()
  const apple = isIosDevice()

  useEffect(() => {
    if (cobroIdInicial) void cargar(cobroIdInicial)
  }, [cobroIdInicial])

  async function cargar(id: string) {
    setLoading(true)
    setError('')
    try {
      setCobro(await obtenerCobroNfc(id))
      setCobroId(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se encontró el cobro')
    } finally {
      setLoading(false)
    }
  }

  async function activarTelefono() {
    if (!cuenta || !cobro) return
    setError('')
    try {
      const token = randomToken()
      cryptoRef.current = token
      await generarCriptogramaNfc(cuenta.id, token)
      await monixRadio.startHce(encodePayPayload(token))
      setListoParaTocar(true)
      toast.success('Acercá el teléfono al lector')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo activar el pago')
    }
  }

  async function pagarConChipTelefono() {
    if (!cobro) return
    setLoading(true)
    try {
      const token = cryptoRef.current || randomToken()
      if (!cryptoRef.current && cuenta) {
        cryptoRef.current = token
        await generarCriptogramaNfc(cuenta.id, token)
      }
      await pagarCobroNfc(cobro.id, token)
      const fresh = await obtenerCobroNfc(cobro.id)
      setCobro(fresh)
      await refreshCuenta()
      if (cuenta) updateSaldoCuenta(cuenta.id, cuenta.saldo - fresh.monto)
      toast.success('Pago realizado')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo pagar')
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
      if (parsed?.kind === 'cobro') await cargar(parsed.value)
      else await cargar(raw.replace(/^MONIXPAY:/i, ''))
    } catch (err) {
      if (!isAbortError(err)) {
        setError(err instanceof Error ? err.message : 'No se pudo abrir la cámara')
      }
    } finally {
      if (scanAbortRef.current === controller) scanAbortRef.current = null
      setScanning(false)
    }
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
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <ScanLine size={18} className="text-mint" />
          <h2 className="font-display font-semibold text-navy dark:text-white">Pagar un QR</h2>
        </div>
        <Input label="Código de cobro" value={cobroId} onChange={(e) => setCobroId(e.target.value)} placeholder="MONIXPAY:…" />
        <div className="flex gap-2 mt-3">
          <Button variant="secondary" className="flex-1" type="button" onClick={() => { void escanearQr() }}>
            Cámara
          </Button>
          <Button className="flex-1" type="button" loading={loading} onClick={() => { void cargar(cobroId.replace(/^MONIXPAY:/, '')) }}>
            Cargar
          </Button>
        </div>
        {scanning && (
          <>
            <video ref={videoRef} className="mt-3 w-full rounded-xl bg-black aspect-[4/3] object-cover" muted playsInline />
            <Button variant="secondary" className="w-full mt-2" type="button" onClick={() => scanAbortRef.current?.abort()}>
              Cancelar cámara
            </Button>
          </>
        )}
      </Card>

      {cobro && (
        <Card className="p-6">
          <p className="font-body text-xs text-slate-secondary">Vas a pagar a</p>
          <p className="font-display font-semibold text-navy dark:text-white">
            {cobro.comercio_nombre} {cobro.comercio_apellido}
          </p>
          {cobro.comercio_alias && <p className="font-body text-xs text-slate-secondary">@{cobro.comercio_alias}</p>}
          <p className="font-display text-2xl font-bold text-mint my-3">{formatMonto(cobro.monto, cobro.moneda)}</p>
          {error && <p className="text-sm text-red-500 dark:text-red-400 mb-3">{error}</p>}
          {caps.native && (
            <Button className="w-full flex items-center justify-center gap-2" type="button" onClick={() => { void activarTelefono() }}>
              <Smartphone size={16} />
              Acercar este teléfono
            </Button>
          )}
          <Button
            className={`w-full flex items-center justify-center gap-2 ${caps.native ? 'mt-2' : ''}`}
            variant={caps.native ? 'secondary' : 'primary'}
            type="button"
            loading={loading}
            onClick={() => { void pagarConChipTelefono() }}
          >
            <Nfc size={16} />
            {apple || !caps.native ? 'Pagar' : 'Confirmar pago'}
          </Button>
          {listoParaTocar && (
            <p className="font-body text-xs text-mint text-center mt-3">
              Teléfono listo. Acercarlo al lector o confirmá el pago acá.
            </p>
          )}
          {!caps.native && (
            <p className="font-body text-xs text-slate-secondary text-center mt-3">
              En iPhone pagás con el QR. Escaneá el cobro y confirmá.
            </p>
          )}
        </Card>
      )}
    </div>
  )
}
