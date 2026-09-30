interface Props {
  password: string
}

function calcularFuerza(password: string): 1 | 2 | 3 {
  // No se puntúa el mínimo de 6 caracteres en sí (eso ya lo exige el campo,
  // no es una señal de fuerza) — sólo variedad y longitud por encima de eso.
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  if (score <= 1) return 1
  if (score <= 3) return 2
  return 3
}

const NIVELES = {
  1: { label: 'Débil', color: 'bg-red-400', segmentos: 1 },
  2: { label: 'Media', color: 'bg-amber-400', segmentos: 2 },
  3: { label: 'Fuerte', color: 'bg-mint', segmentos: 3 },
} as const

export function PasswordStrengthMeter({ password }: Props) {
  if (!password) return null
  const fuerza = calcularFuerza(password)
  const nivel = NIVELES[fuerza]

  return (
    <div className="flex items-center gap-2 -mt-1">
      <div className="flex gap-1 flex-1">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i <= nivel.segmentos ? nivel.color : 'bg-slate-200 dark:bg-white/10'
            }`}
          />
        ))}
      </div>
      <span className="font-body text-xs text-slate-secondary shrink-0">{nivel.label}</span>
    </div>
  )
}
