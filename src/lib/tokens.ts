export const MONIX_QR_PREFIX = 'MONIXPAY:'
export const MONIX_CUENTA_QR_PREFIX = 'MONIXQR:'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string) {
  return UUID_RE.test(value)
}

export function encodeCobroQr(cobroId: string) {
  return `${MONIX_QR_PREFIX}${cobroId}`
}

export function encodeCuentaQr(cuentaId: string) {
  return `${MONIX_CUENTA_QR_PREFIX}${cuentaId}`
}

export function parseRadioPayload(raw: string): { kind: 'cobro' | 'cuenta'; value: string } | null {
  const value = raw.trim()
  if (value.startsWith(MONIX_CUENTA_QR_PREFIX)) {
    const id = value.slice(MONIX_CUENTA_QR_PREFIX.length)
    return isUuid(id) ? { kind: 'cuenta', value: id } : null
  }
  if (value.startsWith(MONIX_QR_PREFIX)) {
    const id = value.slice(MONIX_QR_PREFIX.length)
    return { kind: 'cobro', value: id }
  }
  if (isUuid(value)) return { kind: 'cuenta', value }
  return null
}

export function rpcMessage(error: { message?: string } | null | undefined, fallback: string) {
  const raw = error?.message ?? ''
  const cut = raw.replace(/^.*error: /i, '').split('\n')[0]?.trim()
  return cut || fallback
}
