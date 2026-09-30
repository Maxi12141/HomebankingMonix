import { supabase } from '../lib/supabaseClient'
import { rpcMessage } from '../lib/tokens'
import { buscarDestinatarioBC, codigoBancoDesdeCbu, nombreBanco } from './bancoCentral'

export interface PersonaCerca {
  nombre: string
  apellido: string
  alias: string | null
  token: string
  banco: string
  cbu?: string
  cuentaId?: string
  rssi?: number
  metros?: number
}

export interface DestinoCerca {
  nombre: string
  apellido: string
  alias: string | null
  cbu: string
  cuenta_id: string
  moneda: 'ARS' | 'USD'
}

export type CoordsCerca = { lat: number; lng: number }

export async function leerUbicacion(): Promise<CoordsCerca | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: Math.round(pos.coords.latitude * 10000) / 10000,
          lng: Math.round(pos.coords.longitude * 10000) / 10000,
        })
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15_000 },
    )
  })
}

export async function activarPresencia(cuentaId: string, token: string, coords?: CoordsCerca | null) {
  const base = { p_cuenta_id: cuentaId, p_token: token }
  let { error } = await supabase.rpc('activar_presencia', coords
    ? { ...base, p_lat: coords.lat, p_lng: coords.lng }
    : base)
  if (error && coords) {
    ({ error } = await supabase.rpc('activar_presencia', base))
  }
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
    banco: 'Monix',
  }
}

export async function resolverPersonaRed(input: string, esCBU: boolean): Promise<PersonaCerca | null> {
  try {
    const dest = await buscarDestinatarioBC(input, esCBU)
    const code = dest.bankCode ?? codigoBancoDesdeCbu(dest.cbu)
    const banco = code != null ? await nombreBanco(code) : 'Otro banco'
    return {
      nombre: dest.nombre,
      apellido: dest.apellido,
      alias: dest.alias ?? null,
      token: dest.cbu,
      cbu: dest.cbu,
      banco,
    }
  } catch {
    return null
  }
}

function destinoDesdeRow(row: {
  nombre: string
  apellido: string
  alias: string | null
  cbu: string
  cuenta_id: string
  moneda: string
}): DestinoCerca {
  return {
    nombre: row.nombre,
    apellido: row.apellido,
    alias: row.alias ?? null,
    cbu: row.cbu,
    cuenta_id: row.cuenta_id,
    moneda: row.moneda === 'USD' ? 'USD' : 'ARS',
  }
}

export async function listarVisibles(coords?: CoordsCerca | null): Promise<PersonaCerca[]> {
  const args = coords ? { p_lat: coords.lat, p_lng: coords.lng, p_radio_m: 400 } : {}
  let { data, error } = await supabase.rpc('listar_presencias_visibles', args)
  if (error && coords) {
    ({ data, error } = await supabase.rpc('listar_presencias_visibles'))
  }
  if (error) throw new Error(rpcMessage(error, 'No se pudieron listar las personas visibles'))
  const rows = Array.isArray(data) ? data : data ? [data] : []
  return rows
    .filter((row) => row?.cuenta_id)
    .map((row) => ({
      nombre: row.nombre,
      apellido: row.apellido,
      alias: row.alias ?? null,
      token: String(row.cuenta_id),
      cuentaId: String(row.cuenta_id),
      banco: 'Monix',
      metros: typeof row.metros === 'number' ? row.metros : undefined,
    }))
}

export async function abrirDestinoCerca(token: string): Promise<DestinoCerca> {
  const { data, error } = await supabase.rpc('abrir_destino_cerca', { p_token: token })
  if (error) throw new Error(rpcMessage(error, 'No se pudo abrir la transferencia'))
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.cbu) throw new Error('La persona ya no está visible cerca')
  return destinoDesdeRow(row)
}

export async function abrirDestinoCercaCuenta(cuentaId: string): Promise<DestinoCerca> {
  const { data, error } = await supabase.rpc('abrir_destino_cerca_cuenta', { p_cuenta_id: cuentaId })
  if (error) throw new Error(rpcMessage(error, 'No se pudo abrir la transferencia'))
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.cbu) throw new Error('La persona ya no está visible cerca')
  return destinoDesdeRow(row)
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
