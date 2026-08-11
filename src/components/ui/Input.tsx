import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-body font-medium text-slate-secondary">
          {label}
        </label>
      )}
      <input
        className={`
          rounded-xl px-4 py-3 font-body text-navy dark:text-white
          bg-slate-input dark:bg-white/5
          border border-slate-300 dark:border-white/10
          focus:outline-none focus:border-mint focus:ring-1 focus:ring-mint/20
          placeholder:text-slate-secondary/60 transition-colors
          ${error ? 'border-red-400 dark:border-red-400' : ''}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-xs text-red-500 dark:text-red-400 font-body">{error}</p>}
    </div>
  )
}
