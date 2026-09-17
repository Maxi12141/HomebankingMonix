import {
  soportaBiometriaNativa,
  verificarBiometriaNativa,
} from '../native/monixRadio'

const STORAGE_KEY = 'monix_bio_v1'
const JUST_AUTH_KEY = 'monix_just_authed'

export type MetodoBio = 'huella' | 'face'

interface BioRecord {
  credId: string
  huella?: boolean
  face?: boolean
}

export interface MetodosBio {
  huella: boolean
  face: boolean
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

function flagsFrom(rec: BioRecord | undefined): MetodosBio {
  if (!rec?.credId) return { huella: false, face: false }
  if (rec.huella === undefined && rec.face === undefined) {
    return { huella: true, face: false }
  }
  return { huella: Boolean(rec.huella), face: Boolean(rec.face) }
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
  if (await soportaBiometriaNativa()) return true
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

export function metodosBio(userId: string): MetodosBio {
  return flagsFrom(loadAll()[userId])
}

export function huellaActiva(userId: string) {
  const m = metodosBio(userId)
  return m.huella || m.face
}

export function marcarIngresoConClave() {
  sessionStorage.setItem(JUST_AUTH_KEY, '1')
}

export function consumoIngresoConClave() {
  const v = sessionStorage.getItem(JUST_AUTH_KEY) === '1'
  if (v) sessionStorage.removeItem(JUST_AUTH_KEY)
  return v
}

async function asegurarCredencial(userId: string, nombre: string) {
  const existing = loadAll()[userId]
  if (existing?.credId) return existing
  if (await soportaBiometriaNativa()) {
    await verificarBiometriaNativa()
    return { credId: 'native', huella: false, face: false } satisfies BioRecord
  }
  if (!(await soportaHuella())) {
    throw new Error('Este teléfono no tiene huella ni reconocimiento facial disponible')
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
    throw new Error('No se pudo registrar el desbloqueo biométrico')
  }
  return { credId: bufferToB64(cred.rawId), huella: false, face: false } satisfies BioRecord
}

export async function activarMetodo(userId: string, nombre: string, metodo: MetodoBio) {
  const rec = await asegurarCredencial(userId, nombre)
  const flags = flagsFrom(rec)
  flags[metodo] = true
  const all = loadAll()
  all[userId] = { credId: rec.credId, ...flags }
  saveAll(all)
}

export function desactivarMetodo(userId: string, metodo: MetodoBio) {
  const all = loadAll()
  const rec = all[userId]
  if (!rec?.credId) return
  const flags = flagsFrom(rec)
  flags[metodo] = false
  if (!flags.huella && !flags.face) {
    delete all[userId]
  } else {
    all[userId] = { credId: rec.credId, ...flags }
  }
  saveAll(all)
}

export async function activarHuella(userId: string, nombre: string) {
  await activarMetodo(userId, nombre, 'huella')
}

export function desactivarHuella(userId: string) {
  const all = loadAll()
  delete all[userId]
  saveAll(all)
}

export async function verificarHuella(userId: string) {
  const record = loadAll()[userId]
  if (!record) throw new Error('El desbloqueo biométrico no está activado')
  if (record.credId === 'native') {
    await verificarBiometriaNativa()
    return
  }
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
  if (!cred) throw new Error('No se reconoció la huella o el Face ID')
}

export function esCancelacionBiometrica(err: unknown) {
  if (!err || typeof err !== 'object') return false
  const name = 'name' in err ? String(err.name) : ''
  return name === 'NotAllowedError' || name === 'AbortError'
}
