const DOLARAPI_URL = 'https://dolarapi.com/v1'
const ARGENTINADATOS_URL = 'https://api.argentinadatos.com/v1'
const TIMEOUT_MS = 8_000

function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer))
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`[${res.status}] ${res.statusText}`)
  return res.json() as Promise<T>
}

export interface CotizacionDolar {
  moneda: string
  casa: string
  nombre: string
  compra: number
  venta: number
  fechaActualizacion: string
}

/** Dólar oficial, blue, MEP (bolsa), CCL, mayorista, cripto y tarjeta — fuente: dolarapi.com */
export async function getDolares(): Promise<CotizacionDolar[]> {
  const res = await fetchWithTimeout(`${DOLARAPI_URL}/dolares`)
  return handleResponse<CotizacionDolar[]>(res)
}

export interface PrestamoPersonal {
  entidad: string
  tna: number
  tea: number
  moneda: string
}

/** TNA/TEA de préstamos personales por banco real — fuente: argentinadatos.com */
export async function getPrestamosPersonales(): Promise<PrestamoPersonal[]> {
  const res = await fetchWithTimeout(`${ARGENTINADATOS_URL}/finanzas/creditos/prestamosPersonales`)
  return handleResponse<PrestamoPersonal[]>(res)
}
