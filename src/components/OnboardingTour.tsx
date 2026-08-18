import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

export interface TourStep {
  targetId: string
  title: string
  description: string
}

interface Props {
  steps: TourStep[]
  onComplete: () => void
}

interface Pos {
  spot: { left: number; top: number; width: number; height: number }
  tip: { left: number; top: number }
}

const PAD = 10
const TIP_W = 300
// Estimación inicial nomás — la altura real (variable según el largo del texto de cada paso)
// se mide con tipRef y corrige la posición en el layout effect de abajo.
const TIP_H_ESTIMATE = 190

export function OnboardingTour({ steps, onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [pos, setPos] = useState<Pos | null>(null)
  const stepRef = useRef(0)
  const tipRef = useRef<HTMLDivElement>(null)

  // Keep stepRef in sync so the resize handler always has the latest step
  useEffect(() => { stepRef.current = step }, [step])

  // Bloquea todo el scroll (rueda del mouse, trackpad, touch) mientras el tour está activo.
  // El spotlight y el tooltip se posicionan a partir de un rect medido una vez por paso,
  // así que cualquier scroll — del usuario o "chained" hacia un ancestro scrolleable — desincroniza
  // el encuadre. overflow:hidden en <main> no alcanza a cubrir todos los casos, así que además
  // se frena el evento a nivel window con preventDefault.
  useEffect(() => {
    const main = document.querySelector('main')
    const prevMainOverflow = main instanceof HTMLElement ? main.style.overflow : ''
    if (main instanceof HTMLElement) main.style.overflow = 'hidden'

    const prevBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function blockScroll(e: Event) {
      e.preventDefault()
    }

    window.addEventListener('wheel', blockScroll, { passive: false })
    window.addEventListener('touchmove', blockScroll, { passive: false })

    return () => {
      if (main instanceof HTMLElement) main.style.overflow = prevMainOverflow
      document.body.style.overflow = prevBodyOverflow
      window.removeEventListener('wheel', blockScroll)
      window.removeEventListener('touchmove', blockScroll)
    }
  }, [])

  const measure = useCallback((stepIdx: number) => {
    const el = document.getElementById(steps[stepIdx].targetId)
    if (!el) return

    // 'center' (not 'nearest') guarantees maximum breathing room on both sides — with
    // 'nearest', an element already partially in view barely moves, leaving no room for
    // the tooltip and forcing it to overlap the very element it's pointing at.
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })

    setTimeout(() => {
      const r = el.getBoundingClientRect()

      const spotL = r.left - PAD
      const spotT = r.top - PAD
      const spotW = r.width + PAD * 2
      const spotH = r.height + PAD * 2

      // Place tooltip below or above — never overlapping the spotlight.
      // TIP_H_ESTIMATE es solo un punto de partida; el layout effect de abajo la corrige
      // con la altura real una vez que el tooltip está en el DOM.
      const isLower = r.top + r.height / 2 > window.innerHeight * 0.58
      const tipL = Math.max(16, Math.min(spotL, window.innerWidth - TIP_W - 16))
      const tipT = isLower
        ? Math.max(16, spotT - TIP_H_ESTIMATE - 8)
        : Math.min(spotT + spotH + 8, window.innerHeight - TIP_H_ESTIMATE - 16)

      setPos({ spot: { left: spotL, top: spotT, width: spotW, height: spotH }, tip: { left: tipL, top: tipT } })
    }, 360)
  }, [steps])

  // Initial measurement
  useEffect(() => { measure(0) }, [measure])

  // Corrige tip.top con la altura REAL del tooltip renderizado (varía según el largo del texto
  // de cada paso) para que nunca se superponga con el spotlight, ni de más ni de menos.
  useLayoutEffect(() => {
    if (!pos || !tipRef.current) return
    const tipH = tipRef.current.offsetHeight
    if (tipH === 0) return

    const { spot } = pos
    const isLower = spot.top + spot.height / 2 > window.innerHeight * 0.58
    const correctedTipT = isLower
      ? Math.max(16, spot.top - tipH - 8)
      : Math.min(spot.top + spot.height + 8, window.innerHeight - tipH - 16)

    if (Math.abs(correctedTipT - pos.tip.top) > 1) {
      setPos((p) => (p ? { ...p, tip: { ...p.tip, top: correctedTipT } } : p))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pos?.spot.top, pos?.spot.height])

  // Resize: re-measure current step
  useEffect(() => {
    const handler = () => measure(stepRef.current)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [measure])

  function goNext() {
    if (step < steps.length - 1) {
      setStep(s => {
        const next = s + 1
        measure(next)
        return next
      })
    } else {
      onComplete()
    }
  }

  if (!pos) return null

  return (
    <motion.div
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9997 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Click blocker — captures all clicks outside tooltip */}
      <div
        style={{ position: 'fixed', inset: 0, pointerEvents: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Spotlight — single element, animates between positions */}
      <motion.div
        animate={pos.spot}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        style={{
          position: 'fixed',
          borderRadius: 14,
          boxShadow: '0 0 0 9999px rgba(0, 10, 30, 0.82)',
          border: '2px solid rgba(38, 255, 193, 0.38)',
          pointerEvents: 'none',
        }}
      />

      {/* Tooltip — single element, animates to new position alongside spotlight */}
      <motion.div
        ref={tipRef}
        animate={{ left: pos.tip.left, top: pos.tip.top }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        style={{ position: 'fixed', width: TIP_W, pointerEvents: 'auto' }}
        className="bg-navy-card border border-white/10 rounded-2xl p-5 shadow-2xl"
      >
        {/* Progress indicators + close */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? 'w-6 bg-mint' : i < step ? 'w-2 bg-mint/35' : 'w-2 bg-white/15'
                }`}
              />
            ))}
          </div>
          <button
            onClick={onComplete}
            className="text-slate-secondary hover:text-white transition-colors ml-2 shrink-0"
          >
            <X size={14} />
          </button>
        </div>

        {/* Step content fades in/out independently from the moving container */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.16 }}
          >
            <h3 className="font-display text-base font-semibold text-white mb-1.5">
              {steps[step].title}
            </h3>
            <p className="font-body text-sm text-slate-secondary mb-4 leading-relaxed">
              {steps[step].description}
            </p>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between">
          <button
            onClick={onComplete}
            className="font-body text-xs text-slate-secondary hover:text-white/70 transition-colors"
          >
            Omitir
          </button>
          <button
            onClick={goNext}
            className="font-body text-sm font-medium bg-mint text-navy px-4 py-1.5 rounded-xl hover:bg-mint/90 transition-colors"
          >
            {step < steps.length - 1 ? 'Siguiente →' : '¡Listo!'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
