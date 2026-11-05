interface SesionMinima {
  access_token: string
  user?: { factors?: { status: string }[] | null } | null
}

/** Nivel de la sesión ("aal1" o "aal2") según su token, o null si no se puede leer. */
export function nivelDeSesion(token: string): string | null {
  try {
    const parte = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const datos = JSON.parse(atob(parte)) as { aal?: unknown }
    return typeof datos.aal === 'string' ? datos.aal : null
  } catch {
    return null
  }
}

/**
 * La cuenta tiene la verificación en dos pasos activa y esta sesión todavía no pasó el código.
 * No llama a Auth: se usa dentro de onAuthStateChange, donde otra llamada a Auth se queda colgada.
 */
export function sesionPideCodigo(session: SesionMinima | null | undefined): boolean {
  if (!session) return false
  const tieneFactor = session.user?.factors?.some((f) => f.status === 'verified') ?? false
  return tieneFactor && nivelDeSesion(session.access_token) !== 'aal2'
}
