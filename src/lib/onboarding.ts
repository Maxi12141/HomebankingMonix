export const BONO_BIENVENIDA = 150_000

const NUEVO_KEY = 'monix_nuevo'
const TOUR_KEY = 'monix_nuevo_tour'

export function marcarUsuarioNuevo(userId: string) {
  localStorage.setItem(NUEVO_KEY, userId)
}

export function hayBienvenidaPendiente(userId: string) {
  return localStorage.getItem(NUEVO_KEY) === userId
}

export function completarBienvenida(userId: string) {
  localStorage.removeItem(NUEVO_KEY)
  localStorage.setItem(TOUR_KEY, userId)
}

export function hayTourPendiente(userId: string) {
  return localStorage.getItem(TOUR_KEY) === userId
}

export function completarTour(userId: string) {
  if (localStorage.getItem(TOUR_KEY) === userId) {
    localStorage.removeItem(TOUR_KEY)
  }
}

export function pedirTourDeNuevo(userId: string) {
  localStorage.setItem(TOUR_KEY, userId)
}
