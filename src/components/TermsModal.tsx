import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { Button } from './ui/Button'

interface Props {
  tipo: 'terminos' | 'privacidad'
  onClose: () => void
}

const TITULOS = {
  terminos: 'Términos y Condiciones',
  privacidad: 'Política de Privacidad',
}

function TerminosContenido() {
  return (
    <>
      <p><strong className="text-navy dark:text-white">1. Objeto.</strong> Estos términos regulan el uso de la cuenta digital Monix, incluyendo transferencias, tarjetas, préstamos y demás productos ofrecidos dentro de la app.</p>
      <p><strong className="text-navy dark:text-white">2. Tu cuenta.</strong> Sos responsable de mantener segura tu contraseña y tu acceso biométrico. Monix nunca te va a pedir tu contraseña por teléfono, email o mensaje.</p>
      <p><strong className="text-navy dark:text-white">3. Uso de fondos.</strong> Los saldos en tu cuenta pueden generar rendimiento según el producto elegido. Las operaciones (transferencias, pagos, compra/venta de dólares) son irrevocables una vez confirmadas.</p>
      <p><strong className="text-navy dark:text-white">4. Suspensión.</strong> Monix puede suspender preventivamente una cuenta ante actividad sospechosa o incumplimiento de estos términos, notificándolo al titular.</p>
      <p><strong className="text-navy dark:text-white">5. Modificaciones.</strong> Estos términos pueden actualizarse; te vamos a avisar dentro de la app ante cualquier cambio relevante.</p>
    </>
  )
}

function PrivacidadContenido() {
  return (
    <>
      <p><strong className="text-navy dark:text-white">1. Qué datos recolectamos.</strong> Nombre, DNI, fecha de nacimiento, contacto y datos de uso de la app, necesarios para operar tu cuenta y cumplir con la normativa vigente.</p>
      <p><strong className="text-navy dark:text-white">2. Para qué los usamos.</strong> Para prestarte el servicio, prevenir fraude, informar tu situación crediticia a organismos correspondientes y mejorar la experiencia de la app.</p>
      <p><strong className="text-navy dark:text-white">3. Con quién los compartimos.</strong> No vendemos tus datos. Los compartimos únicamente con los organismos regulatorios que correspondan y con proveedores que nos ayudan a operar el servicio, bajo acuerdos de confidencialidad.</p>
      <p><strong className="text-navy dark:text-white">4. Tus derechos.</strong> Podés pedir acceso, corrección o eliminación de tus datos personales escribiéndonos desde la sección de Perfil.</p>
      <p><strong className="text-navy dark:text-white">5. Seguridad.</strong> Tu información sensible viaja cifrada y tu acceso biométrico nunca sale de tu dispositivo.</p>
    </>
  )
}

export function TermsModal({ tipo, onClose }: Props) {
  return (
    <motion.div
      className="fixed inset-0 z-[9990] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-lg max-h-[80vh] bg-white dark:bg-navy-card rounded-2xl shadow-2xl flex flex-col"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ type: 'spring', duration: 0.4, bounce: 0.2 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-white/10 shrink-0">
          <h2 className="font-display text-lg font-semibold text-navy dark:text-white">{TITULOS[tipo]}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-secondary hover:text-navy dark:hover:text-white transition-colors"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto p-5 flex flex-col gap-4 font-body text-sm text-slate-secondary leading-relaxed">
          {tipo === 'terminos' ? <TerminosContenido /> : <PrivacidadContenido />}
        </div>
        <div className="p-5 border-t border-slate-200 dark:border-white/10 shrink-0">
          <Button type="button" onClick={onClose} className="w-full">Entendido</Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
