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

export function encodeIdentityPayload(token: string) {
  return `${MONIX_ID_PREFIX}${token}`
}

export function encodePayPayload(token: string) {
  return `${MONIX_PAY_PREFIX}${token}`
}

export function encodeCobroQr(cobroId: string) {
  return `${MONIX_QR_PREFIX}${cobroId}`
}

export function parseRadioPayload(raw: string): { kind: 'id' | 'pay' | 'cobro'; value: string } | null {
  const value = raw.trim()
  if (value.startsWith(MONIX_ID_PREFIX)) {
    const token = value.slice(MONIX_ID_PREFIX.length).toLowerCase()
    return isToken(token) ? { kind: 'id', value: token } : null
  }
  if (value.startsWith(MONIX_PAY_PREFIX)) {
    const token = value.slice(MONIX_PAY_PREFIX.length).toLowerCase()
    return isToken(token) ? { kind: 'pay', value: token } : null
  }
  if (value.startsWith(MONIX_QR_PREFIX)) {
    return { kind: 'cobro', value: value.slice(MONIX_QR_PREFIX.length) }
  }
  if (isToken(value)) return { kind: 'id', value }
  return null
}

export function rpcMessage(error: { message?: string } | null | undefined, fallback: string) {
  const raw = error?.message ?? ''
  const cut = raw.replace(/^.*error: /i, '').split('\n')[0]?.trim()
  return cut || fallback
}
