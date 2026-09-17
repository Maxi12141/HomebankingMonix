export const BONO_BIENVENIDA = 150_000

const SESION_KEY = 'monix_registro_sesion'
const LEGACY_KEYS = ['monix_nuevo', 'monix_nuevo_tour', 'monix_new_user']

type Etapa = 'bienvenida' | 'tour'

function leerSesion(): { userId: string; etapa: Etapa } | null {
  try {
    const raw = sessionStorage.getItem(SESION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { userId?: string; etapa?: Etapa }
    if (!parsed.userId || (parsed.etapa !== 'bienvenida' && parsed.etapa !== 'tour')) return null
    return { userId: parsed.userId, etapa: parsed.etapa }
  } catch {
    return null
  }
}

function guardarSesion(userId: string, etapa: Etapa) {
  sessionStorage.setItem(SESION_KEY, JSON.stringify({ userId, etapa }))
}

export function marcarUsuarioNuevo(userId: string) {
  guardarSesion(userId, 'bienvenida')
}

export function hayBienvenidaPendiente(userId: string) {
  const s = leerSesion()
  return s?.userId === userId && s.etapa === 'bienvenida'
}

export function completarBienvenida(userId: string) {
  const s = leerSesion()
  if (s?.userId !== userId) return
  guardarSesion(userId, 'tour')
}

export function hayTourPendiente(userId: string) {
  const s = leerSesion()
  return s?.userId === userId && s.etapa === 'tour'
}

export function completarTour(userId: string) {
  const s = leerSesion()
  if (s?.userId !== userId) return
  sessionStorage.removeItem(SESION_KEY)
}

export function descartarOnboarding() {
  sessionStorage.removeItem(SESION_KEY)
  limpiarClavesViejas()
}

export function limpiarClavesViejas() {
  for (const key of LEGACY_KEYS) localStorage.removeItem(key)
}
