import { useNavigate } from 'react-router-dom'
import { salirModoPrueba } from '../lib/modoPrueba'
import { Button } from './ui/Button'

/** Cartel de la prueba: la herramienta se ve, pero para usarla hay que registrarse. */
export function CartelRegistroPrueba() {
  const navigate = useNavigate()

  function registrarse() {
    salirModoPrueba()
    navigate('/register')
  }

  return (
    <div className="w-full max-w-sm rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-card p-6 text-center shadow-xl">
      <p className="font-body text-xs font-semibold uppercase tracking-[0.16em] text-mint mb-3">
        Banco de prueba
      </p>
      <h2 className="font-display text-xl font-bold text-navy dark:text-white leading-snug">
        ¿Te interesa cómo funciona esta herramienta?
      </h2>
      <p className="font-body text-sm text-slate-secondary mt-3 mb-6 leading-relaxed">
        Registrate en la app y usala con tu cuenta.
      </p>
      <Button type="button" onClick={registrarse} className="w-full min-h-11">
        Registrate
      </Button>
    </div>
  )
}
