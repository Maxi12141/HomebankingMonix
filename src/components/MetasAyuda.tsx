import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { HelpCircle, PiggyBank, TrendingUp, Users, Vote } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { useAuthStore } from '../store/authStore'

const PASOS = [
  {
    icon: Users,
    titulo: 'Armá la meta o sumate',
    texto: 'Creás una meta y compartís el código, o entrás con el código que te pasaron.',
  },
  {
    icon: PiggyBank,
    titulo: 'Cada uno aporta',
    texto: 'Metés plata desde tu cuenta en pesos. Todos ven quién puso cuánto.',
  },
  {
    icon: TrendingUp,
    titulo: 'La plata rinde',
    texto: 'Mientras está juntada, rinde la misma TNA que Reservas.',
  },
  {
    icon: Vote,
    titulo: 'Sale sólo con mayoría',
    texto:
      'Para usarla, alguien propone pagar a una cuenta Monix o devolver lo juntado, y la mayoría tiene que aprobarlo. Si se devuelve, cada uno recibe según lo que puso, más el interés.',
  },
]

// Por usuario: en un celular compartido, cada uno ve la explicación su
// primera vez. Si el storage no está disponible (modo privado), se muestra
// igual y no pasa nada.
function claveVista(userId: string) {
  return `monix:metas-ayuda-vista:${userId}`
}

function yaLaVio(userId: string) {
  try {
    return localStorage.getItem(claveVista(userId)) === '1'
  } catch {
    return false
  }
}

function marcarVista(userId: string) {
  try {
    localStorage.setItem(claveVista(userId), '1')
  } catch {
    // sin storage: la próxima vez se vuelve a mostrar sola
  }
}

/**
 * Botón "?" con la explicación de Metas comunes. La primera vez que el
 * usuario entra se abre sola; después vive en el botón. Al cerrarla esa
 * primera vez, el "?" late un par de veces para mostrar dónde quedó.
 */
export function MetasAyuda() {
  const userId = useAuthStore((s) => s.user?.id)
  const [abierta, setAbierta] = useState(false)
  const [primeraVez, setPrimeraVez] = useState(false)
  const [senalar, setSenalar] = useState(false)

  useEffect(() => {
    if (!userId || yaLaVio(userId)) return
    setPrimeraVez(true)
    // Un instante después de entrar, para que se note que se abre.
    const t = window.setTimeout(() => setAbierta(true), 350)
    return () => window.clearTimeout(t)
  }, [userId])

  function cerrar() {
    setAbierta(false)
    if (primeraVez && userId) {
      marcarVista(userId)
      setPrimeraVez(false)
      setSenalar(true)
    }
  }

  return (
    <>
      <motion.button
        type="button"
        onClick={() => { setSenalar(false); setAbierta(true) }}
        aria-label="Cómo funcionan las metas comunes"
        title="Cómo funcionan"
        className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-secondary hover:text-mint hover:bg-mint/10 transition-colors"
        animate={senalar ? { scale: [1, 1.25, 1, 1.25, 1] } : { scale: 1 }}
        transition={{ duration: 1.4, ease: 'easeInOut' }}
        onAnimationComplete={() => setSenalar(false)}
      >
        {senalar && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full border-2 border-mint"
            initial={{ opacity: 0.8, scale: 1 }}
            animate={{ opacity: 0, scale: 1.8 }}
            transition={{ duration: 0.7, repeat: 1, ease: 'easeOut' }}
          />
        )}
        <HelpCircle size={20} className={senalar ? 'text-mint' : undefined} />
      </motion.button>

      <Modal open={abierta} onClose={cerrar}>
        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold text-navy dark:text-white">
            Cómo funcionan las metas comunes
          </h2>
          <p className="font-body text-sm text-slate-secondary mt-1">
            Juntan para un viaje, un regalo o el alquiler.
          </p>
          <ol className="mt-5 flex flex-col gap-4">
            {PASOS.map(({ icon: Icon, titulo, texto }, i) => (
              <motion.li
                key={titulo}
                className="flex gap-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.12, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint/15 text-mint">
                  <Icon size={18} />
                </span>
                <span>
                  <span className="block font-body text-sm font-semibold text-navy dark:text-white">{titulo}</span>
                  <span className="block font-body text-sm text-slate-secondary mt-0.5">{texto}</span>
                </span>
              </motion.li>
            ))}
          </ol>
          <Button type="button" className="w-full mt-6" onClick={cerrar}>
            Entendido
          </Button>
        </Card>
      </Modal>
    </>
  )
}
