import { supabase } from '../lib/supabaseClient'

async function factorActivo(): Promise<string | null> {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) throw error
  return data.totp[0]?.id ?? null
}

export const hayVerificacionActiva = async () => (await factorActivo()) !== null

async function comprobarCodigo(factorId: string, code: string) {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
  if (error) throw error
}

export async function verificarCodigo(code: string) {
  const factorId = await factorActivo()
  if (!factorId) throw new Error('No encontramos la verificación en dos pasos de tu cuenta.')
  await comprobarCodigo(factorId, code)
}

export interface Activacion {
  factorId: string
  qr: string
  clave: string
  uri: string
}

export async function prepararActivacion(): Promise<Activacion> {
  // Alguien pudo empezar y no terminar: ese intento no sirve y traba el siguiente.
  const { data: factores, error: errorFactores } = await supabase.auth.mfa.listFactors()
  if (errorFactores) throw errorFactores
  for (const factor of factores.all) {
    if (factor.status === 'verified') continue
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
    if (error) throw error
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'Monix', friendlyName: 'Monix' })
  if (error) throw error
  return { factorId: data.id, qr: data.totp.qr_code, clave: data.totp.secret, uri: data.totp.uri }
}

/** Pide el código antes: en un dispositivo de confianza la sesión todavía no lo pasó. */
export async function generarCodigosConCodigo(code: string): Promise<string[]> {
  await verificarCodigo(code)
  return nuevosCodigos()
}

export async function nuevosCodigos(): Promise<string[]> {
  const { data, error } = await supabase.rpc('generar_codigos_recuperacion')
  if (error) throw error
  return data as string[]
}

/** Devuelve los códigos de recuperación, o null si el 2FA quedó activo pero no se pudieron generar. */
export async function confirmarActivacion(factorId: string, code: string): Promise<string[] | null> {
  await comprobarCodigo(factorId, code)

  const { error } = await supabase.rpc('cerrar_otras_sesiones')
  if (error) console.error('No se pudieron cerrar las demás sesiones:', error.message)

  try {
    return await nuevosCodigos()
  } catch (err) {
    console.error('No se pudieron generar los códigos de recuperación:', err)
    return null
  }
}

export async function desactivar(code: string) {
  const factorId = await factorActivo()
  if (!factorId) return
  await comprobarCodigo(factorId, code)
  const { error: errorDispositivos } = await supabase.rpc('olvidar_dispositivos')
  if (errorDispositivos) throw errorDispositivos
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) throw error
  const { error: errorSesion } = await supabase.auth.refreshSession()
  if (errorSesion) throw errorSesion
}

/** Con un código bueno apaga el 2FA: la sesión se renueva sin factores y la app entra sola. */
export async function usarCodigoRecuperacion(codigo: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('usar_codigo_recuperacion', { p_codigo: codigo })
  if (error) throw error
  if (!data) return false
  const { error: errorSesion } = await supabase.auth.refreshSession()
  if (errorSesion) throw errorSesion
  return true
}
