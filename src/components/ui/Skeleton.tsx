// Bloques de carga con la forma del contenido que viene, para que la pantalla
// no salte cuando llegan los datos. La ruedita queda para acciones (Button).
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse motion-reduce:animate-none rounded-lg bg-slate-200 dark:bg-white/10 ${className}`} />
}

/** Lista de movimientos en carga: filas con el alto real de una card de movimiento. */
export function MovimientosSkeleton({ filas = 3, label = 'Cargando movimientos' }: { filas?: number; label?: string }) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: filas }, (_, i) => (
        <div
          key={i}
          className="rounded-2xl bg-white dark:bg-navy-card border border-slate-200 dark:border-white/10 px-5 py-4 flex items-center justify-between gap-4"
        >
          <div className="flex flex-col gap-2 flex-1">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  )
}
