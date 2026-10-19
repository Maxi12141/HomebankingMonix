import { Check } from 'lucide-react'

// Check de "operación lista". El mint va sobre azul noche (13,3:1): suelto
// sobre la card blanca era 1,3:1 y casi no se veía (Manual de Marca · Contraste).
export function IconoExito({ className = '' }: { className?: string }) {
  return (
    <span
      className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-navy dark:bg-mint/15 ${className}`}
      aria-hidden="true"
    >
      <Check size={34} strokeWidth={2.4} className="text-mint" />
    </span>
  )
}
