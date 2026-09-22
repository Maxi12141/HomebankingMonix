import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from './Input'

type Props = Omit<React.ComponentProps<typeof Input>, 'type'>

export function PasswordInput({ className = '', ...props }: Props) {
  const [mostrar, setMostrar] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={mostrar ? 'text' : 'password'} className={`pr-11 ${className}`} />
      <button
        type="button"
        onClick={() => setMostrar((v) => !v)}
        className="absolute right-3 bottom-3 text-slate-secondary hover:text-navy dark:hover:text-white transition-colors"
        aria-label={mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        tabIndex={-1}
      >
        {mostrar ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}
