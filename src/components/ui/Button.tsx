import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'secondary-light' | 'ghost'
  loading?: boolean
}

export function Button({ variant = 'primary', loading, children, className = '', disabled, ...props }: ButtonProps) {
  const base = 'rounded-xl font-body font-medium px-5 py-3 transition-[transform,box-shadow,background-color,color,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none'

  const variants = {
    primary: 'bg-mint text-navy hover:bg-mint-hover hover:shadow-md hover:shadow-mint/25 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
    secondary: 'border border-slate-300 dark:border-white/20 text-navy dark:text-white bg-transparent hover:bg-navy/5 dark:hover:bg-white/5 hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
    'secondary-light': 'border border-navy/20 dark:border-white/20 text-navy dark:text-white bg-transparent hover:bg-navy/5 dark:hover:bg-white/5 hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]',
    ghost: 'text-slate-secondary hover:text-navy dark:hover:text-white bg-transparent',
  }

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Cargando...
        </span>
      ) : children}
    </button>
  )
}
