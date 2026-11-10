interface SesionMinima {
  access_token: string
  user?: { factors?: { status: string }[] | null } | null
}

function datosDelToken(token: string): { aal?: unknown; session_id?: unknown } | null {
  try {
    const parte = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(parte)) as { aal?: unknown; session_id?: unknown }
  } catch {
    return null
  }
}

/** Nivel de la sesión ("aal1" o "aal2") según su token, o null si no se puede leer. */
export function nivelDeSesion(token: string): string | null {
  const aal = datosDelToken(token)?.aal
  return typeof aal === 'string' ? aal : null
}

export function idDeSesion(token: string): string | null {
  const id = datosDelToken(token)?.session_id
  return typeof id === 'string' ? id : null
}

/**
 * La cuenta tiene la verificación en dos pasos activa y esta sesión todavía no pasó el código.
 * La app lo usa solo con el link de recuperación de contraseña.
 * No llama a Auth: se usa dentro de onAuthStateChange, donde otra llamada a Auth se queda colgada.
 */
export function sesionPideCodigo(session: SesionMinima | null | undefined, sesionConfiable: string | null = null): boolean {
  if (!session) return false
  const tieneFactor = session.user?.factors?.some((f) => f.status === 'verified') ?? false
  if (!tieneFactor || nivelDeSesion(session.access_token) === 'aal2') return false
  const id = idDeSesion(session.access_token)
  return id === null || id !== sesionConfiable
}
