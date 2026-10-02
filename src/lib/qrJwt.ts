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
  // Opcional al LEER: hay bancos que no la mandan; Transferir la resuelve
  // igual con los datos del destinatario en el Banco Central.
  moneda?: 'ARS' | 'USD'
  exp?: number
  iat?: number
  // Id único del QR: se devuelve en el aviso de lectura (spec, sección 12).
  jti?: string
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

interface BancoAviso {
  nombre: string
  // Endpoint del banco emisor para el aviso de lectura (spec, sección 12).
  // Sin avisoUrl, ese banco no recibe avisos y simplemente no se manda nada.
  avisoUrl?: string
}

// A diferencia de BANCOS_CONOCIDOS (claves, opcionales), esta tabla va por
// bankCode (`iss`): para avisar alcanza con saber a qué URL mandar el POST.
// Sumar una fila por banco de la cátedra cuando pase su avisoUrl.
export const BANCOS_AVISO: Record<number, BancoAviso> = {
  [MONIX_BANK_CODE]: {
    nombre: 'Monix',
    avisoUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qr-lectura`,
  },
  12: {
    nombre: 'Banco Tuo',
    avisoUrl: 'https://banco-tuo.vercel.app/api/qr/aviso-lectura',
  },
}

export function nombreBanco(bankCode: number): string {
  return BANCOS_AVISO[bankCode]?.nombre ?? `Banco ${bankCode}`
}

export type ResultadoAviso = 'ok' | 'usado' | 'sin-respuesta'

/**
 * Le avisa al banco que emitió el QR que lo acabamos de leer y espera su
 * respuesta como máximo 3 s. 'usado' (409) = el QR ya lo escaneó otra persona
 * y no hay que dejar pagar (spec, sección 13). Si el banco no tiene avisoUrl,
 * no responde o falla, devuelve 'sin-respuesta' y el pago sigue normal: un
 * banco caído nunca traba un pago.
 */
export async function avisarLectura(
  token: string,
  claims: QrJwtClaims,
  nombreLector: string | null,
): Promise<ResultadoAviso> {
  const url = BANCOS_AVISO[claims.iss]?.avisoUrl
  if (!url) return 'sin-respuesta'
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        qr: token.trim(),
        banco: MONIX_BANK_CODE,
        ...(nombreLector ? { nombre: nombreLector } : {}),
      }),
      signal: AbortSignal.timeout(3000),
    })
    if (res.status === 409) return 'usado'
    return res.ok ? 'ok' : 'sin-respuesta'
  } catch {
    return 'sin-respuesta'
  }
}

export function esJwtQr(raw: string): boolean {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(raw.trim())
}

export class JwtQrInvalidoError extends Error {}

export interface ResultadoJwtQr {
  claims: QrJwtClaims
  // El JWT tal cual (sin lo que lo envolviera, p. ej. un link): es lo que se
  // devuelve en el aviso de lectura.
  token: string
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
 * Saca el JWT de lo que haya leído la cámara. Algunos bancos lo meten dentro
 * de un link (https://banco/pagar?qr=eyJ...), así que se busca en cualquier
 * parte del texto y no sólo como texto completo.
 */
export function extraerJwt(raw: string): string | null {
  const limpio = raw.trim()
  if (esJwtQr(limpio)) return limpio
  const m = limpio.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)
  return m ? m[0] : null
}

// Cada banco arma los claims a su manera (monto como texto, moneda en
// minúscula, iss como string): se normalizan para no rechazar QRs válidos.
function normalizarClaims(c: Record<string, unknown>): QrJwtClaims {
  const monedaTxt = typeof c.moneda === 'string' ? c.moneda.trim().toUpperCase() : ''
  const montoNum = typeof c.monto === 'number'
    ? c.monto
    : typeof c.monto === 'string' ? Number(c.monto.replace(',', '.')) : NaN
  return {
    iss: Number(c.iss),
    cbu: typeof c.cbu === 'string' ? c.cbu.trim() : typeof c.cbu === 'number' ? String(c.cbu) : '',
    alias: typeof c.alias === 'string' && c.alias.trim() ? c.alias.trim() : undefined,
    monto: Number.isFinite(montoNum) && montoNum > 0 ? montoNum : undefined,
    moneda: monedaTxt === 'ARS' || monedaTxt === 'USD' ? monedaTxt : undefined,
    exp: typeof c.exp === 'number' ? c.exp : undefined,
    iat: typeof c.iat === 'number' ? c.iat : undefined,
    jti: typeof c.jti === 'string' ? c.jti : undefined,
    cid: typeof c.cid === 'string' ? c.cid : undefined,
  }
}

/**
 * Decodifica y, si el emisor es conocido, verifica un QR en formato JWT
 * (spec de QR interbancario). Devuelve null si `raw` no contiene un JWT o no
 * trae ni CBU ni alias (para que el caller siga con los demás formatos).
 * Tira JwtQrInvalidoError si es un JWT pero está vencido o la firma no cierra
 * con la clave del emisor declarado.
 */
export async function verificarJwtQr(raw: string): Promise<ResultadoJwtQr | null> {
  const token = extraerJwt(raw)
  if (!token) return null

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
      claims = normalizarClaims(decodeJwt(token) as Record<string, unknown>)
    } catch {
      return null
    }
    if (!claims.cbu && !claims.alias) return null
    chequearVencimiento(claims)
    return { claims, token, verificado: false }
  }

  let claims: QrJwtClaims
  try {
    const publicKey = await importJWK(banco.publicKeyJwk, 'ES256')
    const { payload } = await jwtVerify(token, publicKey, { algorithms: ['ES256'] })
    claims = normalizarClaims(payload as Record<string, unknown>)
  } catch (err) {
    if (err instanceof JwtQrInvalidoError) throw err
    throw new JwtQrInvalidoError('Este código no es válido o venció.')
  }
  if (!claims.cbu && !claims.alias) throw new JwtQrInvalidoError('Código QR incompleto.')
  return { claims, token, verificado: true }
}

/**
 * Formatos simples sin firma que usan otros bancos (o su fallback cuando no
 * pueden firmar): un CBU/CVU pelado de 22 dígitos, un alias, o JSON plano
 * {cbu, alias, monto, moneda} (spec, sección 7). Devuelve null si no es
 * ninguno de esos.
 */
export function leerQrSimple(raw: string): QrJwtClaims | null {
  const texto = raw.trim()
  if (/^\d{22}$/.test(texto)) return { iss: 0, cbu: texto }
  if (texto.startsWith('{')) {
    try {
      const claims = normalizarClaims(JSON.parse(texto) as Record<string, unknown>)
      return claims.cbu || claims.alias ? claims : null
    } catch {
      return null
    }
  }
  // Alias del Banco Central: palabras separadas por puntos (luna.faro.rio).
  if (texto.length <= 30 && /^[a-z0-9-]{2,20}(\.[a-z0-9-]{2,20}){1,3}$/i.test(texto)) {
    return { iss: 0, cbu: '', alias: texto.toLowerCase() }
  }
  return null
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
