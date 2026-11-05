import { useId, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card } from './Card'

interface DesplegableProps {
  titulo: string
  resumen?: string
  icono: ReactNode
  children: ReactNode
}

// El contenido cerrado sigue montado: cerrar la tarjeta a mitad de algo (activar el
// 2FA, escribir un formulario) no tiene que perder lo que ya estaba hecho.
export function Desplegable({ titulo, resumen, icono, children }: DesplegableProps) {
  const [abierta, setAbierta] = useState(false)
  const idContenido = useId()

  return (
    <Card>
      <h2>
        <button
          type="button"
          onClick={() => setAbierta((a) => !a)}
          aria-expanded={abierta}
          aria-controls={idContenido}
          className="w-full min-h-11 flex items-center gap-3 p-5 text-left rounded-2xl focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy dark:focus-visible:outline-mint"
        >
          <span className="shrink-0 text-navy dark:text-mint" aria-hidden="true">{icono}</span>
          <span className="flex-1 min-w-0">
            <span className="block font-display text-base font-semibold text-navy dark:text-white">{titulo}</span>
            {resumen && <span className="block font-body text-xs text-slate-secondary mt-0.5 truncate">{resumen}</span>}
          </span>
          <ChevronDown
            size={18}
            aria-hidden="true"
            className={`shrink-0 text-slate-secondary transition-transform ${abierta ? 'rotate-180' : ''}`}
          />
        </button>
      </h2>
      <div id={idContenido} hidden={!abierta} className="px-5 pb-5">
        {children}
      </div>
    </Card>
  )
}
