import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { formatMonto } from '../utils/cuenta'
import { Button } from './ui/Button'
import type { CobroAhora } from '../services/ahora'

function restante(expiresAt: string) {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return '0:00'
  const total = Math.ceil(ms / 1000)
  const min = Math.floor(total / 60)
  const seg = String(total % 60).padStart(2, '0')
  return `${min}:${seg}`
}

function avisar() {
  try {
    navigator.vibrate?.(180)
  } catch {
    /* el teléfono no vibra */
  }
  let ctx: AudioContext
  try {
    ctx = new AudioContext()
  } catch {
    return
  }
  const nota = (freq: number, at: number) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = freq
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + at)
    gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.28)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime + at)
    osc.stop(ctx.currentTime + at + 0.3)
  }
  nota(523, 0)
  nota(659, 0.16)
  window.setTimeout(() => void ctx.close(), 800)
}

interface Props {
  cobro: CobroAhora
  pagando: boolean
  error: string
  onPagar: () => void
  onRechazar: () => void
}

export function AhoraPrompt({ cobro, pagando, error, onPagar, onRechazar }: Props) {
  const [tiempo, setTiempo] = useState(() => restante(cobro.expires_at))
  const nombre = `${cobro.nombre} ${cobro.apellido}`.trim()

  useEffect(() => {
    avisar()
  }, [cobro.id])

  useEffect(() => {
    const tick = window.setInterval(() => setTiempo(restante(cobro.expires_at)), 250)
    return () => window.clearInterval(tick)
  }, [cobro.expires_at])

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[9990] bg-navy/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ahora-titulo"
    >
      <motion.div
        className="w-full max-w-sm rounded-3xl bg-white dark:bg-navy-card border border-slate-200 dark:border-white/10 shadow-2xl p-6"
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', duration: 0.45, bounce: 0.18 }}
      >
        <p className="font-body text-[11px] uppercase tracking-[0.16em] text-slate-secondary">
          Monix Ahora · {tiempo}
        </p>
        <h2 id="ahora-titulo" className="font-display text-2xl font-semibold text-navy dark:text-white mt-2 leading-tight">
          {nombre} te está cobrando
        </h2>
        {cobro.concepto && (
          <p className="font-body text-sm text-slate-secondary mt-1">{cobro.concepto}</p>
        )}
        <p className="font-display text-4xl font-bold text-navy dark:text-mint mt-5">
          {formatMonto(cobro.monto, 'ARS')}
        </p>
        <p className="font-body text-xs text-slate-secondary mt-2">
          Si aceptás, sale de tu caja en pesos en este momento.
        </p>
        {error && (
          <p className="mt-4 font-body text-sm text-red-500 dark:text-red-400">{error}</p>
        )}
        <Button
          type="button"
          className="w-full mt-6"
          loading={pagando}
          loadingLabel="Pagando..."
          onClick={onPagar}
        >
          Pagar
        </Button>
        <button
          type="button"
          disabled={pagando}
          onClick={onRechazar}
          className="w-full mt-2 py-3 font-body text-sm text-slate-secondary hover:text-navy dark:hover:text-white disabled:opacity-40"
        >
          Ahora no
        </button>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
