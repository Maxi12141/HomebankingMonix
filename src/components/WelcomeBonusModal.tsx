import { motion } from 'framer-motion'
import CountUp from 'react-countup'
import { Gift } from 'lucide-react'
import { BONO_BIENVENIDA } from '../lib/onboarding'

interface Props {
  onClose: () => void
}

export function WelcomeBonusModal({ onClose }: Props) {
  return (
    <motion.div
      className="fixed inset-0 z-[9990] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      <motion.div
        className="w-full max-w-sm bg-navy-card border border-white/10 rounded-3xl p-8 text-center shadow-2xl"
        initial={{ opacity: 0, scale: 0.88, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 16 }}
        transition={{ type: 'spring', duration: 0.5, bounce: 0.22 }}
      >
        <div className="w-16 h-16 rounded-full bg-mint/15 border border-mint/30 flex items-center justify-center mx-auto mb-6">
          <Gift size={28} className="text-mint" />
        </div>

        <h2 className="font-display text-xl font-bold text-white mb-2">
          ¡Bienvenido/a a Monix!
        </h2>
        <p className="font-body text-sm text-slate-secondary mb-6">
          Por abrir tu cuenta te acreditamos un cupo de bienvenida
        </p>

        <div className="bg-mint/10 border border-mint/20 rounded-2xl py-5 px-6 mb-6">
          <p className="font-display text-4xl font-bold text-mint mb-1">
            <CountUp
              end={BONO_BIENVENIDA}
              duration={1.6}
              separator="."
              prefix="$ "
              useEasing
            />
          </p>
          <p className="font-body text-xs text-mint/70 uppercase tracking-wider">
            Ya está en tu cuenta
          </p>
        </div>

        <p className="font-body text-xs text-slate-secondary mb-6 leading-relaxed">
          Podés transferirlo, pagarlo o dejarlo rendir. En el próximo paso te mostramos lo esencial de la app.
        </p>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-mint text-navy font-body font-semibold text-sm hover:bg-mint/90 transition-colors"
        >
          Ver cómo funciona
        </button>
      </motion.div>
    </motion.div>
  )
}
