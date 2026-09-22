import {
  isNative as isNativeApp,
  verificarBiometriaNativa,
} from '../native/monixRadio'

const STORAGE_KEY = 'monix_bio_v1'
const JUST_AUTH_KEY = 'monix_just_authed'
const EMAIL_INDEX_KEY = 'monix_email_uid_v1'
const BIO_CRED_KEY = 'monix_bio_cred_v1'

// El teléfono decide solo qué biometría mostrar (huella, cara, PIN) según lo
// que tenga configurado el usuario en el sistema operativo — WebAuthn (y el
// prompt nativo) no le informan al sitio cuál fue, por diseño de privacidad.
// Por eso acá no se distingue "huella" de "Face ID": es un único toggle de
// biometría, activado o no.
interface BioRecord {
  credId: string
}

function loadAll(): Record<string, BioRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, BioRecord>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveAll(data: Record<string, BioRecord>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function bufferToB64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64ToBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function rpId() {
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1' ? 'localhost' : host
}

export function esCelular() {
  if (typeof window === 'undefined') return false
  if (isNativeApp()) return true
  return window.matchMedia('(max-width: 767px)').matches
}

export async function soportaHuella() {
  if (isNativeApp() || esCelular()) return true
  if (!window.PublicKeyCredential) return false
  if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
    return false
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export function huellaActiva(userId: string): boolean {
  return Boolean(loadAll()[userId]?.credId)
}

// Índice local email -> userId, para poder chequear si una cuenta tiene
// biometría activa ANTES de autenticar (metodosBio/huellaActiva necesitan
// el userId, que recién se conoce después de loguearse). Se completa en
// useAuth.ts cada vez que se resuelve una sesión.
function loadEmailIndex(): Record<string, string> {
  try {
    const raw = localStorage.getItem(EMAIL_INDEX_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, string>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function registrarEmailUid(email: string, userId: string) {
  const idx = loadEmailIndex()
  idx[email.trim().toLowerCase()] = userId
  localStorage.setItem(EMAIL_INDEX_KEY, JSON.stringify(idx))
}

export function uidParaEmail(email: string): string | null {
  return loadEmailIndex()[email.trim().toLowerCase()] ?? null
}

// Contraseña en texto plano en localStorage, sólo para cuentas con huella
// activa en este dispositivo — la libera LoginPage.tsx tras un OK biométrico.
// Es un trade-off más débil que "Recordarme" (que sólo guarda el email,
// nunca la contraseña): se acepta porque queda acotado a WebAuthn + a las
// cuentas que explícitamente activaron biometría, no a cualquier sesión.
function loadBioCred(): Record<string, string> {
  try {
    const raw = localStorage.getItem(BIO_CRED_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, string>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function guardarCredencialBio(email: string, password: string) {
  const all = loadBioCred()
  all[email.trim().toLowerCase()] = password
  localStorage.setItem(BIO_CRED_KEY, JSON.stringify(all))
}

export function credencialBioParaEmail(email: string): string | null {
  return loadBioCred()[email.trim().toLowerCase()] ?? null
}

export function borrarCredencialBio(email: string) {
  const all = loadBioCred()
  delete all[email.trim().toLowerCase()]
  localStorage.setItem(BIO_CRED_KEY, JSON.stringify(all))
}

const BIO_NOMBRE_KEY = 'monix_bio_nombre_v1'

// Nombre para saludar en el login antes de autenticar ("Hola, Diego") — se
// guarda junto con la credencial al activar biometría en Perfil. Si no está
// (cuentas que activaron biometría antes de este feature), el login cae de
// vuelta a mostrar el email nomás.
function loadBioNombre(): Record<string, string> {
  try {
    const raw = localStorage.getItem(BIO_NOMBRE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, string>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function guardarNombreBio(email: string, nombre: string) {
  const all = loadBioNombre()
  all[email.trim().toLowerCase()] = nombre
  localStorage.setItem(BIO_NOMBRE_KEY, JSON.stringify(all))
}

export function nombreBioParaEmail(email: string): string | null {
  return loadBioNombre()[email.trim().toLowerCase()] ?? null
}

export function borrarNombreBio(email: string) {
  const all = loadBioNombre()
  delete all[email.trim().toLowerCase()]
  localStorage.setItem(BIO_NOMBRE_KEY, JSON.stringify(all))
}

export function marcarIngresoConClave() {
  sessionStorage.setItem(JUST_AUTH_KEY, '1')
}

export function consumoIngresoConClave() {
  const v = sessionStorage.getItem(JUST_AUTH_KEY) === '1'
  if (v) sessionStorage.removeItem(JUST_AUTH_KEY)
  return v
}

async function asegurarCredencial(userId: string, nombre: string): Promise<BioRecord> {
  if (isNativeApp()) {
    await verificarBiometriaNativa()
    return { credId: 'native' }
  }
  const existing = loadAll()[userId]
  if (existing?.credId) return existing
  if (!(await soportaHuella())) {
    throw new Error('Este teléfono no tiene huella ni reconocimiento facial disponible')
  }
  const creacion = navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Monix', id: rpId() },
      user: {
        id: new TextEncoder().encode(userId),
        name: nombre,
        displayName: nombre,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60_000,
      attestation: 'none',
    },
  })
  // Si gana el timeout de acá abajo, navigator.credentials.create() sigue
  // pendiente en segundo plano — sin este catch, un rechazo tardío (usuario
  // cancela el prompt nativo después de los 12s) queda sin manejar.
  creacion.catch(() => undefined)
  const cred = await Promise.race([
    creacion,
    new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('El teléfono no mostró la huella. En la app de Monix instalá la APK nueva.')),
        12_000,
      )
    }),
  ])
  if (!(cred instanceof PublicKeyCredential)) {
    throw new Error('No se pudo registrar el desbloqueo biométrico')
  }
  return { credId: bufferToB64(cred.rawId) }
}

export async function activarBiometria(userId: string, nombre: string) {
  const rec = await asegurarCredencial(userId, nombre)
  const all = loadAll()
  all[userId] = rec
  saveAll(all)
}

export function desactivarBiometria(userId: string) {
  const all = loadAll()
  delete all[userId]
  saveAll(all)
}

export async function verificarHuella(userId: string) {
  const record = loadAll()[userId]
  if (!record) throw new Error('El desbloqueo biométrico no está activado')
  if (isNativeApp()) {
    await verificarBiometriaNativa()
    return
  }
  if (record.credId === 'native') {
    throw new Error('Abrí Monix desde la app instalada para usar la huella')
  }
  const verificacion = navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: rpId(),
      allowCredentials: [{
        type: 'public-key',
        id: b64ToBytes(record.credId),
      }],
      userVerification: 'required',
      timeout: 60_000,
    },
  })
  // Mismo patrón que asegurarCredencial: sin esto, un WebView colgado deja el spinner de login girando para siempre.
  verificacion.catch(() => undefined)
  const cred = await Promise.race([
    verificacion,
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('El teléfono no respondió a tiempo. Probá de nuevo o usá tu contraseña.')), 12_000)
    }),
  ])
  if (!cred) throw new Error('No se reconoció la huella o el Face ID')
}

export function esCancelacionBiometrica(err: unknown) {
  const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : ''
  const msg = err instanceof Error ? err.message : String(err ?? '')
  return name === 'NotAllowedError' || name === 'AbortError' || /cancel/i.test(msg)
}
