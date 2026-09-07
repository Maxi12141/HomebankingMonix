export function NfcWaves({ className = 'text-mint' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="12" cy="24" r="3" fill="currentColor" />
      <path d="M18 14a16 16 0 0 1 0 20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M26 8a24 24 0 0 1 0 32" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      <path d="M34 2a32 32 0 0 1 0 44" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
    </svg>
  )
}
