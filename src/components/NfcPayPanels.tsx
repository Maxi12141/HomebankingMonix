import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, Loader2, QrCode, ScanLine, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import { useCuenta } from '../hooks/useCuenta'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { QrBox } from './QrBox'
import { QrScannerFullscreen } from './QrScannerFullscreen'
import { formatMonto } from '../utils/cuenta'
import { encodeCobroQr, encodeCuentaQr, parseRadioPayload } from '../lib/tokens'
import { decodeJwt } from 'jose'
import {
  MONIX_BANK_CODE,
  avisarLectura,
  esJwtQr,
  firmarQrPropio,
  nombreBanco,
  verificarJwtQr,
  type QrJwtClaims,
} from '../lib/qrJwt'
import { useAuthStore } from '../store/authStore'
import {
  detectQrUntil,
  engancharCamara,
  leerQrDeArchivo,
  mensajeErrorCamara,
  setLinterna,
  startQrCamera,
  stopMediaStream,
  waitForVideo,
} from '../lib/scanQr'
import { isAbortError } from '../native/monixRadio'
import { useQrScanStore } from '../stores/qrScanStore'
import { useContactos } from '../hooks/useContactos'
import { buscarDestinatarioBC } from '../services/bancoCentral'
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

async function aplicarQr(
  raw: string,
  cargarCobro: (id: string) => Promise<void>,
  cargarCuenta: (id: string) => Promise<void>,
  cargarDestinoJwt: (claims: QrJwtClaims) => Promise<void>,
) {
  // QR interbancario firmado (docs/qr-interbancario-jwt.md): se prueba antes
  // que los formatos internos, para que también funcione con QRs de otros
  // bancos de la cátedra. Si claims.cid apunta a un cobro propio, se sigue
  // exactamente el camino de siempre (con seguimiento en tiempo real); si no,
  // se resuelve como una transferencia común por CBU.
  if (esJwtQr(raw.trim())) {
    const resultado = await verificarJwtQr(raw)
    if (resultado) {
      const { claims } = resultado
      // Aviso de lectura (spec, secciones 12 y 13): el banco emisor le avisa a
      // su usuario y cierra el QR, como un posnet. Si ya lo escaneó otra
      // persona responde 409 y no se deja pagar; si no responde, se sigue.
      const persona = useAuthStore.getState().persona
      const aviso = await avisarLectura(
        raw,
        claims,
        persona ? `${persona.nombre} ${persona.apellido.charAt(0)}.`.trim() : null,
      )
      if (aviso === 'usado') {
        throw new Error('Este QR ya fue escaneado por otra persona. Pedí que te muestren uno nuevo.')
      }
      if (claims.iss === MONIX_BANK_CODE && claims.cid) {
        await cargarCobro(claims.cid)
        return
      }
      await cargarDestinoJwt(claims)
      return
    }
  }

  const parsed = parseRadioPayload(raw)
  if (parsed?.kind === 'cobro') {
    await cargarCobro(parsed.value)
    return
  }
  if (parsed?.kind === 'cuenta') {
    await cargarCuenta(parsed.value)
    return
  }
  if (parsed?.kind === 'pay') {
    throw new Error('Ese código es de la tarjeta. Para pagar con QR usá el código de esta pantalla.')
  }
  if (!parsed) {
    // No matchea ningún formato conocido — sin esto caía a cargarCobro con el raw y mostraba un error de Postgres.
    throw new Error('Ese código QR no es de Monix.')
  }
  await cargarCobro(raw.replace(/^MONIXPAY:/i, ''))
}

function QrConCarga({ value, cargando: cargandoDatos }: { value: string; cargando: boolean }) {
  // QrBox arma la imagen de forma asíncrona y mientras tanto sigue mostrando
  // la anterior: el spinner se mantiene hasta que la imagen nueva está lista.
  const [dibujado, setDibujado] = useState('')
  const cargando = cargandoDatos || (!!value && dibujado !== value)
  return (
    <div className="relative w-56 h-56 mx-auto" aria-busy={cargando}>
      {value ? (
        <div className={`transition-[filter,opacity] duration-200 ${cargando ? 'blur-md opacity-50' : ''}`}>
          <QrBox value={value} alt="Tu QR de Monix" onReady={() => setDibujado(value)} />
        </div>
      ) : (
        <div className="w-56 h-56 rounded-xl bg-slate-input dark:bg-white/5" />
      )}
      {cargando && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 size={36} className="animate-spin text-mint" aria-label="Generando QR" />
        </div>
      )}
    </div>
  )
}

export function MiCodigoQr({ variante = 'pagina' }: { variante?: 'pagina' | 'overlay' }) {
  const { cuenta: cuentaArs, cuentas, refreshCuenta } = useCuenta()
  const cuentaUsd = cuentas.find((c) => c.moneda === 'USD')
  const [monedaQr, setMonedaQr] = useState<'ARS' | 'USD'>('ARS')
  // useCuenta().cuenta es siempre la de pesos: el QR se arma sobre la cuenta
  // de la moneda elegida, así el cobro (cobros_nfc) y el JWT quedan en USD.
  const cuenta = monedaQr === 'USD' && cuentaUsd ? cuentaUsd : cuentaArs
  const [monto, setMonto] = useState('')
  const [cobro, setCobro] = useState<CobroNfc | null>(null)
  const [error, setError] = useState('')
  // Se guarda junto con la clave de lo que firmó: al cambiar de moneda (o de
  // monto) el JWT anterior no se muestra mientras llega el nuevo.
  const [jwtFirmado, setJwtFirmado] = useState<{ clave: string; jwt: string } | null>(null)
  // Clave cuya firma falló: sólo entonces se cae al formato interno viejo.
  const [firmaFallida, setFirmaFallida] = useState<string | null>(null)
  const cobroIdRef = useRef<string | null>(null)
  // Sube en cada descarte de cobro: un crearCobroNfc que estaba en vuelo
  // cuando el usuario cambió de moneda no debe pisar el QR nuevo.
  const generacionRef = useRef(0)
  // ronda sube con "Generar nuevo QR": fuerza una firma nueva (otro jti)
  // aunque no haya cambiado ni la cuenta ni el cobro.
  const [ronda, setRonda] = useState(0)
  const claveQr = `${cuenta?.cbu ?? ''}|${cobro?.id ?? ''}|${ronda}`
  const userId = useAuthStore((st) => st.user?.id)
  // QR de un solo uso, como un posnet (spec, sección 13): cuando llega el
  // aviso de que escanearon EL QR que está en pantalla, se cierra.
  const [cerradoPor, setCerradoPor] = useState<string | null>(null)
  const jtiActualRef = useRef<string | null>(null)

  // QR interbancario firmado (docs/qr-interbancario-jwt.md): se pide a la
  // Edge Function apenas hay cuenta/cobro para mostrar. Si falla (sin red, la
  // función no está desplegada en otro entorno, etc.) qrValue más abajo cae
  // solo al formato interno de siempre — nunca se rompe el QR por esto.
  // Mientras firma NO se muestra ese formato interno (era un QR distinto que
  // aparecía medio segundo): se ve el anterior desenfocado con un spinner.
  useEffect(() => {
    let vivo = true
    if (!cuenta?.cbu) { setJwtFirmado(null); return }
    const clave = claveQr
    void firmarQrPropio({
      cbu: cuenta.cbu,
      alias: cuenta.alias,
      monto: cobro?.monto,
      moneda: cobro?.moneda ?? cuenta.moneda,
      cid: cobro?.id,
    })
      .then((jwt) => { if (vivo) setJwtFirmado({ clave, jwt }) })
      .catch(() => { if (vivo) setFirmaFallida(clave) })
    return () => { vivo = false }
  }, [cuenta?.cbu, cuenta?.alias, cuenta?.moneda, cobro?.id, cobro?.monto, cobro?.moneda, ronda])

  useEffect(() => { setCerradoPor(null) }, [claveQr])

  // Aviso de lectura: la Edge Function qr-lectura inserta una fila cada vez
  // que un banco (Monix u otro) nos avisa que escaneó un QR nuestro.
  useEffect(() => {
    if (!userId) return
    let channel: ReturnType<typeof supabase.channel> | null = null
    try {
      channel = supabase
        .channel(`qr-lecturas-${userId}-${Math.random().toString(36).slice(2, 8)}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'qr_lecturas',
          filter: `persona_id=eq.${userId}`,
        }, (payload) => {
          const fila = payload.new as { jti: string | null; banco_lector: number; nombre_lector: string | null }
          const quien = fila.nombre_lector ?? 'Alguien'
          const banco = fila.banco_lector === MONIX_BANK_CODE ? '' : ` desde ${nombreBanco(fila.banco_lector)}`
          const texto = `${quien} escaneó tu QR${banco}`
          if (fila.jti && fila.jti === jtiActualRef.current) setCerradoPor(texto)
          toast(texto, { icon: '👀' })
        })
        .subscribe()
    } catch (err) {
      console.error('No se pudo escuchar las lecturas del QR:', err)
      return
    }
    return () => {
      const ch = channel
      window.setTimeout(() => {
        if (ch) void supabase.removeChannel(ch)
      }, 400)
    }
  }, [userId])

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
    const generacion = generacionRef.current
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
          if (generacion !== generacionRef.current) {
            await cancelarCobroNfc(id).catch(() => undefined)
            return
          }
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

  function cambiarMoneda(m: 'ARS' | 'USD') {
    if (m === monedaQr) return
    // El cobro pendiente pertenece a la cuenta anterior: se descarta y el
    // monto se limpia (100 pesos no son 100 dólares).
    nuevoCobro()
    setMonedaQr(m)
  }

  function nuevoQr() {
    nuevoCobro()
    setRonda((r) => r + 1)
  }

  function nuevoCobro() {
    generacionRef.current += 1
    // El estado se limpia en el acto; la cancelación del cobro viejo corre de
    // fondo para que el QR y el monto no queden un instante desfasados.
    if (cobroIdRef.current) {
      void cancelarCobroNfc(cobroIdRef.current).catch(() => undefined)
    }
    cobroIdRef.current = null
    setCobro(null)
    setMonto('')
  }

  if (cobro?.estado === 'pagado') {
    if (variante === 'overlay') {
      return (
        <div className="flex h-full flex-col items-center justify-center px-6 pb-28 pt-16 text-center">
          <CheckCircle size={48} className="text-mint mb-3" />
          <h2 className="font-display text-lg font-semibold text-white">Cobro acreditado</h2>
          <p className="font-display text-2xl font-bold text-mint mt-2">
            {formatMonto(cobro.monto, cobro.moneda)}
          </p>
          <Button className="w-full max-w-xs mt-6" type="button" onClick={nuevoCobro}>
            Nuevo QR
          </Button>
        </div>
      )
    }
    return (
      <Card className="p-8 text-center">
        <CheckCircle size={48} className="text-mint mx-auto mb-3" />
        <h2 className="font-display text-lg font-semibold text-navy dark:text-white">Cobro acreditado</h2>
        <p className="font-display text-2xl font-bold text-mint mt-2">
          {formatMonto(cobro.monto, cobro.moneda)}
        </p>
        <Button className="w-full mt-6" type="button" onClick={nuevoCobro}>
          Nuevo QR
        </Button>
      </Card>
    )
  }

  const jwtQr = jwtFirmado?.clave === claveQr ? jwtFirmado.jwt : ''
  const fallbackQr = cobro
    ? encodeCobroQr(cobro.id)
    : cuenta?.id
      ? encodeCuentaQr(cuenta.id)
      : ''
  const qrValue = jwtQr || (firmaFallida === claveQr ? fallbackQr : '')
  // El monto tipeado todavía no se convirtió en cobro (debounce + RPC): el QR
  // visible aún no lo incluye, así que también cuenta como "cargando".
  const montoNum = parseFloat(monto.trim().replace(',', '.'))
  const montoValido = !isNaN(montoNum) && montoNum > 0
  const montoPendiente = montoValido ? cobro?.monto !== montoNum : !!cobro
  const cargandoQr = !!cuenta?.cbu && (!qrValue || montoPendiente)
  const qrMostrado = qrValue || jwtFirmado?.jwt || ''
  // Sólo cierra el aviso del QR que está en pantalla: si se escanea uno viejo
  // (otra moneda, otro monto) queda el toast, pero este QR sigue abierto.
  try {
    jtiActualRef.current = jwtQr ? ((decodeJwt(jwtQr).jti as string | undefined) ?? null) : null
  } catch {
    jtiActualRef.current = null
  }

  if (cerradoPor) {
    const esperando = cobro?.estado === 'pendiente'
    const overlay = variante === 'overlay'
    const contenido = (
      <>
        <ScanLine size={44} className="text-mint mx-auto mb-3" />
        <h2 className={`font-display text-lg font-semibold ${overlay ? 'text-white' : 'text-navy dark:text-white'}`} role="status">
          {cerradoPor}
        </h2>
        {esperando && cobro ? (
          <p className={`font-body text-sm mt-2 inline-flex items-center gap-2 ${overlay ? 'text-white/70' : 'text-slate-secondary'}`}>
            <Loader2 size={14} className="animate-spin text-mint" />
            Esperando el pago de {formatMonto(cobro.monto, cobro.moneda)}…
          </p>
        ) : (
          <p className={`font-body text-sm mt-2 ${overlay ? 'text-white/70' : 'text-slate-secondary'}`}>
            Este QR ya no se puede volver a usar.
          </p>
        )}
        <Button className={`w-full mt-6 ${overlay ? 'max-w-xs' : ''}`} type="button" onClick={nuevoQr}>
          Generar nuevo QR
        </Button>
      </>
    )
    if (overlay) {
      return (
        <div className="flex h-full flex-col items-center justify-center px-6 pb-28 pt-16 text-center">
          {contenido}
        </div>
      )
    }
    return <Card className="p-8 text-center">{contenido}</Card>
  }

  if (variante === 'overlay') {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 pb-28 pt-16">
        <p className="font-display text-lg font-semibold text-white text-center">
          Mostrá tu código para cobrar
        </p>
        <p className="font-body text-xs text-white/60 text-center mt-1 mb-5">
          Que te lo escaneen. Si ponés un monto, ya lo ven.
        </p>
        {cuentaUsd && (
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-white/10 w-full max-w-xs mb-4">
            <button
              type="button"
              aria-pressed={monedaQr === 'ARS'}
              onClick={() => cambiarMoneda('ARS')}
              className={`rounded-lg py-2 font-body text-sm font-medium transition-colors ${
                monedaQr === 'ARS' ? 'bg-mint text-navy' : 'text-white/60 hover:text-white'
              }`}
            >
              Pesos
            </button>
            <button
              type="button"
              aria-pressed={monedaQr === 'USD'}
              onClick={() => cambiarMoneda('USD')}
              className={`rounded-lg py-2 font-body text-sm font-medium transition-colors ${
                monedaQr === 'USD' ? 'bg-mint text-navy' : 'text-white/60 hover:text-white'
              }`}
            >
              Dólares
            </button>
          </div>
        )}
        <QrConCarga value={qrMostrado} cargando={cargandoQr} />
        {cuenta?.alias && (
          <p className="font-body text-sm text-white/70 text-center mt-3">@{cuenta.alias}</p>
        )}
        {cobro && (
          <p className="font-display text-xl font-bold text-mint text-center mt-2">
            {formatMonto(cobro.monto, cobro.moneda)}
          </p>
        )}
        <div className="w-full max-w-xs mt-4">
          <Input
            label={`Monto en ${monedaQr === 'USD' ? 'dólares' : 'pesos'} (opcional)`}
            type="number"
            min="0.01"
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="Lo carga quien paga"
            className="bg-white text-navy"
          />
        </div>
        {error && <p className="text-sm text-red-300 mt-3">{error}</p>}
      </div>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-1">
        <QrCode size={18} className="text-mint" />
        <h2 className="font-display font-semibold text-navy dark:text-white">Tu QR</h2>
      </div>
      <p className="font-body text-xs text-slate-secondary mb-4">
        Mostralo para cobrar. Si ponés un monto, el que paga ya ve esa cifra; si lo dejás vacío, la carga en el momento.
      </p>
      {cuentaUsd && (
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-input dark:bg-white/5 mb-4">
          <button
            type="button"
            aria-pressed={monedaQr === 'ARS'}
            onClick={() => cambiarMoneda('ARS')}
            className={`rounded-lg py-2 font-body text-sm font-medium transition-colors ${
              monedaQr === 'ARS' ? 'bg-mint text-navy' : 'text-slate-secondary hover:text-navy dark:hover:text-white'
            }`}
          >
            Pesos
          </button>
          <button
            type="button"
            aria-pressed={monedaQr === 'USD'}
            onClick={() => cambiarMoneda('USD')}
            className={`rounded-lg py-2 font-body text-sm font-medium transition-colors ${
              monedaQr === 'USD' ? 'bg-mint text-navy' : 'text-slate-secondary hover:text-navy dark:hover:text-white'
            }`}
          >
            Dólares
          </button>
        </div>
      )}
      <QrConCarga value={qrMostrado} cargando={cargandoQr} />
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
          label={`Monto en ${monedaQr === 'USD' ? 'dólares' : 'pesos'} (opcional)`}
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

function BotonAgendar({
  nombre,
  apellido,
  alias,
}: {
  nombre: string
  apellido: string
  alias: string | null
}) {
  const { guardar, isGuardado } = useContactos()
  const [cbu, setCbu] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const guardado = cbu != null && isGuardado(cbu)

  async function agendar() {
    const limpio = alias?.trim().replace(/^@/, '')
    if (!limpio) {
      toast.error('Este QR no trae alias para agendar')
      return
    }
    setLoading(true)
    try {
      const bc = await buscarDestinatarioBC(limpio, false)
      const yaEstaba = isGuardado(bc.cbu)
      guardar({
        nombre: bc.nombre || nombre,
        apellido: bc.apellido || apellido,
        cbu: bc.cbu,
        alias: bc.alias ?? limpio,
        apodo: null,
      })
      setCbu(bc.cbu)
      toast.success(yaEstaba ? 'Ya estaba en tu agenda' : 'Contacto agendado')
    } catch {
      toast.error('No se pudo agendar el contacto')
    } finally {
      setLoading(false)
    }
  }

  if (!alias) return null
  if (guardado) {
    return <p className="font-body text-sm text-mint text-center mt-3">En tu agenda</p>
  }
  return (
    <Button
      variant="secondary"
      className="w-full mt-2"
      type="button"
      loading={loading}
      loadingLabel="Agendando..."
      onClick={() => { void agendar() }}
    >
      <span className="inline-flex items-center justify-center gap-2">
        <UserPlus size={16} />
        Agendar contacto
      </span>
    </Button>
  )
}

export function EscanearYPagar({
  cobroIdInicial,
  onCerrarScan,
  overlay = false,
}: {
  cobroIdInicial?: string
  onCerrarScan?: () => void
  overlay?: boolean
}) {
  const navigate = useNavigate()
  const { refreshCuenta } = useCuenta()
  const [cobro, setCobro] = useState<CobroNfc | null>(null)
  const [destino, setDestino] = useState<DestinoQr | null>(null)
  const [montoLibre, setMontoLibre] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pagado, setPagado] = useState<{
    nombre: string
    apellido: string
    alias: string | null
    monto: number
    moneda: 'ARS' | 'USD'
  } | null>(null)
  const [scanning, setScanning] = useState(!cobroIdInicial)
  const [closing, setClosing] = useState(false)
  const [vista, setVista] = useState<'camara' | 'cobrar'>('camara')
  const [torchOn, setTorchOn] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fotoRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanAbortRef = useRef<AbortController | null>(null)
  const closingRef = useRef(false)

  function apagarCamara() {
    scanAbortRef.current?.abort()
    scanAbortRef.current = null
    stopMediaStream(streamRef.current)
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setTorchOn(false)
  }

  useEffect(() => {
    if (!cobroIdInicial) void escanearQr()
    return () => {
      scanAbortRef.current?.abort()
      scanAbortRef.current = null
      stopMediaStream(streamRef.current)
      streamRef.current = null
    }
  }, [])
  useEffect(() => {
    if (cobroIdInicial) void cargarCobro(cobroIdInicial)
  }, [cobroIdInicial])

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

  function irA(path: string, state?: object) {
    apagarCamara()
    closingRef.current = true
    useQrScanStore.getState().close()
    onCerrarScan?.()
    navigate(path, state ? { state } : undefined)
  }

  async function cargarCuenta(id: string) {
    setLoading(true)
    setError('')
    try {
      const row = await resolverQrCuenta(id)
      const alias = row.alias?.trim().replace(/^@/, '')
      if (alias) {
        irA('/transferir', { cbu: alias, fromQr: true, elegirMonto: true })
        return
      }
      setDestino(row)
      setCobro(null)
      setMontoLibre('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer ese QR')
    } finally {
      setLoading(false)
    }
  }

  async function cargarDestinoJwt(claims: QrJwtClaims) {
    const tieneMonto = typeof claims.monto === 'number' && claims.monto > 0
    const clave = (claims.cbu || claims.alias || '').trim()
    if (!clave) {
      setError('Ese QR no trae alias ni CBU')
      return
    }
    irA('/transferir', {
      cbu: clave,
      monto: tieneMonto ? claims.monto : undefined,
      fromQr: true,
      elegirMonto: !tieneMonto,
    })
  }

  async function leerQrDeCamara(video: HTMLVideoElement, signal: AbortSignal) {
    const pending = useQrScanStore.getState().takeStreamPromise()
    const stream = pending ? await pending : await startQrCamera(video)
    if (pending) await engancharCamara(video, stream)
    if (signal.aborted) {
      stopMediaStream(stream)
      throw new DOMException('Aborted', 'AbortError')
    }
    streamRef.current = stream
    try {
      return await detectQrUntil(video, signal)
    } finally {
      if (!closingRef.current) {
        stopMediaStream(stream)
        if (streamRef.current === stream) streamRef.current = null
        if (videoRef.current) videoRef.current.srcObject = null
        setTorchOn(false)
      }
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
      if (closingRef.current) return
      await aplicarQr(raw, cargarCobro, cargarCuenta, cargarDestinoJwt)
      if (scanAbortRef.current === controller) setScanning(false)
    } catch (err) {
      if (scanAbortRef.current !== controller) return
      if (isAbortError(err)) {
        if (!closingRef.current) setScanning(false)
      } else {
        // Sin esto el video queda congelado con el error encima, sin forma de reintentar.
        if (!closingRef.current) setScanning(false)
        setError(mensajeErrorCamara(err))
      }
    } finally {
      if (scanAbortRef.current === controller) scanAbortRef.current = null
    }
  }

  async function toggleTorch() {
    const desdeVideo = videoRef.current?.srcObject
    const stream = streamRef.current ?? (desdeVideo instanceof MediaStream ? desdeVideo : null)
    const next = !torchOn
    try {
      await setLinterna(stream, next)
      setTorchOn(next)
    } catch {
      toast.error('No se pudo prender la linterna')
    }
  }

  function mostrarMiQr() {
    apagarCamara()
    setVista('cobrar')
    setScanning(false)
    setError('')
  }

  function cancelarScan() {
    closingRef.current = true
    setClosing(true)
    scanAbortRef.current?.abort()
  }

  async function escanearFoto(file: Blob) {
    apagarCamara()
    setScanning(false)
    setError('')
    setLoading(true)
    try {
      const raw = await leerQrDeArchivo(file)
      await aplicarQr(raw, cargarCobro, cargarCuenta, cargarDestinoJwt)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer la foto')
    } finally {
      setLoading(false)
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
        nombre: fresh.comercio_nombre,
        apellido: fresh.comercio_apellido,
        alias: fresh.comercio_alias,
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
        nombre: destino.nombre,
        apellido: destino.apellido,
        alias: destino.alias,
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
    apagarCamara()
    setScanning(false)
    setCobro(null)
    setDestino(null)
    setPagado(null)
    setError('')
    onCerrarScan?.()
  }

  function caja(node: ReactNode) {
    if (!overlay) return node
    return createPortal(
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-navy/85 p-4">
        <div className="w-full max-w-md">{node}</div>
      </div>,
      document.body,
    )
  }

  function accionesPostPago(nombre: string, apellido: string, alias: string | null) {
    return (
      <div className="mt-6 flex flex-col">
        <Button className="w-full" type="button" onClick={() => irA('/dashboard')}>
          Volver al inicio
        </Button>
        <Button variant="secondary" className="w-full mt-2" type="button" onClick={() => irA('/transferir')}>
          Realizar otra transferencia
        </Button>
        <BotonAgendar nombre={nombre} apellido={apellido} alias={alias} />
      </div>
    )
  }

  if (pagado) {
    return caja(
      <Card className="p-8 text-center">
        <CheckCircle size={48} className="text-mint mx-auto mb-3" />
        <h2 className="font-display text-lg font-semibold text-navy dark:text-white">Pago exitoso</h2>
        <p className="font-body text-sm text-slate-secondary mt-1">
          Le pagaste a {pagado.nombre} {pagado.apellido}
        </p>
        <p className="font-display text-2xl font-bold text-mint mt-2">{formatMonto(pagado.monto, pagado.moneda)}</p>
        {accionesPostPago(pagado.nombre, pagado.apellido, pagado.alias)}
      </Card>,
    )
  }

  if (cobro?.estado === 'pagado') {
    return caja(
      <Card className="p-8 text-center">
        <CheckCircle size={48} className="text-mint mx-auto mb-3" />
        <h2 className="font-display text-lg font-semibold text-navy dark:text-white">Pago exitoso</h2>
        <p className="font-body text-sm text-slate-secondary mt-1">
          Le pagaste a {cobro.comercio_nombre} {cobro.comercio_apellido}
        </p>
        <p className="font-display text-2xl font-bold text-mint mt-2">{formatMonto(cobro.monto, cobro.moneda)}</p>
        {accionesPostPago(cobro.comercio_nombre, cobro.comercio_apellido, cobro.comercio_alias)}
      </Card>,
    )
  }

  if (cobro) {
    return caja(
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
        <BotonAgendar
          nombre={cobro.comercio_nombre}
          apellido={cobro.comercio_apellido}
          alias={cobro.comercio_alias}
        />
        <Button variant="secondary" className="w-full mt-2" type="button" onClick={volver}>
          Cancelar
        </Button>
      </Card>,
    )
  }

  if (destino) {
    return caja(
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
        <BotonAgendar nombre={destino.nombre} apellido={destino.apellido} alias={destino.alias} />
        <Button variant="secondary" className="w-full mt-2" type="button" onClick={volver}>
          Cancelar
        </Button>
      </Card>,
    )
  }

  const inputFoto = (
    <input
      ref={fotoRef}
      type="file"
      accept="image/*"
      className="sr-only"
      aria-hidden
      tabIndex={-1}
      onChange={(e) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (file) void escanearFoto(file)
      }}
    />
  )

  if (overlay && !pagado && !cobro && !destino) {
    return (
      <>
        {inputFoto}
        {createPortal(
          <QrScannerFullscreen
            videoRef={videoRef}
            error={error}
            torchOn={torchOn}
            closing={closing}
            vista={vista}
            cobrar={<MiCodigoQr variante="overlay" />}
            onClose={cancelarScan}
            onMostrarQr={mostrarMiQr}
            onClosed={() => {
              apagarCamara()
              if (closingRef.current) onCerrarScan?.()
            }}
            onToggleTorch={() => { void toggleTorch() }}
          />,
          document.body,
        )}
      </>
    )
  }

  if (scanning || closing) {
    return (
      <>
        {inputFoto}
        {createPortal(
          <QrScannerFullscreen
            videoRef={videoRef}
            error={error}
            torchOn={torchOn}
            closing={closing}
            vista={vista}
            cobrar={<MiCodigoQr variante="overlay" />}
            onClose={cancelarScan}
            onMostrarQr={mostrarMiQr}
            onClosed={() => {
              apagarCamara()
              if (closingRef.current) onCerrarScan?.()
            }}
            onToggleTorch={() => { void toggleTorch() }}
          />,
          document.body,
        )}
      </>
    )
  }

  return caja(
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <ScanLine size={18} className="text-mint" />
        <h2 className="font-display font-semibold text-navy dark:text-white">Escanear para pagar</h2>
      </div>
      {error && <p className="text-sm text-red-500 dark:text-red-400 mb-3">{error}</p>}
      {inputFoto}
      <Button className="w-full" type="button" loading={loading} onClick={() => { void escanearQr() }}>
        Abrir cámara
      </Button>
      <Button
        variant="secondary"
        className="w-full mt-2"
        type="button"
        loading={loading}
        onClick={() => fotoRef.current?.click()}
      >
        Elegir foto del QR
      </Button>
      {onCerrarScan && (
        <Button variant="secondary" className="w-full mt-2" type="button" onClick={onCerrarScan}>
          Volver a mi QR
        </Button>
      )}
    </Card>
  )
}
