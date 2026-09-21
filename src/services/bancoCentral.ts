const BASE_URL = import.meta.env.VITE_BC_URL as string
const TIMEOUT_MS = 10_000

const HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
  'x-api-key': import.meta.env.VITE_BC_API_KEY as string,
  // Forzado a 'test' mientras se valida el flujo de cuentas en dólares (no depende de VITE_BC_ENV).
  // Volver a `import.meta.env.VITE_BC_ENV as string` recién cuando el negocio confirme el pase a producción.
  'x-environment': 'test',
}

async function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('La operación tardó demasiado. Probá de nuevo.')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Error real del Banco Central: guarda el status HTTP y el body JSON crudo
 * (para loguear en consola y depurar) separado del mensaje que se le puede
 * mostrar a un usuario final (ver `mensajeAmigableBC`).
 */
export class BancoCentralError extends Error {
  status: number
  body: unknown
  endpoint: string

  constructor(status: number, body: unknown, endpoint: string) {
    const bodyMessage = (body as { message?: string } | null)?.message
    super(bodyMessage ?? `Error ${status} del Banco Central`)
    this.name = 'BancoCentralError'
    this.status = status
    this.body = body
    this.endpoint = endpoint
  }
}

async function handleResponse<T>(res: Response, endpoint: string): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }))
    // eslint-disable-next-line no-console
    console.error(`[BancoCentral] ${res.status} ${endpoint} →`, body)
    throw new BancoCentralError(res.status, body, endpoint)
  }
  return res.json() as Promise<T>
}

/**
 * Mensaje apto para mostrar a un usuario final ante un error del Banco
 * Central — nunca expone el JSON crudo de la respuesta (eso queda sólo en la
 * consola, vía `handleResponse`). Usar en el catch de cualquier pantalla que
 * llame a una función de este archivo y muestre el error en la UI.
 */
export function mensajeAmigableBC(err: unknown): string {
  if (err instanceof BancoCentralError) {
    switch (err.status) {
      case 400:
        return 'Revisá los datos ingresados e intentá de nuevo.'
      case 401:
      case 403:
        return 'No pudimos validar la operación con el banco. Intentá de nuevo en unos minutos.'
      case 404:
        return 'No encontramos lo que buscabas en el banco.'
      case 409:
        return 'Ese dato ya está registrado en el Banco Central.'
      case 429:
        return 'Estamos recibiendo muchas solicitudes en este momento. Esperá un momento y volvé a intentar.'
      default:
        return err.status >= 500
          ? 'El Banco Central no está respondiendo en este momento. Intentá de nuevo en unos minutos.'
          : 'No pudimos completar la operación con el banco. Intentá de nuevo.'
    }
  }
  if (err instanceof Error && err.message.includes('tardó demasiado')) return err.message
  return 'No pudimos completar la operación. Intentá de nuevo.'
}

export interface BCPersona {
  cbu: string
  nombre: string
  apellido: string
  // dni sólo viene en la respuesta de POST /persons — GET /persons/{cbu} y
  // /persons/alias/{alias} no lo incluyen (confirmado contra test 19 ago 2026).
  dni?: string
  alias?: string | null
  // La búsqueda de /persons es GLOBAL: devuelve cualquier cuenta que matchee
  // el CBU/alias, sea ARS o USD, con su moneda real — no está limitada a la
  // caja en pesos como se asumía antes (confirmado contra test 19 ago 2026:
  // GET /persons/alias/{alias} de un alias USD devuelve moneda:"USD").
  moneda?: 'ARS' | 'USD' | string
  bankCode?: number
  saldo?: number
}

export interface BCTransaccion {
  transaccionId: string
  estado: string
  nombreOrigen: string
  nombreDestino: string
  importe: number
}

export interface BCPersonaTransaccion {
  nombre: string
  apellido: string
  dni?: string
  cbu: string
  alias: string | null
}

export interface BCTransaccionEntrante {
  _id: string
  cbuOrigen: string
  cbuDestino: string
  importe: number
  estado: string
  motivoRechazo?: string
  bankCodeOrigen: number
  bankCodeDestino: number
  createdAt: string
  personaOrigen: BCPersonaTransaccion
  personaDestino: BCPersonaTransaccion
}

export async function registrarPersona(
  nombre: string,
  apellido: string,
  dni: string,
): Promise<BCPersona> {
  const res = await fetchWithTimeout(`${BASE_URL}/persons`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ nombre, apellido, dni }),
  })
  return handleResponse<BCPersona>(res, 'POST /persons')
}

export async function buscarPorCBU(cbu: string): Promise<BCPersona> {
  const res = await fetchWithTimeout(`${BASE_URL}/persons/${cbu}`, { headers: HEADERS })
  return handleResponse<BCPersona>(res, 'GET /persons/:cbu')
}

export async function buscarPorAlias(alias: string): Promise<BCPersona> {
  const res = await fetchWithTimeout(`${BASE_URL}/persons/alias/${encodeURIComponent(alias)}`, {
    headers: HEADERS,
  })
  return handleResponse<BCPersona>(res, 'GET /persons/alias/:alias')
}

export async function asignarAlias(cbu: string, alias: string): Promise<BCPersona> {
  const res = await fetchWithTimeout(`${BASE_URL}/persons/${cbu}/alias`, {
    method: 'PUT',
    headers: HEADERS,
    body: JSON.stringify({ alias }),
  })
  return handleResponse<BCPersona>(res, 'PUT /persons/:cbu/alias')
}

export async function transferir(
  cbuOrigen: string,
  cbuDestino: string,
  importe: number,
  saldoOrigen: number,
): Promise<BCTransaccion> {
  const res = await fetchWithTimeout(`${BASE_URL}/transactions`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ cbuOrigen, cbuDestino, importe, saldoOrigen }),
  })
  return handleResponse<BCTransaccion>(res, 'POST /transactions')
}

export async function listarTransacciones(minutos: number): Promise<BCTransaccionEntrante[]> {
  if (!BASE_URL) return []
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/transactions?minutos=${minutos}`, { headers: HEADERS })
    if (res.status === 404) return []
    return await handleResponse<BCTransaccionEntrante[]>(res, 'GET /transactions')
  } catch (err) {
    if (esNotFound(err)) return []
    throw err
  }
}

export interface BCBank {
  bankCode: number
  name: string
}

export async function getBankName(bankCode: number): Promise<string> {
  const res = await fetchWithTimeout(`${BASE_URL}/banks/${bankCode}`, { headers: HEADERS })
  const bank = await handleResponse<BCBank>(res, 'GET /banks/:bankCode')
  return bank.name
}

// --- Cuentas (no-ARS): /persons sólo indexa la caja en pesos, las cuentas en
// otras monedas viven en un espacio de CBU/alias separado. Ver plan de cuentas
// multi-moneda, hallazgo "El bug real: hoy sólo se busca en /persons".

export interface BCCuenta {
  cbu: string
  alias: string | null
  dni: string
  nombre: string
  apellido: string
  moneda: 'ARS' | 'USD'
  saldo: number
  bankCode?: number
}

export async function abrirCuenta(dni: string, moneda: 'ARS' | 'USD'): Promise<BCCuenta> {
  const res = await fetchWithTimeout(`${BASE_URL}/accounts`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ dni, moneda }),
  })
  return handleResponse<BCCuenta>(res, 'POST /accounts')
}

export async function asignarAliasCuenta(cbu: string, alias: string): Promise<BCCuenta> {
  const res = await fetchWithTimeout(`${BASE_URL}/accounts/${cbu}/alias`, {
    method: 'PUT',
    headers: HEADERS,
    body: JSON.stringify({ alias }),
  })
  return handleResponse<BCCuenta>(res, 'PUT /accounts/:cbu/alias')
}

export async function buscarCuentaPorCBU(cbu: string): Promise<BCCuenta> {
  const res = await fetchWithTimeout(`${BASE_URL}/accounts/${cbu}`, { headers: HEADERS })
  return handleResponse<BCCuenta>(res, 'GET /accounts/:cbu')
}

export async function buscarCuentaPorAlias(alias: string): Promise<BCCuenta> {
  const res = await fetchWithTimeout(`${BASE_URL}/accounts/alias/${encodeURIComponent(alias)}`, {
    headers: HEADERS,
  })
  return handleResponse<BCCuenta>(res, 'GET /accounts/alias/:alias')
}

export interface BCDestinatario {
  nombre: string
  apellido: string
  dni: string | null
  cbu: string
  alias: string | null
  moneda: 'ARS' | 'USD'
  bankCode?: number
}

function esNotFound(err: unknown): boolean {
  return err instanceof BancoCentralError && err.status === 404
}

function monedaValida(m: string | undefined): 'ARS' | 'USD' {
  return m === 'USD' ? 'USD' : 'ARS'
}

/**
 * Busca un CBU o alias. /persons es una búsqueda GLOBAL — devuelve cualquier
 * cuenta (ARS o USD) que matchee, con su `moneda` real — así que alcanza como
 * primer intento. Se mantiene el reintento contra /accounts por las dudas
 * (algún caso no cubierto por /persons), pero hoy no debería hacer falta.
 */
export async function buscarDestinatarioBC(input: string, esCBU: boolean): Promise<BCDestinatario> {
  try {
    const persona = esCBU ? await buscarPorCBU(input) : await buscarPorAlias(input)
    return {
      nombre: persona.nombre,
      apellido: persona.apellido,
      dni: persona.dni ?? null,
      cbu: persona.cbu,
      alias: persona.alias ?? null,
      moneda: monedaValida(persona.moneda),
      bankCode: persona.bankCode,
    }
  } catch (err) {
    if (!esNotFound(err)) throw err
  }

  const cuenta = esCBU ? await buscarCuentaPorCBU(input) : await buscarCuentaPorAlias(input)
  return {
    nombre: cuenta.nombre,
    apellido: cuenta.apellido,
    dni: cuenta.dni ?? null,
    cbu: cuenta.cbu,
    alias: cuenta.alias,
    moneda: monedaValida(cuenta.moneda),
    bankCode: cuenta.bankCode,
  }
}

const MI_BANK_CODE_KEY = 'monix_bank_code_v1'
let miBankCodeCache: number | null = null

/**
 * bankCode de Monix en este entorno de test — no existe un endpoint "quién
 * soy" en la API, así que se resuelve una sola vez consultando una cuenta
 * propia conocida (GET /persons/{cbu} es una búsqueda global y devuelve el
 * bankCode real del dueño del CBU, sea quien sea) y se cachea: no cambia
 * mientras no se re-registre el banco con otra api-key. Confirmado con curl
 * real contra test (21 sep 2026): nuestra api-key resuelve a bankCode 3
 * ("Monix1" en GET /banks — hay otro bankCode 2 registrado como "Monix" a
 * secas, de otra sesión/alumno, así que buscar por nombre no sirve).
 */
export async function obtenerMiBankCode(cbuPropio: string): Promise<number | null> {
  if (miBankCodeCache != null) return miBankCodeCache
  const stored = localStorage.getItem(MI_BANK_CODE_KEY)
  if (stored) {
    miBankCodeCache = Number(stored)
    return miBankCodeCache
  }
  try {
    const persona = await buscarPorCBU(cbuPropio)
    if (typeof persona.bankCode === 'number') {
      miBankCodeCache = persona.bankCode
      localStorage.setItem(MI_BANK_CODE_KEY, String(persona.bankCode))
      return miBankCodeCache
    }
  } catch {
    // Sin red o CBU inválido: se reintenta la próxima vez, no se cachea nada.
  }
  return null
}

// Central de deudores: situación crediticia real de la persona, usada por
// Préstamos para tasa, monto máximo y aprobación. situacion 1 = Normal, 2 =
// riesgo bajo/seguimiento especial, 3-5 = con problemas / insolvencia /
// irrecuperable. Dato compartido entre bancos: lo informa cada banco
// acreedor, cualquiera puede consultarlo por DNI.

export interface BCDeuda {
  entidad: string
  monto: number
  situacion: number
}

export interface BCSituacionCrediticia {
  dni: string
  situacion: number
  deudas: BCDeuda[]
}

export async function consultarSituacion(dni: string): Promise<BCSituacionCrediticia> {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/central-deudores/${dni}`, { headers: HEADERS })
    return await handleResponse<BCSituacionCrediticia>(res, 'GET /central-deudores/:dni')
  } catch (err) {
    // 404 = ningún banco informó deudas para ese DNI. Se interpreta como
    // situación 1 (sin antecedentes negativos) — supuesto de negocio pendiente
    // de confirmar con el cliente, ver plan de cuentas multi-moneda.
    if (esNotFound(err)) return { dni, situacion: 1, deudas: [] }
    throw err
  }
}

/**
 * Informa al Banco Central la situación crediticia que Monix le asigna a un
 * cliente (POST /central-deudores) — un banco tiene un solo informe activo
 * por DNI, volver a llamar pisa el anterior. Se usa una sola vez al
 * registrarse (ver RegisterPage.tsx); la persona puede tener deudas
 * informadas por otros bancos del curso también, GET agrega todas.
 */
export async function informarSituacionCrediticia(
  dni: string,
  monto: number,
  situacion: number,
): Promise<BCSituacionCrediticia> {
  const res = await fetchWithTimeout(`${BASE_URL}/central-deudores`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ dni, monto, situacion }),
  })
  return handleResponse<BCSituacionCrediticia>(res, 'POST /central-deudores')
}
