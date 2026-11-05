import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    isValidHttpUrl(supabaseUrl) &&
    !supabaseUrl.includes('tu_url') &&
    supabaseAnonKey !== 'tu_anon_key_aqui',
)

/**
 * Cliente real solo si hay .env válido.
 * Si falta la config, dejamos null para no tumbar la app con pantalla en blanco.
 */
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : (null as unknown as SupabaseClient)

/**
 * Comprueba una contraseña sin tocar la sesión abierta: iniciar sesión con el cliente
 * principal la reemplaza por una nueva y le quita la verificación en dos pasos.
 * Devuelve el error, o null si la contraseña es correcta.
 */
export async function verificarClave(email: string, password: string) {
  const temporal = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'monix-verificar-clave' },
  })
  const { error } = await temporal.auth.signInWithPassword({ email, password })
  if (error) return error
  await temporal.auth.signOut({ scope: 'local' })
  return null
}
