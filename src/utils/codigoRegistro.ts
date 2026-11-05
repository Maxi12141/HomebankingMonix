/** La vigencia real la decide Supabase; esto es lo que se le muestra a la persona. */
export const VIGENCIA_CODIGO_MS = 5 * 60_000
export const ESPERA_REENVIO_MS = 60_000

export function minutosYSegundos(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Con la confirmación activa, Supabase responde sin error y sin identidades si el mail ya tiene cuenta. */
export function emailYaRegistrado(user: { identities?: unknown[] }): boolean {
  return user.identities?.length === 0
}
