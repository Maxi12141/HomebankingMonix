import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { Check, Copy, RotateCcw } from 'lucide-react'
import { EASE_MONIX } from '../lib/motion'
import { ArcosTarjeta, ChipTarjeta, FONDO_FRENTE } from './TarjetaPiezas'

interface MonixCard3DProps {
  titular: string
  numeroCuenta?: string | null
  cbu?: string | null
  alias?: string | null
  tipo?: 'caja_ahorro' | 'cuenta_corriente' | string | null
  moneda?: 'ARS' | 'USD' | string | null
  showSensitive?: boolean
  frozen?: boolean
}

/** Número de tarjeta completo (fake, derivado de la cuenta) — mismo esquema que usa TarjetaPage. */
export function buildPan(numeroCuenta?: string | null, revealed?: boolean, moneda?: string | null) {
  const digits = (numeroCuenta ?? '').replace(/\D/g, '')
  const last4 = digits.slice(-4).padStart(4, '0')
  const bin = moneda === 'USD' ? '5591' : '4532'
  if (!revealed) return `${bin}  ••••  ••••  ${last4}`
  const mid = digits.slice(0, 2).padEnd(2, '0')
  return `${bin}  8814  62${mid}  ${last4}`
}

/** CVV fake determinístico, derivado de la cuenta (misma cuenta → mismo CVV siempre). */
export function buildCvv(numeroCuenta?: string | null) {
  const digits = (numeroCuenta ?? '').replace(/\D/g, '')
  if (digits.length >= 7) return digits.slice(3, 6)
  let hash = 0
  for (const ch of digits || 'monix') hash = (hash * 31 + ch.charCodeAt(0)) % 900
  return String(hash + 100)
}

// La de pesos va en azul noche con brillo mint; la de dólares, en grafito con brillo plateado.
const FONDOS = {
  ARS: {
    frente: FONDO_FRENTE.ars,
    dorso: 'linear-gradient(160deg, #001A3D 0%, #0D2B52 50%, #00112A 100%)',
  },
  USD: {
    frente: FONDO_FRENTE.usd,
    dorso: 'linear-gradient(160deg, #1E2631 0%, #3A4554 50%, #11161D 100%)',
  },
}

const faceBaseStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: 16,
  overflow: 'hidden',
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
  transformStyle: 'preserve-3d',
}

export function MonixCard3D({
  titular,
  numeroCuenta,
  cbu,
  alias,
  tipo,
  moneda,
  showSensitive = false,
  frozen = false,
}: MonixCard3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [flipped, setFlipped] = useState(false)
  const [copied, setCopied] = useState<'cbu' | 'alias' | null>(null)

  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const springX = useSpring(mx, { stiffness: 220, damping: 22, mass: 0.6 })
  const springY = useSpring(my, { stiffness: 220, damping: 22, mass: 0.6 })

  const rotateX = useTransform(springY, [-0.5, 0.5], [12, -12])
  const tiltY = useTransform(springX, [-0.5, 0.5], [-16, 16])
  const glareX = useTransform(springX, [-0.5, 0.5], [0, 100])
  const glareY = useTransform(springY, [-0.5, 0.5], [0, 100])
  const glareBackground = useTransform([glareX, glareY], (latest) => {
    const x = latest[0] as number
    const y = latest[1] as number
    return `radial-gradient(circle at ${x}% ${y}%, rgba(255,255,255,0.35) 0%, transparent 45%)`
  })

  const pan = useMemo(() => buildPan(numeroCuenta, showSensitive, moneda), [numeroCuenta, showSensitive, moneda])
  const cvv = useMemo(() => buildCvv(numeroCuenta), [numeroCuenta])
  const tipoLabel = tipo === 'cuenta_corriente' ? 'Cuenta Corriente' : 'Caja de Ahorro'
  const nombre = (titular || 'Titular MONIX').toUpperCase()
  const esUsd = moneda === 'USD'
  const fondo = FONDOS[esUsd ? 'USD' : 'ARS']

  function handlePointerMove(e: React.PointerEvent) {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    // When flipped 180°, invert X so tilt still feels natural on the back face
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    mx.set(flipped ? -x : x)
    my.set(y)
  }

  function handlePointerLeave() {
    mx.set(0)
    my.set(0)
  }

  function toggleFlip() {
    setFlipped((v) => !v)
  }

  async function copyField(value: string, field: 'cbu' | 'alias') {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopied(field)
    setTimeout(() => setCopied(null), 1800)
  }

  return (
    <div className="mb-6" id="perfil-tarjeta">
      <div className="mb-3">
        <p className="font-display text-sm font-semibold text-navy dark:text-white">
          Tu tarjeta débito
        </p>
        <p className="font-body text-xs text-slate-secondary mt-0.5">
          Mové el cursor para inclinarla · tocá para ver el dorso
        </p>
      </div>

      <div
        ref={containerRef}
        className="relative w-full max-w-md mx-auto"
        style={{ perspective: 1400 }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <button
          type="button"
          onClick={toggleFlip}
          // Área táctil de 44 px; la píldora visible queda igual (30 px, a 12 px del borde).
          className="group absolute top-[5px] right-[5px] z-30 p-[7px]"
        >
          <span className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-body font-medium text-white bg-black/30 backdrop-blur-sm border border-white/20 group-hover:border-mint/50 group-hover:bg-black/40 transition-colors">
            <RotateCcw size={13} />
            {flipped ? 'Frente' : 'Dorso'}
          </span>
        </button>
        {/* Tilt layer */}
        <motion.div
          style={{
            rotateX,
            rotateY: tiltY,
            transformStyle: 'preserve-3d',
          }}
          animate={{ scale: frozen ? [1, 0.96, 1] : 1 }}
          transition={{ duration: 0.45, ease: EASE_MONIX }}
          className="relative w-full aspect-[1.45/1] sm:aspect-[1.586/1]"
        >
          {/* Flip layer */}
          {/* Tocar la tarjeta la da vuelta. No es un botón porque adentro tiene los
              de copiar CBU/alias; con teclado y lector de pantalla se usa "Dorso". */}
          <motion.div
            onClick={toggleFlip}
            initial={false}
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ duration: 0.75, ease: EASE_MONIX }}
            className="relative w-full h-full cursor-pointer rounded-2xl"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* FRONT */}
            <div
              style={{
                ...faceBaseStyle,
                background: fondo.frente,
                boxShadow: '0 20px 50px -12px rgba(0,26,61,0.55)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <motion.div
                className="pointer-events-none absolute inset-0 opacity-60 mix-blend-soft-light rounded-2xl"
                style={{ background: glareBackground }}
              />
              <div className={`absolute -right-10 -top-16 h-40 w-40 rounded-full ${esUsd ? 'bg-white/10' : 'bg-mint/15'} blur-2xl pointer-events-none`} />
              <div className="absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-white/5 blur-2xl pointer-events-none" />
              <ArcosTarjeta />

              <div className="relative z-10 flex h-full flex-col justify-between p-5 sm:p-6 text-left">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-display text-lg font-bold tracking-[0.18em] text-white">
                      MONIX
                    </p>
                    <p className="font-body text-2xs uppercase tracking-[0.22em] text-mint/90 mt-0.5">
                      Débito · {tipoLabel}{moneda === 'USD' ? ' · USD' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                  <ChipTarjeta metal={esUsd ? 'plata' : 'oro'} className="h-8 w-auto" />
                  <svg viewBox="0 0 36 36" className="w-9 h-9 text-white/80" aria-hidden="true">
                    <circle cx="8" cy="18" r="2.2" fill="currentColor" />
                    <path d="M13 10.5a11 11 0 0 1 0 15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    <path d="M19 6a16 16 0 0 1 0 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.75" />
                    <path d="M25 2a22 22 0 0 1 0 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
                  </svg>
                  </div>
                </div>

                <div>
                  <p className="font-mono text-base sm:text-lg tracking-[0.18em] text-white/95">
                    {pan}
                  </p>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-body text-2xs uppercase tracking-[0.18em] text-slate-secondary">
                        Titular
                      </p>
                      <p className="font-display text-sm font-semibold text-white truncate">
                        {nombre}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-body text-2xs uppercase tracking-[0.18em] text-slate-secondary">
                        Vence
                      </p>
                      <p className="font-mono text-sm text-white/90">12/29</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* BACK */}
            <div
              style={{
                ...faceBaseStyle,
                transform: 'rotateY(180deg)',
                background: fondo.dorso,
                boxShadow: '0 20px 50px -12px rgba(0,26,61,0.55)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <div className="flex h-full flex-col text-left">
                <div className="mt-3 sm:mt-5 h-8 sm:h-10 w-full shrink-0 bg-black/70" />
                <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 py-2.5 sm:px-5 sm:py-3">
                  <div className="flex shrink-0 items-center justify-between rounded-md bg-white/90 px-3 py-1.5">
                    <span className="font-body text-2xs uppercase tracking-wider text-navy/50">CVV</span>
                    <span className="font-mono text-sm tracking-widest text-navy">
                      {showSensitive ? cvv : '•••'}
                    </span>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-body text-2xs uppercase tracking-[0.16em] text-slate-secondary">
                          CBU
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            void copyField(cbu ?? '', 'cbu')
                          }}
                          className="toque [--toque:14px] text-slate-secondary transition-colors hover:text-mint"
                          aria-label="Copiar CBU"
                        >
                          {copied === 'cbu' ? <Check size={14} className="text-mint" /> : <Copy size={14} />}
                        </button>
                      </div>
                      <p className="mt-0.5 break-all font-mono text-2xs leading-tight tracking-wide text-white sm:text-xs">
                        {cbu || '—'}
                      </p>
                    </div>

                    <div className="h-px shrink-0 bg-white/10" />

                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-body text-2xs uppercase tracking-[0.16em] text-slate-secondary">
                          Alias
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            void copyField(alias ?? '', 'alias')
                          }}
                          className="toque [--toque:14px] text-slate-secondary transition-colors hover:text-mint"
                          aria-label="Copiar Alias"
                        >
                          {copied === 'alias' ? <Check size={14} className="text-mint" /> : <Copy size={14} />}
                        </button>
                      </div>
                      <p className="mt-0.5 truncate font-body text-sm text-white">
                        {alias || '—'}
                      </p>
                    </div>
                  </div>

                  <p className="shrink-0 font-body text-2xs leading-tight text-slate-secondary/80">
                    Datos para recibir transferencias · MONIX Débito
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Escarcha — cubre rápidamente la tarjeta al congelarla, se retira al descongelar */}
          <AnimatePresence>
            {frozen && (
              <motion.div
                key="frost"
                initial={{ opacity: 0, clipPath: 'circle(0% at 50% 50%)' }}
                animate={{ opacity: 1, clipPath: 'circle(150% at 50% 50%)' }}
                exit={{ opacity: 0, clipPath: 'circle(0% at 50% 50%)' }}
                transition={{ duration: 0.5, ease: EASE_MONIX }}
                className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden z-20"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(200,235,255,0.4) 0%, rgba(130,195,255,0.16) 45%, rgba(255,255,255,0.32) 100%)',
                  backdropFilter: 'blur(1px) saturate(0.65)',
                  WebkitBackdropFilter: 'blur(1px) saturate(0.65)',
                  border: '1px solid rgba(200,235,255,0.55)',
                  boxShadow: 'inset 0 0 46px rgba(150,210,255,0.4)',
                }}
              >
                {/* motas de escarcha */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(circle at 14% 22%, rgba(255,255,255,0.65) 0%, transparent 9%), ' +
                      'radial-gradient(circle at 82% 18%, rgba(255,255,255,0.55) 0%, transparent 7%), ' +
                      'radial-gradient(circle at 72% 78%, rgba(255,255,255,0.6) 0%, transparent 11%), ' +
                      'radial-gradient(circle at 22% 82%, rgba(255,255,255,0.5) 0%, transparent 8%), ' +
                      'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.35) 0%, transparent 14%)',
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
