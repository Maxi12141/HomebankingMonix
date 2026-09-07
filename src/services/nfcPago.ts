import { supabase } from '../lib/supabaseClient'
import { rpcMessage } from '../lib/tokens'

export interface CobroNfc {
  id: string
  monto: number
  descripcion: string | null
  estado: 'pendiente' | 'pagado' | 'expirado' | 'cancelado'
  expires_at: string
  comercio_nombre: string
  comercio_apellido: string
  comercio_alias: string | null
  moneda: 'ARS' | 'USD'
}

function mapCobro(row: Record<string, unknown>): CobroNfc {
  return {
    id: String(row.id),
    monto: Number(row.monto),
    descripcion: (row.descripcion as string | null) ?? null,
    estado: row.estado as CobroNfc['estado'],
    expires_at: String(row.expires_at),
    comercio_nombre: String(row.comercio_nombre ?? ''),
    comercio_apellido: String(row.comercio_apellido ?? ''),
    comercio_alias: (row.comercio_alias as string | null) ?? null,
    moneda: row.moneda === 'USD' ? 'USD' : 'ARS',
  }
}

export async function registrarTarjetaNfc(cuentaId: string, token: string) {
  const { error } = await supabase.rpc('registrar_tarjeta_nfc', {
    p_cuenta_id: cuentaId,
    p_token: token,
  })
  if (error) throw new Error(rpcMessage(error, 'No se pudo grabar el chip'))
}

export async function generarCriptogramaNfc(cuentaId: string, token: string) {
  const { error } = await supabase.rpc('generar_criptograma_nfc', {
    p_cuenta_id: cuentaId,
    p_token: token,
  })
  if (error) throw new Error(rpcMessage(error, 'No se pudo generar el pago contactless'))
}

export async function crearCobroNfc(cuentaId: string, monto: number, descripcion: string) {
  const { data, error } = await supabase.rpc('crear_cobro_nfc', {
    p_cuenta_id: cuentaId,
    p_monto: monto,
    p_descripcion: descripcion,
  })
  if (error) throw new Error(rpcMessage(error, 'No se pudo crear el cobro'))
  return String(data)
}

export async function obtenerCobroNfc(cobroId: string): Promise<CobroNfc> {
  const { data, error } = await supabase.rpc('obtener_cobro_nfc', { p_cobro_id: cobroId })
  if (error) throw new Error(rpcMessage(error, 'No se pudo leer el cobro'))
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error('No encontramos ese cobro')
  return mapCobro(row as Record<string, unknown>)
}

export async function cancelarCobroNfc(cobroId: string) {
  const { error } = await supabase.rpc('cancelar_cobro_nfc', { p_cobro_id: cobroId })
  if (error) throw new Error(rpcMessage(error, 'No se pudo cancelar el cobro'))
}

export async function pagarCobroNfc(cobroId: string, secreto: string) {
  const { error } = await supabase.rpc('pagar_cobro_nfc', {
    p_cobro_id: cobroId,
    p_secreto: secreto,
  })
  if (error) throw new Error(rpcMessage(error, 'No se pudo completar el pago'))
}

export async function setTarjetaFlags(
  cuentaId: string,
  flags: { tarjeta_congelada?: boolean; nfc_contacto_activo?: boolean },
) {
  const { error } = await supabase.from('cuentas').update(flags).eq('id', cuentaId)
  if (error) throw new Error(rpcMessage(error, 'No se pudo actualizar la tarjeta'))
}
