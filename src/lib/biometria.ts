const STORAGE_KEY = 'monix_bio_v1'
const JUST_AUTH_KEY = 'monix_just_authed'

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
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  if (cap?.isNativePlatform?.()) return true
  return window.matchMedia('(max-width: 767px)').matches
}

export async function soportaHuella() {
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

export function huellaActiva(userId: string) {
  return Boolean(loadAll()[userId]?.credId)
}

export function marcarIngresoConClave() {
  sessionStorage.setItem(JUST_AUTH_KEY, '1')
}

export function consumoIngresoConClave() {
  const v = sessionStorage.getItem(JUST_AUTH_KEY) === '1'
  if (v) sessionStorage.removeItem(JUST_AUTH_KEY)
  return v
}

export async function activarHuella(userId: string, nombre: string) {
  if (!(await soportaHuella())) {
    throw new Error('Este teléfono no tiene huella o Face ID disponible')
  }
  const cred = await navigator.credentials.create({
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
  if (!(cred instanceof PublicKeyCredential)) {
    throw new Error('No se pudo registrar la huella')
  }
  const all = loadAll()
  all[userId] = { credId: bufferToB64(cred.rawId) }
  saveAll(all)
}

export function desactivarHuella(userId: string) {
  const all = loadAll()
  delete all[userId]
  saveAll(all)
}

export async function verificarHuella(userId: string) {
  const record = loadAll()[userId]
  if (!record) throw new Error('La huella no está activada')
  const cred = await navigator.credentials.get({
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
  if (!cred) throw new Error('No se reconoció la huella')
}

export function esCancelacionBiometrica(err: unknown) {
  if (!err || typeof err !== 'object') return false
  const name = 'name' in err ? String(err.name) : ''
  return name === 'NotAllowedError' || name === 'AbortError'
}
