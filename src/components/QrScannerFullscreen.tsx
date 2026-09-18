import { useEffect, useRef, forwardRef, type RefObject } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Image, X, Zap, ZapOff } from 'lucide-react'
import { useThemeStore } from '../stores/themeStore'
import { useQrScanStore } from '../stores/qrScanStore'
import { aplicarBarraDeEstado, aplicarBarraDeEstadoCamara } from '../native/statusBar'

function circleAt(x: number, y: number, r: number) {
  return `circle(${r}px at ${x}px ${y}px)`
}

function coverRadius(x: number, y: number) {
  const w = window.innerWidth
  const h = window.innerHeight
  return Math.max(
    Math.hypot(x, y),
    Math.hypot(w - x, y),
    Math.hypot(x, h - y),
    Math.hypot(w - x, h - y),
  ) + 24
}

const easeOut = [0.22, 1, 0.36, 1] as const

export const QrScannerFullscreen = forwardRef<HTMLDivElement, {
  videoRef: RefObject<HTMLVideoElement>
  error?: string
  torchOk: boolean
  torchOn: boolean
  onClose: () => void
  onToggleTorch: () => void
  onPickPhoto: () => void
}>(function QrScannerFullscreen({
  videoRef,
  error,
  torchOk,
  torchOn,
  onClose,
  onToggleTorch,
  onPickPhoto,
}, ref) {
  const theme = useThemeStore((s) => s.theme)
  const originX = useQrScanStore((s) => s.originX)
  const originY = useQrScanStore((s) => s.originY)
  const reduce = useReducedMotion()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const ox = originX || (typeof window !== 'undefined' ? window.innerWidth / 2 : 0)
  const oy = originY || (typeof window !== 'undefined' ? window.innerHeight - 88 : 0)
  const start = circleAt(ox, oy, 28)
  const end = circleAt(ox, oy, coverRadius(ox, oy))

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    void aplicarBarraDeEstadoCamara()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      void aplicarBarraDeEstado(theme)
    }
  }, [theme])

  return (
    <motion.div
      ref={ref}
      className="fixed inset-0 z-[200] overflow-hidden overscroll-none bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Escanear QR"
      initial={reduce ? { opacity: 0 } : { clipPath: start }}
      animate={reduce ? { opacity: 1 } : { clipPath: end }}
      exit={reduce ? { opacity: 0 } : { clipPath: start }}
      transition={{ duration: reduce ? 0.2 : 0.52, ease: easeOut }}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectFit: 'cover' }}
        muted
        playsInline
        autoPlay
      />

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
    </motion.div>
  )
})
