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

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(`[${res.status}] ${body.message ?? res.statusText}`)
  }
  return res.json() as Promise<T>
}

export interface BCPersona {
  cbu: string
  nombre: string
  apellido: string
  dni: string
  // No documentado en el schema de GET /persons/{cbu} y /persons/alias/{alias},
  // pero POST /persons sí lo devuelve cuando el DNI ya estaba registrado.
  alias?: string | null
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
  return handleResponse<BCPersona>(res)
}

export async function buscarPorCBU(cbu: string): Promise<BCPersona> {
  const res = await fetchWithTimeout(`${BASE_URL}/persons/${cbu}`, { headers: HEADERS })
  return handleResponse<BCPersona>(res)
}

export async function buscarPorAlias(alias: string): Promise<BCPersona> {
  const res = await fetchWithTimeout(`${BASE_URL}/persons/alias/${encodeURIComponent(alias)}`, {
    headers: HEADERS,
  })
  return handleResponse<BCPersona>(res)
}

export async function asignarAlias(cbu: string, alias: string): Promise<BCPersona> {
  const res = await fetchWithTimeout(`${BASE_URL}/persons/${cbu}/alias`, {
    method: 'PUT',
    headers: HEADERS,
    body: JSON.stringify({ alias }),
  })
  return handleResponse<BCPersona>(res)
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
  return handleResponse<BCTransaccion>(res)
}

export async function listarTransacciones(minutos: number): Promise<BCTransaccionEntrante[]> {
  const res = await fetchWithTimeout(`${BASE_URL}/transactions?minutos=${minutos}`, { headers: HEADERS })
  return handleResponse<BCTransaccionEntrante[]>(res)
}

export interface BCBank {
  bankCode: number
  name: string
}

export async function getBankName(bankCode: number): Promise<string> {
  const res = await fetchWithTimeout(`${BASE_URL}/banks/${bankCode}`, { headers: HEADERS })
  const bank = await handleResponse<BCBank>(res)
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
}

export async function abrirCuenta(dni: string, moneda: 'ARS' | 'USD'): Promise<BCCuenta> {
  const res = await fetchWithTimeout(`${BASE_URL}/accounts`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ dni, moneda }),
  })
  return handleResponse<BCCuenta>(res)
}

export async function asignarAliasCuenta(cbu: string, alias: string): Promise<BCCuenta> {
  const res = await fetchWithTimeout(`${BASE_URL}/accounts/${cbu}/alias`, {
    method: 'PUT',
    headers: HEADERS,
    body: JSON.stringify({ alias }),
  })
  return handleResponse<BCCuenta>(res)
}

export async function buscarCuentaPorCBU(cbu: string): Promise<BCCuenta> {
  const res = await fetchWithTimeout(`${BASE_URL}/accounts/${cbu}`, { headers: HEADERS })
  return handleResponse<BCCuenta>(res)
}

export async function buscarCuentaPorAlias(alias: string): Promise<BCCuenta> {
  const res = await fetchWithTimeout(`${BASE_URL}/accounts/alias/${encodeURIComponent(alias)}`, {
    headers: HEADERS,
  })
  return handleResponse<BCCuenta>(res)
}

export interface BCDestinatario {
  nombre: string
  apellido: string
  dni: string
  cbu: string
  alias: string | null
  moneda: 'ARS' | 'USD'
}

function esNotFound(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith('[404]')
}

/**
 * Busca un CBU o alias probando primero /persons (cuenta en ARS) y, si no
 * aparece ahí, reintenta contra /accounts (cuenta en otra moneda). Los cuatro
 * endpoints de búsqueda del Banco Central no tienen schema de respuesta
 * documentado — validar campos reales contra `test` si algo no calza.
 */
export async function buscarDestinatarioBC(input: string, esCBU: boolean): Promise<BCDestinatario> {
  try {
    const persona = esCBU ? await buscarPorCBU(input) : await buscarPorAlias(input)
    return {
      nombre: persona.nombre,
      apellido: persona.apellido,
      dni: persona.dni,
      cbu: persona.cbu,
      alias: persona.alias ?? null,
      moneda: 'ARS',
    }
  } catch (err) {
    if (!esNotFound(err)) throw err
  }

  const cuenta = esCBU ? await buscarCuentaPorCBU(input) : await buscarCuentaPorAlias(input)
  return {
    nombre: cuenta.nombre,
    apellido: cuenta.apellido,
    dni: cuenta.dni,
    cbu: cuenta.cbu,
    alias: cuenta.alias,
    moneda: cuenta.moneda,
  }
}

// --- Central de deudores: usada para decidir si una persona puede abrir una
// caja de ahorro en USD. situacion 1 = Normal, 2 = riesgo bajo/seguimiento
// especial, 3-5 = con problemas / insolvencia / irrecuperable. Es un dato
// compartido entre bancos: lo informa cada banco acreedor y cualquiera puede
// consultarlo por DNI.

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
    return await handleResponse<BCSituacionCrediticia>(res)
  } catch (err) {
    // 404 = ningún banco informó deudas para ese DNI. Se interpreta como
    // situación 1 (sin antecedentes negativos) — supuesto de negocio pendiente
    // de confirmar con el cliente, ver plan de cuentas multi-moneda.
    if (esNotFound(err)) return { dni, situacion: 1, deudas: [] }
    throw err
  }
}

export async function esAptoParaUSD(dni: string): Promise<boolean> {
  const { situacion } = await consultarSituacion(dni)
  return situacion === 1 || situacion === 2
}
