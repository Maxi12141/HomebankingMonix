import { supabase } from '../lib/supabaseClient'
import { rpcMessage } from '../lib/tokens'

export interface PersonaCerca {
  nombre: string
  apellido: string
  alias: string | null
  token: string
  rssi?: number
}

export interface DestinoCerca {
  nombre: string
  apellido: string
  alias: string | null
  cbu: string
  cuenta_id: string
  moneda: 'ARS' | 'USD'
}

export async function activarPresencia(cuentaId: string, token: string) {
  const { error } = await supabase.rpc('activar_presencia', {
    p_cuenta_id: cuentaId,
    p_token: token,
  })
  if (error) throw new Error(rpcMessage(error, 'No se pudo activar Monix Cerca'))
}

export async function desactivarPresencia() {
  const { error } = await supabase.rpc('desactivar_presencia')
  if (error) throw new Error(rpcMessage(error, 'No se pudo desactivar Monix Cerca'))
}

export async function resolverPresencia(token: string): Promise<PersonaCerca | null> {
  const { data, error } = await supabase.rpc('resolver_presencia', { p_token: token })
  if (error) throw new Error(rpcMessage(error, 'No se pudo identificar a la persona'))
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.nombre) return null
  return {
    nombre: row.nombre,
    apellido: row.apellido,
    alias: row.alias ?? null,
    token,
  }
}

export async function abrirDestinoCerca(token: string): Promise<DestinoCerca> {
  const { data, error } = await supabase.rpc('abrir_destino_cerca', { p_token: token })
  if (error) throw new Error(rpcMessage(error, 'No se pudo abrir la transferencia'))
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.cbu) throw new Error('La persona ya no está visible cerca')
  return {
    nombre: row.nombre,
    apellido: row.apellido,
    alias: row.alias ?? null,
    cbu: row.cbu,
    cuenta_id: row.cuenta_id,
    moneda: row.moneda === 'USD' ? 'USD' : 'ARS',
  }
}

export async function presenciaPropia() {
  const { data, error } = await supabase
    .from('presencia_cerca')
    .select('visible, expires_at, last_seen_at, cuenta_id')
    .maybeSingle()
  if (error) throw new Error(rpcMessage(error, 'No se pudo leer el estado de Cerca'))
  return data as {
    visible: boolean
    expires_at: string
    last_seen_at: string
    cuenta_id: string
  } | null
}
