import { useEffect, useRef, useState, type PointerEvent, type ReactNode, type RefObject, type TransitionEvent } from 'react'
import { Image, ScanLine, X, Zap, ZapOff } from 'lucide-react'
import { useThemeStore } from '../stores/themeStore'
import { originFromFab, useQrScanStore } from '../stores/qrScanStore'
import { aplicarBarraDeEstado, aplicarBarraDeEstadoCamara } from '../native/statusBar'

const FAB_PX = 56

function layoutViewport() {
  if (typeof window === 'undefined') return { w: 390, h: 844 }
  return { w: window.innerWidth, h: window.innerHeight }
}

function coverRadius(x: number, y: number, w: number, h: number) {
  return Math.max(
    Math.hypot(x, y),
    Math.hypot(w - x, y),
    Math.hypot(x, h - y),
    Math.hypot(w - x, h - y),
  ) + 24
}

export function QrScannerFullscreen({
  videoRef,
  error,
  torchOk,
  torchOn,
  closing,
  vista = 'camara',
  cobrar,
  onClose,
  onClosed,
  onMostrarQr,
  onVolverACamara,
  onToggleTorch,
  onPickPhoto,
}: {
  videoRef: RefObject<HTMLVideoElement>
  error?: string
  torchOk: boolean
  torchOn: boolean
  closing?: boolean
  vista?: 'camara' | 'cobrar'
  cobrar?: ReactNode
  onClose: () => void
  onClosed?: () => void
  onMostrarQr?: () => void
  onVolverACamara?: () => void
  onToggleTorch: () => void
  onPickPhoto: () => void
}) {
  const theme = useThemeStore((s) => s.theme)
  const originX = useQrScanStore((s) => s.originX)
  const originY = useQrScanStore((s) => s.originY)
  const onClosedRef = useRef(onClosed)
  onClosedRef.current = onClosed
  const closedOnce = useRef(false)
  const [vp, setVp] = useState(layoutViewport)
  const [closeAt, setCloseAt] = useState<{ x: number; y: number } | null>(null)
  const [lift, setLift] = useState(0)
  const [dragging, setDragging] = useState(false)
  const liftRef = useRef(0)
  const dragRef = useRef<{ y: number; lift: number } | null>(null)
  const vistaRef = useRef(vista)
  vistaRef.current = vista
  const onMostrarQrRef = useRef(onMostrarQr)
  onMostrarQrRef.current = onMostrarQr

  function finishClose() {
    if (closedOnce.current) return
    closedOnce.current = true
    onClosedRef.current?.()
  }

  useEffect(() => {
    const update = () => setVp(layoutViewport())
    update()
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [])

  useEffect(() => {
    if (!closing) {
      setCloseAt(null)
      return
    }
    setCloseAt(originFromFab())
  }, [closing])

  const ox = originX || vp.w / 2
  const oy = originY || vp.h - 52
  const radius = coverRadius(ox, oy, vp.w, vp.h)
  const size = radius * 2
  const startScale = Math.min(1, FAB_PX / size)

  let transformOrigin = '50% 50%'
  if (closing && closeAt) {
    const px = ((closeAt.x - (ox - radius)) / size) * 100
    const py = ((closeAt.y - (oy - radius)) / size) * 100
    transformOrigin = `${px}% ${py}%`
  }

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    void aplicarBarraDeEstadoCamara()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      void aplicarBarraDeEstado(theme)
    }
  }, [onClose, theme])

  useEffect(() => {
    if (!closing) return
    const t = window.setTimeout(() => finishClose(), 450)
    return () => window.clearTimeout(t)
  }, [closing])

  useEffect(() => {
    if (dragRef.current) return
    const target = vista === 'cobrar' ? vp.h : 0
    if (Math.abs(liftRef.current - target) < 1) return
    liftRef.current = target
    setLift(target)
  }, [vista, vp.h])

  function ponerLift(n: number) {
    const clamped = Math.max(0, Math.min(vp.h, n))
    liftRef.current = clamped
    setLift(clamped)
  }

  function empezarArrastre(e: PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { y: e.clientY, lift: liftRef.current }
    setDragging(true)
  }

  function moverArrastre(e: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    if (!drag) return
    ponerLift(drag.lift + (drag.y - e.clientY))
  }

  function soltarArrastre() {
    if (!dragRef.current) return
    dragRef.current = null
    setDragging(false)
    const umbral = Math.min(140, vp.h * 0.16)
    const abrir = liftRef.current > umbral
    const destino = abrir ? vp.h : 0
    const yaEstaba = Math.abs(liftRef.current - destino) < 1
    ponerLift(destino)
    if (abrir && yaEstaba && vistaRef.current !== 'cobrar') onMostrarQrRef.current?.()
  }

  function alTerminarSubida(e: TransitionEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget || e.propertyName !== 'transform') return
    if (dragRef.current) return
    if (liftRef.current < vp.h - 1 || vistaRef.current === 'cobrar') return
    onMostrarQrRef.current?.()
  }

  const hojaArriba = lift >= vp.h - 1
  const camara = (
    <>
      <div className="absolute inset-x-0 top-0 z-10 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md"
            aria-label="Cerrar cámara"
          >
            <X size={20} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            className="flex h-11 w-24 touch-none items-center justify-center"
            aria-label="Arrastrá hacia arriba para ver tu QR"
            onPointerDown={empezarArrastre}
            onPointerMove={moverArrastre}
            onPointerUp={soltarArrastre}
            onPointerCancel={soltarArrastre}
          >
            <span className="h-1.5 w-14 rounded-full bg-white/90 shadow-sm" />
          </button>
          {torchOk ? (
            <button
              type="button"
              onClick={onToggleTorch}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md"
              aria-label={torchOn ? 'Apagar linterna' : 'Prender linterna'}
            >
              {torchOn ? <ZapOff size={18} /> : <Zap size={18} />}
            </button>
          ) : (
            <span className="h-10 w-10" aria-hidden />
          )}
        </div>
        <p className="mx-auto mt-2 w-fit rounded-full bg-black/50 px-4 py-2 font-body text-sm font-medium text-white backdrop-blur-md">
          Escaneá el código
        </p>
      </div>

      {error && (
        <p className="absolute inset-x-0 top-28 z-10 px-6 text-center font-body text-sm text-white/90">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onPickPhoto}
        className="absolute bottom-[max(1.75rem,calc(env(safe-area-inset-bottom)+1.5rem))] left-1/2 z-10 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-mint text-navy shadow-lg shadow-black/30"
        aria-label="Elegir foto del QR"
      >
        <Image size={22} strokeWidth={2.2} />
      </button>
    </>
  )

  return (
    <div
      className="fixed inset-0 z-[200] overflow-hidden overscroll-none"
      role="dialog"
      aria-modal="true"
      aria-label="Escanear QR"
    >
      <div
        className={closing ? 'qr-blob qr-blob-out' : 'qr-blob qr-blob-in'}
        style={{
          width: size,
          height: size,
          left: ox - radius,
          top: oy - radius,
          transformOrigin,
          ['--qr-start-scale' as string]: String(startScale),
        }}
        onAnimationEnd={(e) => {
          if (e.target !== e.currentTarget) return
          if (closing) finishClose()
        }}
      >
        <div
          className="absolute overflow-hidden bg-navy"
          style={{
            width: vp.w,
            height: vp.h,
            left: radius - ox,
            top: radius - oy,
          }}
        >
          <div className="absolute inset-0">
            <div className="absolute inset-x-0 top-0 z-10 flex items-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md"
                aria-label="Cerrar"
              >
                <X size={20} strokeWidth={2.2} />
              </button>
            </div>
            {cobrar}
            <button
              type="button"
              onClick={onVolverACamara}
              className="absolute bottom-[max(1.75rem,calc(env(safe-area-inset-bottom)+1.5rem))] left-1/2 z-10 flex h-14 items-center gap-2 -translate-x-1/2 rounded-full bg-mint px-5 text-navy shadow-lg shadow-black/30 font-body font-medium"
            >
              <ScanLine size={20} strokeWidth={2.2} />
              Escanear
            </button>
          </div>

          <div
            className="absolute inset-0 bg-black"
            style={{
              transform: `translate3d(0, ${-lift}px, 0)`,
              transition: dragging ? 'none' : 'transform 0.48s cubic-bezier(0.22, 1, 0.36, 1)',
              pointerEvents: hojaArriba ? 'none' : 'auto',
            }}
            onTransitionEnd={alTerminarSubida}
          >
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover"
              muted
              playsInline
              autoPlay
            />
            {camara}
          </div>
        </div>
      </div>
    </div>
  )
}
