import { decodeJwt, decodeProtectedHeader, importJWK, jwtVerify } from 'jose'
import { supabase } from './supabaseClient'

// bankCode real de Monix en el entorno test compartido — confirmado con curl
// real contra /persons/{cbu} (ver obtenerMiBankCode en services/bancoCentral.ts).
export const MONIX_BANK_CODE = 3

// No extiende JWTPayload de jose a propósito: ahí `iss` es `string` (uso
// típico de JWT), pero la spec de QR interbancario define `iss` como el
// bankCode numérico — más simple de comparar que parsear un string cada vez.
export interface QrJwtClaims {
  iss: number
  cbu: string
  alias?: string
  monto?: number
  moneda: 'ARS' | 'USD'
  exp?: number
  iat?: number
  // Id de un cobro interno (cobros_nfc) — sólo Monix lo escribe y sólo Monix
  // lo entiende; cualquier otro banco lo ignora sin problema.
  cid?: string
}

interface BancoConocido {
  bankCode: number
  kid: string
  publicKeyJwk: JsonWebKey
}

// Sección 6 de la spec (docs/qr-interbancario-jwt.md): no hay autodiscovery,
// la clave pública de cada banco se intercambia a mano entre equipos. Arranca
// sólo con la propia — sumar acá una fila por cada banco de la clase que se
// sume (bankCode + kid + publicKeyJwk, JWK, nunca la clave privada).
const BANCOS_CONOCIDOS: BancoConocido[] = [
  {
    bankCode: MONIX_BANK_CODE,
    kid: 'monix-1',
    publicKeyJwk: {
      kty: 'EC',
      crv: 'P-256',
      x: 'zTedm3fkuqkdsxJXtkuRMvMOljIkZ1GbhUVAfNa9Q5g',
      y: 'Z1I2SukE7P6K63Ma_iGD4QYDG164_gs9fuhD9IFj9Js',
    },
  },
]

export function esJwtQr(raw: string): boolean {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(raw.trim())
}

export class JwtQrInvalidoError extends Error {}

export interface ResultadoJwtQr {
  claims: QrJwtClaims
  // false = el emisor no está en la tabla de bancos conocidos: se usa igual
  // (sección 7 de la spec) pero sin garantía criptográfica de origen.
  verificado: boolean
}

function chequearVencimiento(claims: { exp?: number }) {
  if (typeof claims.exp === 'number' && claims.exp < Date.now() / 1000) {
    throw new JwtQrInvalidoError('Este código venció. Pedí que te muestren uno nuevo.')
  }
}

/**
 * Decodifica y, si el emisor es conocido, verifica un QR en formato JWT
 * (spec de QR interbancario). Devuelve null si `raw` ni siquiera tiene forma
 * de JWT (para que el caller siga con los formatos internos de siempre).
 * Tira JwtQrInvalidoError si PARECE un JWT pero está vencido o la firma no
 * cierra con la clave del emisor declarado.
 */
export async function verificarJwtQr(raw: string): Promise<ResultadoJwtQr | null> {
  const token = raw.trim()
  if (!esJwtQr(token)) return null

  let header: { kid?: string }
  try {
    header = decodeProtectedHeader(token)
  } catch {
    return null
  }

  const banco = BANCOS_CONOCIDOS.find((b) => b.kid === header.kid)

  if (!banco) {
    // Emisor no está en nuestra tabla local: lo usamos igual, sin verificar.
    let claims: QrJwtClaims
    try {
      claims = decodeJwt(token) as unknown as QrJwtClaims
    } catch {
      return null
    }
    if (!claims.cbu || !claims.moneda) return null
    chequearVencimiento(claims)
    return { claims, verificado: false }
  }

  let claims: QrJwtClaims
  try {
    const publicKey = await importJWK(banco.publicKeyJwk, 'ES256')
    const { payload } = await jwtVerify(token, publicKey, { algorithms: ['ES256'] })
    claims = payload as unknown as QrJwtClaims
  } catch (err) {
    if (err instanceof JwtQrInvalidoError) throw err
    throw new JwtQrInvalidoError('Este código no es válido o venció.')
  }
  if (!claims.cbu || !claims.moneda) throw new JwtQrInvalidoError('Código QR incompleto.')
  return { claims, verificado: true }
}

export interface FirmarQrInput {
  cbu: string
  alias?: string | null
  monto?: number
  moneda: 'ARS' | 'USD'
  cid?: string
}

/** Pide a la Edge Function `firmar-qr` un JWT firmado con la clave de Monix. */
export async function firmarQrPropio(input: FirmarQrInput): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ jwt?: string; error?: string }>('firmar-qr', {
    body: {
      cbu: input.cbu,
      alias: input.alias ?? undefined,
      monto: input.monto,
      moneda: input.moneda,
      cid: input.cid,
    },
  })
  if (error) throw new Error('No se pudo firmar el QR')
  if (!data?.jwt) throw new Error(data?.error ?? 'No se pudo firmar el QR')
  return data.jwt
}
