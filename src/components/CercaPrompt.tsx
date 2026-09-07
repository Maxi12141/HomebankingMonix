import { Bluetooth, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import type { PersonaCerca } from '../services/cerca'

interface Props {
  persona: PersonaCerca
  onTransferir: () => void
  onDismiss: () => void
}

export function CercaPrompt({ persona, onTransferir, onDismiss }: Props) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        aria-label="Cerrar"
        onClick={onDismiss}
      />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        <Card className="p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-mint/20 text-mint flex items-center justify-center">
                <Bluetooth size={20} />
              </div>
              <div>
                <p className="font-body text-xs uppercase tracking-wider text-slate-secondary">Monix Cerca</p>
                <h2 className="font-display text-lg font-semibold text-navy dark:text-white">
                  ¿Transferirle?
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onDismiss}
              className="text-slate-secondary hover:text-navy dark:hover:text-white"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
          <p className="font-body text-sm text-navy dark:text-white mb-1">
            {persona.nombre} {persona.apellido}
          </p>
          <p className="font-body text-xs text-slate-secondary mb-5">
            {persona.alias ? `@${persona.alias}` : 'Alias no disponible'} · identificado al acercar el celular
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" type="button" onClick={onDismiss}>
              Ahora no
            </Button>
            <Button className="flex-1" type="button" onClick={onTransferir}>
              Transferir
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
