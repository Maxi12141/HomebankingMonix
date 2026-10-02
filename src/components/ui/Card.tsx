import type { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'dark' | 'light' | 'noche'
}

export function Card({ variant = 'default', className = '', children, ...props }: CardProps) {
  const variants = {
    default: 'bg-white dark:bg-navy-card border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none',
    dark: 'bg-navy-card border border-white/10',
    light: 'bg-white border border-slate-200 shadow-sm',
    // Azul noche también en modo claro (como la card de saldo del Dashboard).
    // La clase `dark` hace que todo lo de adentro use sus colores de modo
    // oscuro (montos en mint, textos claros); en modo oscuro se ve igual que
    // la card por defecto.
    noche: 'dark bg-navy dark:bg-navy-card text-white border border-white/10',
  }

  const interactive =
    className.includes('cursor-pointer') ||
    typeof props.onClick === 'function'

  return (
    <div
      className={`rounded-2xl transition-[transform,box-shadow,border-color,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${variants[variant]} ${
        interactive
          ? 'hover:-translate-y-1 hover:shadow-lg hover:shadow-navy/10 dark:hover:shadow-black/30 hover:border-mint/30'
          : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
