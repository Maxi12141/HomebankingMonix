import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export interface TourStep {
  targetId: string
  title: string
  description: string
  openDrawer?: boolean
}

interface Props {
  steps: TourStep[]
  onComplete: () => void
}

interface Pos {
  spot: { left: number; top: number; width: number; height: number }
  tip: { left: number; top: number; width: number }
}

const PAD = 10
const TIP_H_ESTIMATE = 210

function tipWidth() {
  return Math.min(300, Math.max(240, window.innerWidth - 32))
}

function setDrawer(open: boolean) {
  window.dispatchEvent(new CustomEvent('monix-tour-drawer', { detail: { open } }))
}

export function OnboardingTour({ steps, onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [pos, setPos] = useState<Pos | null>(null)
  const stepRef = useRef(0)
  const tipRef = useRef<HTMLDivElement>(null)

  useEffect(() => { stepRef.current = step }, [step])

  useEffect(() => {
    function blockScroll(e: Event) {
      e.preventDefault()
    }
    window.addEventListener('wheel', blockScroll, { passive: false })
    window.addEventListener('touchmove', blockScroll, { passive: false })
    return () => {
      window.removeEventListener('wheel', blockScroll)
      window.removeEventListener('touchmove', blockScroll)
      setDrawer(false)
    }
  }, [])

  const measure = useCallback((stepIdx: number) => {
    const current = steps[stepIdx]
    if (!current) return
    setDrawer(Boolean(current.openDrawer))

    const wait = current.openDrawer ? 420 : 40
    window.setTimeout(() => {
      const candidates = [
        document.getElementById(current.targetId),
        document.getElementById(`${current.targetId}-mobile`),
      ]
      const el = candidates.find((node) => {
        if (!node) return false
        const r = node.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      }) ?? candidates[0]
      if (!el) return

      const fixed = el.closest('nav, header, [data-tour-fixed]')
      if (!fixed) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
      }

      window.setTimeout(() => {
        const r = el.getBoundingClientRect()
        const tw = tipWidth()
        const spotL = r.left - PAD
        const spotT = r.top - PAD
        const spotW = r.width + PAD * 2
        const spotH = r.height + PAD * 2
        const isLower = r.top + r.height / 2 > window.innerHeight * 0.55
        const tipL = Math.max(16, Math.min(spotL, window.innerWidth - tw - 16))
        const tipT = isLower
          ? Math.max(16, spotT - TIP_H_ESTIMATE - 8)
          : Math.min(spotT + spotH + 8, window.innerHeight - TIP_H_ESTIMATE - 16)

        setPos({
          spot: { left: spotL, top: spotT, width: spotW, height: spotH },
          tip: { left: tipL, top: tipT, width: tw },
        })
      }, fixed ? 80 : 480)
    }, wait)
  }, [steps])

  useEffect(() => { measure(0) }, [measure])

  useLayoutEffect(() => {
    if (!pos || !tipRef.current) return
    const tipH = tipRef.current.offsetHeight
    if (tipH === 0) return

    const { spot } = pos
    const isLower = spot.top + spot.height / 2 > window.innerHeight * 0.55
    const correctedTipT = isLower
      ? Math.max(16, spot.top - tipH - 8)
      : Math.min(spot.top + spot.height + 8, window.innerHeight - tipH - 16)

    if (Math.abs(correctedTipT - pos.tip.top) > 1) {
      setPos((p) => (p ? { ...p, tip: { ...p.tip, top: correctedTipT } } : p))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pos?.spot.top, pos?.spot.height])

  useEffect(() => {
    const handler = () => measure(stepRef.current)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [measure])

  function goTo(next: number) {
    setStep(next)
    measure(next)
  }

  function goNext() {
    if (step < steps.length - 1) goTo(step + 1)
    else onComplete()
  }

  function goBack() {
    if (step > 0) goTo(step - 1)
  }

  if (!pos) {
    return (
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9997, background: 'rgba(0, 10, 30, 0.82)' }}
      />
    )
  }

  return (
    <motion.div
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9997 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div
        style={{ position: 'fixed', inset: 0, pointerEvents: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      />

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

      <motion.div
        ref={tipRef}
        animate={{ left: pos.tip.left, top: pos.tip.top, width: pos.tip.width }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        style={{ position: 'fixed', pointerEvents: 'auto' }}
        className="bg-navy-card border border-white/10 rounded-2xl p-5 shadow-2xl"
      >
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
          <span className="font-body text-[11px] text-white/40 tabular-nums">
            {step + 1}/{steps.length}
          </span>
        </div>

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

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onComplete}
            className="font-body text-xs text-slate-secondary hover:text-white/70 transition-colors"
          >
            Omitir
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="font-body text-sm font-medium border border-white/15 text-white px-3 py-1.5 rounded-xl hover:bg-white/5 transition-colors"
              >
                ← Atrás
              </button>
            )}
            <button
              type="button"
              onClick={goNext}
              className="font-body text-sm font-medium bg-mint text-navy px-4 py-1.5 rounded-xl hover:bg-mint/90 transition-colors"
            >
              {step < steps.length - 1 ? 'Siguiente' : '¡Listo!'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
