import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { Check, Copy, RotateCcw } from 'lucide-react'

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

const faceBaseStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: 16,
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
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-display text-sm font-semibold text-navy dark:text-white">
            Tu tarjeta débito
          </p>
          <p className="font-body text-xs text-slate-secondary mt-0.5">
            Mové el cursor para inclinarla · tocá para ver el dorso
          </p>
        </div>
        <button
          type="button"
          onClick={toggleFlip}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-body font-medium text-navy dark:text-white bg-slate-input dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-mint/40 transition-colors"
        >
          <RotateCcw size={13} />
          {flipped ? 'Frente' : 'Dorso'}
        </button>
      </div>

      <div
        ref={containerRef}
        className="relative w-full max-w-md mx-auto"
        style={{ perspective: 1400 }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {/* Tilt layer */}
        <motion.div
          style={{
            rotateX,
            rotateY: tiltY,
            transformStyle: 'preserve-3d',
          }}
          animate={{ scale: frozen ? [1, 0.96, 1] : 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full aspect-[1.586/1]"
        >
          {/* Flip layer */}
          <motion.div
            role="button"
            tabIndex={0}
            aria-label={flipped ? 'Ver frente de la tarjeta' : 'Ver dorso de la tarjeta'}
            onClick={toggleFlip}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                toggleFlip()
              }
            }}
            initial={false}
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full h-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-mint/50 rounded-2xl"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* FRONT */}
            <div
              style={{
                ...faceBaseStyle,
                background:
                  'radial-gradient(120% 90% at 10% 0%, rgba(38,255,193,0.22) 0%, transparent 45%), linear-gradient(145deg, #0D2B52 0%, #001A3D 55%, #00112A 100%)',
                boxShadow: '0 20px 50px -12px rgba(0,26,61,0.55)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <motion.div
                className="pointer-events-none absolute inset-0 opacity-60 mix-blend-soft-light rounded-2xl"
                style={{ background: glareBackground }}
              />
              <div className="absolute -right-10 -top-16 h-40 w-40 rounded-full bg-mint/15 blur-2xl pointer-events-none" />
              <div className="absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-white/5 blur-2xl pointer-events-none" />

              <div className="relative z-10 flex h-full flex-col justify-between p-5 sm:p-6 text-left">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-display text-lg font-bold tracking-[0.18em] text-white">
                      MONIX
                    </p>
                    <p className="font-body text-[10px] uppercase tracking-[0.22em] text-mint/90 mt-0.5">
                      Débito · {tipoLabel}{moneda === 'USD' ? ' · USD' : ''}
                    </p>
                  </div>
                  <div
                    className={`h-8 w-11 rounded-md shadow-inner relative overflow-hidden ${
                      moneda === 'USD'
                        ? 'bg-gradient-to-br from-[#dfe4ea] via-[#f4f6f8] to-[#b7bdc6]'
                        : 'bg-gradient-to-br from-[#f0c040] via-[#f8de80] to-[#c8980a]'
                    }`}
                  >
                    <div className={`absolute inset-x-0 top-[30%] h-px ${moneda === 'USD' ? 'bg-[#6b7280]/55' : 'bg-[#8B6914]/55'}`} />
                    <div className={`absolute inset-x-0 top-[55%] h-px ${moneda === 'USD' ? 'bg-[#6b7280]/55' : 'bg-[#8B6914]/55'}`} />
                    <div className={`absolute inset-y-0 left-[40%] w-px ${moneda === 'USD' ? 'bg-[#6b7280]/55' : 'bg-[#8B6914]/55'}`} />
                  </div>
                </div>

                <div>
                  <p className="font-mono text-base sm:text-lg tracking-[0.18em] text-white/95">
                    {pan}
                  </p>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-body text-[9px] uppercase tracking-[0.18em] text-slate-secondary">
                        Titular
                      </p>
                      <p className="font-display text-sm font-semibold text-white truncate">
                        {nombre}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-body text-[9px] uppercase tracking-[0.18em] text-slate-secondary">
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
                background: 'linear-gradient(160deg, #001A3D 0%, #0D2B52 50%, #00112A 100%)',
                boxShadow: '0 20px 50px -12px rgba(0,26,61,0.55)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <div className="mt-5 h-11 w-full bg-black/70" />
              <div className="px-5 sm:px-6 pt-4 space-y-3 text-left">
                <div className="rounded-md bg-white/90 px-3 py-2 flex items-center justify-between">
                  <span className="font-body text-[10px] text-navy/50 uppercase tracking-wider">CVV</span>
                  <span className="font-mono text-sm text-navy tracking-widest">
                    {showSensitive ? cvv : '•••'}
                  </span>
                </div>

                <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-body text-[10px] uppercase tracking-[0.16em] text-slate-secondary">
                        CBU
                      </p>
                      <p className="font-mono text-[11px] sm:text-xs text-white break-all mt-0.5">
                        {cbu || '—'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        copyField(cbu ?? '', 'cbu')
                      }}
                      className="shrink-0 text-slate-secondary hover:text-mint transition-colors"
                      aria-label="Copiar CBU"
                    >
                      {copied === 'cbu' ? <Check size={14} className="text-mint" /> : <Copy size={14} />}
                    </button>
                  </div>

                  <div className="h-px bg-white/10" />

                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-body text-[10px] uppercase tracking-[0.16em] text-slate-secondary">
                        Alias
                      </p>
                      <p className="font-body text-sm text-white truncate mt-0.5">
                        {alias || '—'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        copyField(alias ?? '', 'alias')
                      }}
                      className="shrink-0 text-slate-secondary hover:text-mint transition-colors"
                      aria-label="Copiar Alias"
                    >
                      {copied === 'alias' ? <Check size={14} className="text-mint" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <p className="font-body text-[10px] text-slate-secondary/80">
                  Datos para recibir transferencias · MONIX Débito
                </p>
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
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
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
