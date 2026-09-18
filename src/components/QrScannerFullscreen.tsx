import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { Image, ScanLine, X, Zap, ZapOff } from 'lucide-react'
import { useThemeStore } from '../stores/themeStore'
import { useQrScanStore } from '../stores/qrScanStore'
import { aplicarBarraDeEstado, aplicarBarraDeEstadoCamara } from '../native/statusBar'

function coverRadius(x: number, y: number) {
  const w = window.visualViewport?.width ?? window.innerWidth
  const h = window.visualViewport?.height ?? window.innerHeight
  return Math.max(
    Math.hypot(x, y),
    Math.hypot(w - x, y),
    Math.hypot(x, h - y),
    Math.hypot(w - x, h - y),
  ) + 48
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

  function finishClose() {
    if (closedOnce.current) return
    closedOnce.current = true
    onClosedRef.current?.()
  }

  const ox = originX || (typeof window !== 'undefined' ? window.innerWidth / 2 : 0)
  const oy = originY || (typeof window !== 'undefined' ? window.innerHeight - 88 : 0)
  const radius = coverRadius(ox, oy)
  const size = radius * 2
  const startScale = Math.min(0.12, 56 / size)

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
          ['--qr-start-scale' as string]: String(startScale),
        }}
        onAnimationEnd={(e) => {
          if (e.target !== e.currentTarget) return
          if (closing) finishClose()
        }}
      >
        <video
          ref={videoRef}
          className={`absolute max-w-none object-cover ${vista === 'cobrar' ? 'opacity-0' : ''}`}
          style={{
            width: '100vw',
            height: '100vh',
            left: radius - ox,
            top: radius - oy,
            objectFit: 'cover',
          }}
          muted
          playsInline
          autoPlay
        />

        <div
          className="absolute"
          style={{
            width: '100vw',
            height: '100vh',
            left: radius - ox,
            top: radius - oy,
          }}
        >
          {vista === 'cobrar' ? (
            <>
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
                className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 z-10 flex h-14 items-center gap-2 -translate-x-1/2 rounded-full bg-mint px-5 text-navy shadow-lg shadow-black/30 font-body font-medium"
              >
                <ScanLine size={20} strokeWidth={2.2} />
                Escanear
              </button>
            </>
          ) : (
            <>
              <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md"
                  aria-label="Cerrar cámara"
                >
                  <X size={20} strokeWidth={2.2} />
                </button>
                <p className="rounded-full bg-black/50 px-4 py-2 font-body text-sm font-medium text-white backdrop-blur-md">
                  Escaneá el código
                </p>
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

              {error && (
                <p className="absolute inset-x-0 top-24 z-10 px-6 text-center font-body text-sm text-white/90">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={onPickPhoto}
                className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 z-10 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-mint text-navy shadow-lg shadow-black/30"
                aria-label="Elegir foto del QR"
              >
                <Image size={22} strokeWidth={2.2} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
