const BASE_URL = import.meta.env.VITE_BC_URL as string
const TIMEOUT_MS = 10_000

const HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
  'x-api-key': import.meta.env.VITE_BC_API_KEY as string,
  'x-environment': import.meta.env.VITE_BC_ENV as string,
}

function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer))
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
