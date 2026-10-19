// Movimiento de la marca (Manual de Marca · Movimiento): suave y rápido.
// La misma curva vive en Tailwind como ease-[cubic-bezier(0.22,1,0.36,1)].
export const EASE_MONIX: [number, number, number, number] = [0.22, 1, 0.36, 1]

export const DURACION = {
  /** Card de saldo que se desliza entre pesos y dólares. */
  swipe: 0.22,
  /** Montos que "cuentan" hasta el valor final. */
  contar: 1.1,
} as const
