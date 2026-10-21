import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { animate, motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion'
import { ArcosTarjeta, ChipTarjeta, FONDO_FRENTE, IsologoTarjeta } from './TarjetaPiezas'

// Tarjeta del hero de la Landing, recreada desde motion/tarjeta-hero.aep (comp Tarjeta_Hero).
// Los ángulos de AE pasan a CSS con X e Y invertidos (AE mide Z hacia adentro de la pantalla).
// Z queda en 0: en AE compensaba la cámara descentrada; acá la perspectiva sale del centro de la tarjeta.
const REPOSO = { rx: 12, ry: -26, rz: 0 }
const ENTRADA = { rx: 70, ry: -50, rz: 12, y: 260 }
// Keys de AE: salida con influencia 25 %, llegada con 85 %, velocidad 0 en ambas.
const EASE_ENTRADA: [number, number, number, number] = [0.25, 0, 0.15, 1]
const DURACION_ENTRADA = 1.1


export function TarjetaHero() {
  const reducir = useReducedMotion()
  const raizRef = useRef<HTMLDivElement>(null)
  const [enPantalla, setEnPantalla] = useState(true)

  const rx = useMotionValue(reducir ? REPOSO.rx : ENTRADA.rx)
  const ry = useMotionValue(reducir ? REPOSO.ry : ENTRADA.ry)
  const rz = useMotionValue(reducir ? REPOSO.rz : ENTRADA.rz)
  const y = useMotionValue(reducir ? 0 : ENTRADA.y)
  const opacidad = useMotionValue(reducir ? 1 : 0)
  const reflejo = useMotionValue(-100)

  // Inclinación con el cursor o el dedo, sumada al ángulo de reposo.
  const inclX = useSpring(0, { stiffness: 150, damping: 18, mass: 0.6 })
  const inclY = useSpring(0, { stiffness: 150, damping: 18, mass: 0.6 })
  const rxTotal = useTransform([rx, inclX], ([a, b]: number[]) => a + b)
  const ryTotal = useTransform([ry, inclY], ([a, b]: number[]) => a + b)
  const transform = useMotionTemplate`translateY(${y}px) rotateZ(${rz}deg) rotateY(${ryTotal}deg) rotateX(${rxTotal}deg)`
  const reflejoX = useMotionTemplate`${reflejo}%`

  useEffect(() => {
    if (reducir) return
    const op = { duration: DURACION_ENTRADA, ease: EASE_ENTRADA }
    const controles = [
      animate(rx, REPOSO.rx, op),
      animate(ry, REPOSO.ry, op),
      animate(rz, REPOSO.rz, op),
      animate(y, 0, op),
      animate(opacidad, 1, { duration: 0.3, ease: 'linear' }),
      // El reflejo barre la tarjeta cuando aterriza (0,9 → 2,1 s en AE).
      animate(reflejo, 100, { delay: 0.9, duration: 1.2, ease: 'easeInOut' }),
    ]
    return () => controles.forEach((c) => c.stop())
  }, [reducir, rx, ry, rz, y, opacidad, reflejo])

  useEffect(() => {
    const el = raizRef.current
    if (!el) return
    const io = new IntersectionObserver(([entrada]) => setEnPantalla(entrada.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])

  function mover(e: PointerEvent<HTMLDivElement>) {
    if (reducir) return
    const r = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    inclX.set(py * -16)
    inclY.set(px * 20)
    animate(reflejo, px * 70, { type: 'spring', stiffness: 150, damping: 20 })
  }

  function soltar() {
    inclX.set(0)
    inclY.set(0)
    animate(reflejo, 100, { duration: 0.6, ease: 'easeOut' })
  }

  return (
    <motion.div
      ref={raizRef}
      aria-hidden="true"
      className="relative mx-auto w-full max-w-[340px] select-none py-8 sm:max-w-[420px] lg:max-w-[460px] [touch-action:pan-y]"
      style={{ perspective: 1100, opacity: opacidad }}
      onPointerMove={mover}
      onPointerLeave={soltar}
      onPointerCancel={soltar}
      onPointerUp={(e) => { if (e.pointerType !== 'mouse') soltar() }}
    >
      <div className="tarjeta-sombra pointer-events-none absolute inset-x-[14%] -bottom-6 h-10 rounded-[50%] bg-[radial-gradient(closest-side,rgba(0,26,61,0.22),transparent)] dark:bg-[radial-gradient(closest-side,rgba(0,0,0,0.55),transparent)]" data-en-pantalla={enPantalla} />

      <div className="tarjeta-flota" data-en-pantalla={enPantalla} style={{ transformStyle: 'preserve-3d' }}>
        <motion.div className="relative aspect-[856/540] w-full" style={{ transform, transformStyle: 'preserve-3d' }}>
          {/* Canto: da espesor al inclinarse */}
          <div className="absolute inset-0 rounded-[18px] bg-[#00112A] sm:rounded-[22px]" style={{ transform: 'translateZ(-7px)' }} />

          <div
            className="absolute inset-0 overflow-hidden rounded-[18px] border border-white/[0.12] shadow-[0_20px_50px_-12px_rgba(0,26,61,0.55)] sm:rounded-[22px] [container-type:inline-size]"
            style={{
              background: FONDO_FRENTE.ars,
            }}
          >
            {/* Metal cepillado: líneas horizontales casi invisibles */}
            <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.025)_0_1px,transparent_1px_3px)]" />

            <ArcosTarjeta />

            {/* Reflejo diagonal: barre al aterrizar y sigue al cursor */}
            <motion.div className="pointer-events-none absolute inset-0 mix-blend-screen" style={{ x: reflejoX }}>
              <div className="absolute -inset-y-1/2 inset-x-0 rotate-[24deg] bg-[linear-gradient(90deg,transparent_38%,rgba(255,255,255,0.16)_50%,transparent_62%)]" />
            </motion.div>

            <IsologoTarjeta className="absolute left-[5.6%] top-[9%] h-[17%] w-auto" />

            {/* Chip champaña con contactos */}
            <ChipTarjeta className="absolute right-[6.5%] top-[11%] w-[11.2%]" />

            <div className="absolute inset-x-[6.5%] bottom-[9%] text-white">
              <p className="font-mono text-[clamp(14px,5.2cqw,24px)] tracking-[0.12em]">
                4532&nbsp; 8814&nbsp; 6201&nbsp; 2481
              </p>
              <div className="mt-[4cqw] flex items-end justify-between gap-3">
                <p className="truncate font-body text-[clamp(11px,3.1cqw,14px)] font-semibold uppercase tracking-[0.14em]">
                  Martina Gómez
                </p>
                <p className="font-mono text-[clamp(11px,3.1cqw,14px)] text-white/90">12/29</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
