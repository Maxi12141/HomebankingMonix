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

// Solo decide qué pantalla mostrar: quien exige de verdad es el servidor (exigir_2fa).
const SESION_CONFIABLE_KEY = 'monix_sesion_confiable'

export function leerSesionConfiable(): string | null {
  try {
    return localStorage.getItem(SESION_CONFIABLE_KEY)
  } catch {
    return null
  }
}

export function guardarSesionConfiable(id: string) {
  try {
    localStorage.setItem(SESION_CONFIABLE_KEY, id)
  } catch {
    /* modo privado: se volverá a comprobar el dispositivo */
  }
}

/**
 * La cuenta tiene la verificación en dos pasos activa y esta sesión todavía no pasó el código
 * ni se comprobó en un dispositivo recordado.
 * No llama a Auth: se usa dentro de onAuthStateChange, donde otra llamada a Auth se queda colgada.
 */
export function sesionPideCodigo(session: SesionMinima | null | undefined, sesionConfiable: string | null = null): boolean {
  if (!session) return false
  const tieneFactor = session.user?.factors?.some((f) => f.status === 'verified') ?? false
  if (!tieneFactor || nivelDeSesion(session.access_token) === 'aal2') return false
  const id = idDeSesion(session.access_token)
  return id === null || id !== sesionConfiable
}
