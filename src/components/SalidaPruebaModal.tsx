import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { salirModoPrueba } from '../lib/modoPrueba'
import { useSalidaPruebaStore } from '../stores/salidaPruebaStore'

export function SalidaPruebaModal() {
  const navigate = useNavigate()
  const abierta = useSalidaPruebaStore((s) => s.abierta)
  const cerrar = useSalidaPruebaStore((s) => s.cerrar)

  if (!abierta) return null

  function registrarse() {
    salirModoPrueba()
    navigate('/register')
  }

  return (
    <motion.div
      className="fixed inset-0 z-[10020] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="salida-prueba-titulo"
    >
      <motion.div
        className="w-full max-w-sm bg-navy-card border border-white/10 rounded-3xl p-8 text-center shadow-2xl"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', duration: 0.45, bounce: 0.2 }}
      >
        <div className="w-16 h-16 rounded-full bg-mint/15 border border-mint/30 flex items-center justify-center mx-auto mb-6">
          <Sparkles size={28} className="text-mint" />
        </div>

        <p className="font-body text-xs uppercase tracking-[0.18em] text-mint mb-3">
          Banco de prueba
        </p>
        <h2 id="salida-prueba-titulo" className="font-display text-2xl font-bold text-white mb-3">
          ¿Aprobaste la prueba?
        </h2>
        <p className="font-body text-base text-white mb-2">
          Si te gustó, no la dejes en un ensayo.
        </p>
        <p className="font-body text-sm text-slate-secondary mb-8 leading-relaxed">
          De la prueba al banco hay un solo paso. Registrate y el bono de bienvenida, esta vez, es de verdad.
        </p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={registrarse}
            className="w-full py-3 rounded-xl bg-mint text-navy font-body font-semibold text-sm hover:bg-mint/90 transition-colors"
          >
            Registrarte
          </button>
          <button
            type="button"
            onClick={cerrar}
            className="w-full py-3 rounded-xl border border-white/20 text-white font-body font-medium text-sm hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
