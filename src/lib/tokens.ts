const HEX = /[^0-9a-f]/g

export function randomToken(bytes = 16): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function isToken(value: string): boolean {
  return /^[0-9a-f]{32,64}$/.test(value)
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.toLowerCase().replace(HEX, '')
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

export function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const MONIX_ID_PREFIX = 'monix:id:'
export const MONIX_PAY_PREFIX = 'monix:pay:'
export const MONIX_QR_PREFIX = 'MONIXPAY:'
export const MONIX_CUENTA_QR_PREFIX = 'MONIXQR:'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string) {
  return UUID_RE.test(value)
}

export function encodeIdentityPayload(token: string) {
  return `${MONIX_ID_PREFIX}${token}`
}

export function encodePayPayload(token: string) {
  return `${MONIX_PAY_PREFIX}${token}`
}

export function encodeCobroQr(cobroId: string) {
  return `${MONIX_QR_PREFIX}${cobroId}`
}

export function encodeCuentaQr(cuentaId: string) {
  return `${MONIX_CUENTA_QR_PREFIX}${cuentaId}`
}

const CBU_RE = /\d{22}/
const ALIAS_RE = /^[a-z0-9][a-z0-9._-]{5,19}$/

export function extraerCbu(raw: string): string | null {
  const match = raw.replace(/\s+/g, '').match(CBU_RE)
  return match?.[0] ?? null
}

export function pareceAliasCbu(raw: string): boolean {
  const v = raw.trim().toLowerCase()
  return ALIAS_RE.test(v) && /[a-z]/.test(v)
}

export type CercaHint = { kind: 'token' | 'cbu' | 'alias'; value: string }

export function parseCercaPayload(raw: string): CercaHint | null {
  const value = raw.trim()
  if (!value) return null
  const radio = parseRadioPayload(value)
  if (radio?.kind === 'id') return { kind: 'token', value: radio.value }
  const cbu = extraerCbu(value)
  if (cbu) return { kind: 'cbu', value: cbu }
  if (pareceAliasCbu(value)) return { kind: 'alias', value: value.toLowerCase() }
  if (isToken(value)) return { kind: 'token', value: value.toLowerCase() }
  return null
}

export function parseRadioPayload(raw: string): { kind: 'id' | 'pay' | 'cobro' | 'cuenta'; value: string } | null {
  const value = raw.trim()
  if (value.startsWith(MONIX_ID_PREFIX)) {
    const token = value.slice(MONIX_ID_PREFIX.length).toLowerCase()
    return isToken(token) ? { kind: 'id', value: token } : null
  }
  if (value.startsWith(MONIX_PAY_PREFIX)) {
    const token = value.slice(MONIX_PAY_PREFIX.length).toLowerCase()
    return isToken(token) ? { kind: 'pay', value: token } : null
  }
  if (value.startsWith(MONIX_CUENTA_QR_PREFIX)) {
    const id = value.slice(MONIX_CUENTA_QR_PREFIX.length)
    return isUuid(id) ? { kind: 'cuenta', value: id } : null
  }
  if (value.startsWith(MONIX_QR_PREFIX)) {
    const id = value.slice(MONIX_QR_PREFIX.length)
    return { kind: 'cobro', value: id }
  }
  if (isUuid(value)) return { kind: 'cuenta', value }
  if (isToken(value)) return { kind: 'id', value }
  return null
}

export function rpcMessage(error: { message?: string } | null | undefined, fallback: string) {
  const raw = error?.message ?? ''
  const cut = raw.replace(/^.*error: /i, '').split('\n')[0]?.trim()
  return cut || fallback
}
