import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { guardarSesionConfiable, idDeSesion } from '../utils/dosPasos'

// Va en localStorage a propósito: tiene que seguir acá después de cerrar sesión. Solo sirve
// junto con la contraseña o la biometría de esa cuenta, y el servidor lo puede revocar.
const claveToken = (uid: string) => `monix_dispositivo_${uid}`
const claveFallidos = (email: string) => `monix_fallidos_${email.trim().toLowerCase()}`
const INTENTOS_ANTES_DE_PEDIR_CODIGO = 3

function leer(clave: string) {
  try {
    return localStorage.getItem(clave)
  } catch {
    return null
  }
}

function borrar(clave: string) {
  try {
    localStorage.removeItem(clave)
  } catch {
    /* modo privado */
  }
}

// useAuth corre en varios componentes a la vez: una sola consulta por sesión.
const enCurso = new Map<string, Promise<boolean>>()

async function consultar(session: Session, sesionId: string, token: string) {
  const { data, error } = await supabase.rpc('entrar_con_dispositivo', { p_token: token })
  if (error) {
    console.error('No se pudo comprobar el dispositivo:', error.message)
    return false
  }
  if (!data) {
    borrar(claveToken(session.user.id))
    return false
  }
  guardarSesionConfiable(sesionId)
  return true
}

/** Sin red o sin token devuelve false y se pide el código: nunca deja pasar por las dudas. */
export function entrarConDispositivo(session: Session): Promise<boolean> {
  const sesionId = idDeSesion(session.access_token)
  const token = leer(claveToken(session.user.id))
  if (!sesionId || !token) return Promise.resolve(false)
  const pendiente = enCurso.get(sesionId) ?? consultar(session, sesionId, token)
  enCurso.set(sesionId, pendiente)
  return pendiente
}

/** Después de pasar el código. Si falla no molesta: la próxima vez vuelve a pedirlo. */
export async function recordarEsteDispositivo() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  const { data, error } = await supabase.rpc('confiar_en_dispositivo')
  if (error) {
    console.error('No se pudo recordar el dispositivo:', error.message)
    return
  }
  if (typeof data !== 'string') return
  try {
    localStorage.setItem(claveToken(session.user.id), data)
  } catch {
    return
  }
  const sesionId = idDeSesion(session.access_token)
  if (sesionId) guardarSesionConfiable(sesionId)
}

export function olvidarEsteDispositivo(uid: string) {
  borrar(claveToken(uid))
}

/** Varios errores seguidos: este dispositivo deja de contar y el próximo ingreso pide código. */
export function registrarIngresoFallido(email: string, uid: string | null) {
  const clave = claveFallidos(email)
  const intentos = Number(leer(clave) ?? 0) + 1
  try {
    localStorage.setItem(clave, String(intentos))
  } catch {
    /* modo privado */
  }
  if (intentos >= INTENTOS_ANTES_DE_PEDIR_CODIGO && uid) olvidarEsteDispositivo(uid)
}

export function limpiarIngresosFallidos(email: string) {
  borrar(claveFallidos(email))
}
