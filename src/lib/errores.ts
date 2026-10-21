import { BancoCentralError, mensajeAmigableBC } from '../services/bancoCentral'

// Tono del Manual de Marca: "no pudimos…", qué pasó y qué hacer ahora, sin jerga.
const SESION_VENCIDA = 'Tu sesión venció. Ingresá de nuevo y probá otra vez.'

const TRADUCCIONES: [RegExp, string][] = [
  // Red y tiempos
  [/failed to fetch|networkerror|load failed|network request failed|fetch failed|err_internet/i, 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.'],
  [/timeout|timed out|signal is aborted|tardó demasiado/i, 'La operación tardó demasiado. Probá de nuevo.'],
  // Supabase Auth
  [/already registered|already been registered|user already exists/i, 'Ese email ya está registrado. Ingresá con tu contraseña.'],
  [/invalid login credentials/i, 'Email o contraseña incorrectos.'],
  [/email not confirmed/i, 'Todavía no confirmaste tu email. Revisá tu casilla.'],
  [/password should be at least|password is too short/i, 'La contraseña tiene que tener al menos 6 caracteres.'],
  [/weak.?password|password is known to be weak/i, 'Esa contraseña es muy fácil de adivinar. Probá con una más larga.'],
  [/should be different from the old password|same password/i, 'La contraseña nueva tiene que ser distinta de la anterior.'],
  [/invalid email|email address .* is invalid|unable to validate email/i, 'Ese email no es válido. Revisalo y probá de nuevo.'],
  [/rate limit|too many requests|for security purposes|over_email_send_rate/i, 'Hiciste muchos intentos seguidos. Esperá un minuto y probá de nuevo.'],
  [/jwt|refresh token|session (?:not found|missing|expired)|auth session missing|^no autenticado$/i, SESION_VENCIDA],
  // Postgres
  [/duplicate key.*dni|dni.*duplicate/i, 'Ese DNI ya está registrado.'],
  [/duplicate key.*email/i, 'Ese email ya está registrado. Ingresá con tu contraseña.'],
  [/duplicate key|already exists/i, 'Ese dato ya está registrado. Revisalo y probá de nuevo.'],
  [/permission denied|row-level security|^no autorizado$/i, 'No pudimos hacer esa operación con tu cuenta. Si sigue pasando, escribinos.'],
  // raise exception nuestros que quedaron fríos o sin tilde
  [/^monto inv[aá]lido$/i, 'Ingresá un monto válido.'],
  [/^saldo insuficiente/i, 'No te alcanza el saldo para esta operación.'],
  [/^token inv[aá]lido$|^qr inv[aá]lido$|^cobro inv[aá]lido$/i, 'Ese QR ya no sirve. Pedí uno nuevo y probá de nuevo.'],
  [/^la cuenta destino no esta disponible$/i, 'La cuenta destino no está disponible.'],
  [/^tu cuenta no esta disponible$/i, 'Tu cuenta no está disponible.'],
  [/^no podes transferirte a vos mismo$/i, 'No podés transferirte a vos mismo.'],
]

// Señales de texto técnico (inglés, SQL, identificadores): nunca se muestran tal cual.
const TECNICO = /schema cache|\bfunction\b|relation|column|constraint|violates|syntax|pgrst|\bnull\b|undefined|is not|does not|cannot|could not|unexpected|invalid|error|exception|status|json|\bthe\b|\bof\b|[a-z]_[a-z]|\(|\{/i

/**
 * Texto apto para el usuario a partir de cualquier error (Supabase, Banco
 * Central, red o nuestros `raise exception`). Lo técnico se cambia por
 * `fallback`; el crudo queda sólo en la consola.
 */
export function mensajeError(err: unknown, fallback: string): string {
  if (err instanceof BancoCentralError) return mensajeAmigableBC(err)
  const raw = typeof err === 'string'
    ? err
    : err && typeof err === 'object' && 'message' in err ? String(err.message ?? '') : ''
  // Postgres antepone "ERROR: " y a veces agrega contexto en otras líneas.
  const msg = raw.replace(/^.*error: /i, '').split('\n')[0]?.trim() ?? ''
  if (!msg) return fallback
  const traducido = TRADUCCIONES.find(([re]) => re.test(msg))?.[1]
  if (traducido) return traducido
  if (TECNICO.test(msg)) {
    console.error('[error técnico ocultado al usuario]', err)
    return fallback
  }
  return msg
}
