import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { animate, motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion'

// Tarjeta del hero de la Landing, recreada desde motion/tarjeta-hero.aep (comp Tarjeta_Hero).
// Los ángulos de AE pasan a CSS con X e Y invertidos (AE mide Z hacia adentro de la pantalla).
// Z queda en 0: en AE compensaba la cámara descentrada; acá la perspectiva sale del centro de la tarjeta.
const REPOSO = { rx: 12, ry: -26, rz: 0 }
const ENTRADA = { rx: 70, ry: -50, rz: 12, y: 260 }
// Keys de AE: salida con influencia 25 %, llegada con 85 %, velocidad 0 en ambas.
const EASE_ENTRADA: [number, number, number, number] = [0.25, 0, 0.15, 1]
const DURACION_ENTRADA = 1.1

// Arcos del patrón: la curva del isologo repetida 19 veces (Repetidor de AE: +26, +10 por copia).
const ARCO = 'M300 600 C340 340 570 100 900 70'
const ARCOS = Array.from({ length: 19 }, (_, i) => `translate(${-208 + i * 26} ${-80 + i * 10})`)

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
              background:
                'radial-gradient(120% 90% at 10% 0%, rgba(38,255,193,0.22) 0%, transparent 45%), linear-gradient(145deg, #0D2B52 0%, #001A3D 55%, #00112A 100%)',
            }}
          >
            {/* Metal cepillado: líneas horizontales casi invisibles */}
            <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.025)_0_1px,transparent_1px_3px)]" />

            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 856 540" fill="none">
              <g stroke="#C7D4E3" strokeWidth="2" opacity="0.22">
                {ARCOS.map((t) => <path key={t} d={ARCO} transform={t} />)}
              </g>
            </svg>

            {/* Reflejo diagonal: barre al aterrizar y sigue al cursor */}
            <motion.div className="pointer-events-none absolute inset-0 mix-blend-screen" style={{ x: reflejoX }}>
              <div className="absolute -inset-y-1/2 inset-x-0 rotate-[24deg] bg-[linear-gradient(90deg,transparent_38%,rgba(255,255,255,0.16)_50%,transparent_62%)]" />
            </motion.div>

            <div className="absolute left-[5.6%] top-[9%] h-[17%]">
              <svg className="h-full w-auto" viewBox="86 118 277 229">
                <g transform="translate(-495.89835,-110.66689)">
                  <path fill="#fff" d="m 788.49185,272.67634 c 19.64504,-7.66208 38.71358,-12.39442 59.25647,-14.70601 l 10.73329,-1.20776 V 243.4587 c 0,-7.31713 -0.3375,-13.50505 -0.75,-13.75093 -0.4125,-0.24587 -10.47806,-0.15993 -22.36792,0.19099 l -21.61791,0.63803 -24.38209,25.83493 c -13.41014,14.20921 -24.51912,26.20783 -24.68661,26.66358 -0.16749,0.45576 2.53712,-0.68027 6.01024,-2.5245 3.47312,-1.84424 11.48516,-5.36974 17.80453,-7.83446 z" />
                  <path fill="#fff" d="m 858.48161,375.92838 v -81.10841 l -2.75,0.67807 c -5.33249,1.31484 -23.86314,9.62407 -33.25,14.90945 l -9.5,5.34909 -0.25671,70.6401 -0.25671,70.64011 h 23.00671 23.00671 z" />
                  <path fill="#fff" d="m 628.72507,384.59614 0.25653,-72.44065 21.42233,34.94065 c 11.78229,19.21736 21.68229,34.90713 22.00001,34.86617 0.31772,-0.041 2.79007,-4.58204 5.49412,-10.09127 2.70405,-5.50923 8.22223,-14.97592 12.26261,-21.03708 l 7.34616,-11.02029 -2.2128,-3.63844 c -2.11516,-3.47789 -24.98579,-40.38015 -44.08894,-71.13844 -4.95306,-7.975 -11.50436,-18.55 -14.55844,-23.5 -8.57971,-13.90582 -6.8229,-10.19922 -20.45936,-11.55273 -6.30289,-0.6256 -15.38524,0.0284 -21.57275,0.0366 l -12.13294,0.0161 v 113.5 113.5 h 22.99347 22.99347 z" />
                  <path fill="#26ffc1" d="m 667.1758,455.54219 c -1.00426,-1.62493 2.7604,-21.84304 6.83198,-36.69119 12.78486,-46.62357 40.9305,-86.49175 79.43967,-112.52596 23.2938,-15.74782 46.88715,-25.53155 76.51911,-31.73107 7.34556,-1.53681 24.68546,-4.40896 26.63545,-4.41185 0.89334,-10e-4 1.0289,0.60413 1.02109,4.56036 -0.005,2.50903 -0.20991,4.87785 -0.45545,5.26405 -0.24553,0.3862 -3.88362,2.00838 -8.08463,3.60486 -20.81186,7.90893 -37.68137,17.1167 -54.11329,29.53626 -42.94015,32.45502 -68.55285,79.60426 -72.82654,134.06305 l -0.70444,8.97659 h -26.93213 c -18.8916,0 -27.05115,-0.19259 -27.33082,-0.6451 z" />
                </g>
              </svg>
            </div>

            {/* Chip champaña con contactos */}
            <svg className="absolute right-[6.5%] top-[11%] w-[11.2%]" viewBox="0 0 96 72">
              <rect x="1" y="1" width="94" height="70" rx="11" fill="#D6BA80" stroke="#8C6E33" strokeWidth="2" />
              <g stroke="#8C6E33" strokeWidth="1.8" fill="none">
                <rect x="34" y="24" width="28" height="24" rx="6" />
                <path d="M2 24h32M2 48h32M62 24h32M62 48h32M2 36h32M62 36h32M48 2v22M48 48v22" />
              </g>
            </svg>

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
