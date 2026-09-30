import { supabase } from '../lib/supabaseClient'
import { rpcMessage } from '../lib/tokens'

export type EstadoAhora = 'pendiente' | 'pagado' | 'rechazado' | 'vencido' | 'cancelado'

export interface CobroAhora {
  id: string
  nombre: string
  apellido: string
  alias: string | null
  monto: number
  moneda: 'ARS'
  concepto: string | null
  estado: EstadoAhora
  expires_at: string
}

export interface PersonaAhora {
  nombre: string
  apellido: string
  alias: string
}

function asCobro(raw: unknown): CobroAhora | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (typeof row.id !== 'string') return null
  return {
    id: row.id,
    nombre: String(row.nombre ?? ''),
    apellido: String(row.apellido ?? ''),
    alias: row.alias == null ? null : String(row.alias),
    monto: Number(row.monto),
    moneda: 'ARS',
    concepto: row.concepto == null ? null : String(row.concepto),
    estado: String(row.estado ?? 'pendiente') as EstadoAhora,
    expires_at: String(row.expires_at ?? ''),
  }
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(rpcMessage(error, 'No se pudo completar el cobro'))
  return data as T
}

export async function buscarPersonaAhora(alias: string): Promise<PersonaAhora> {
  const data = await rpc<PersonaAhora>('buscar_persona_ahora', { p_alias: alias })
  return {
    nombre: data.nombre,
    apellido: data.apellido,
    alias: data.alias,
  }
}

export async function crearCobroAhora(alias: string, monto: number, concepto: string) {
  const data = await rpc<unknown>('crear_cobro_ahora', {
    p_alias: alias,
    p_monto: monto,
    p_concepto: concepto,
  })
  const cobro = asCobro(data)
  if (!cobro) throw new Error('No se pudo armar el cobro')
  return cobro
}

export async function cobrosEntrantes(): Promise<CobroAhora[]> {
  const data = await rpc<unknown[]>('cobros_ahora_entrantes')
  if (!Array.isArray(data)) return []
  return data.map(asCobro).filter((row): row is CobroAhora => row != null)
}

export async function miCobroAhora(): Promise<CobroAhora | null> {
  const data = await rpc<unknown>('mi_cobro_ahora')
  return asCobro(data)
}

export async function pagarCobroAhora(id: string) {
  const data = await rpc<unknown>('pagar_cobro_ahora', { p_id: id })
  const cobro = asCobro(data)
  if (!cobro) throw new Error('No se pudo pagar')
  return cobro
}

export async function rechazarCobroAhora(id: string) {
  await rpc('rechazar_cobro_ahora', { p_id: id })
}

export async function cancelarCobroAhora(id: string) {
  await rpc('cancelar_cobro_ahora', { p_id: id })
}
