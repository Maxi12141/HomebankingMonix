import type { HTMLAttributes, KeyboardEvent } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'dark' | 'light'
}

export function Card({ variant = 'default', className = '', children, onClick, onKeyDown, ...props }: CardProps) {
  const variants = {
    default: 'bg-white dark:bg-navy-card border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none',
    dark: 'bg-navy-card border border-white/10',
    light: 'bg-white border border-slate-200 shadow-sm',
  }

  // Con onClick la card es un botón: se llega con Tab y se activa con Enter o Espacio.
  const interactive = typeof onClick === 'function'

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(e)
    if (e.defaultPrevented || e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.currentTarget.click()
    }
  }

  return (
    <div
      className={`rounded-2xl transition-[transform,box-shadow,border-color,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${variants[variant]} ${
        interactive
          ? 'cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:shadow-navy/10 dark:hover:shadow-black/30 hover:border-mint/30 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy dark:focus-visible:outline-mint'
          : ''
      } ${className}`}
      onClick={onClick}
      {...(interactive ? { role: 'button', tabIndex: 0, onKeyDown: handleKeyDown } : { onKeyDown })}
      {...props}
    >
      {children}
    </div>
  )
}
