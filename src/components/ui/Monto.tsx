import type { ReactNode } from 'react'

// Color de los montos según el Manual de Marca (Color · Mint tinta):
// sobre fondo claro el mint no se lee, así que en modo claro van en mint tinta
// (grande: 20 px en negrita o más, 3:1) o mint tinta fuerte (chico, 4,5:1);
// en modo oscuro, mint. Los negativos usan el rojo un tono más oscuro en claro
// (red-600, 4,8:1) por la misma razón: red-500 sobre blanco no llega a 4,5:1.
const COLOR = {
  grande: 'text-mint-tinta dark:text-mint',
  chico: 'text-mint-tinta-fuerte dark:text-mint',
  negativo: 'text-red-600 dark:text-red-400',
}

interface MontoProps {
  tamaño: 'grande' | 'chico'
  negativo?: boolean
  as?: 'span' | 'p'
  className?: string
  children: ReactNode
}

export function Monto({ tamaño, negativo = false, as: Tag = 'span', className = '', children }: MontoProps) {
  return <Tag className={`${negativo ? COLOR.negativo : COLOR[tamaño]} ${className}`.trim()}>{children}</Tag>
}
