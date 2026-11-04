import { supabase } from '../lib/supabaseClient'
import { esModoPrueba, gastosPrueba, movimientosPrueba } from '../lib/modoPrueba'
import { resumenGastos } from '../utils/gastos'
import type { Cuenta, Movimiento } from '../types'

export interface GastosDelMes {
  total: number
  mayorCategoria: string | null
  mayorTotal: number
}

/** Lo que Moni necesita para contestar "¿en qué gasté más?": el mes en curso, en pesos. */
export async function cargarGastosDelMes(cuentas: Cuenta[]): Promise<GastosDelMes | null> {
  const hoy = new Date()
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const pesos = cuentas.filter((c) => c.moneda === 'ARS').map((c) => c.id)

  let movimientos: Movimiento[]
  if (esModoPrueba()) {
    movimientos = [...gastosPrueba(), ...movimientosPrueba()]
  } else {
    if (pesos.length === 0) return null
    const { data, error } = await supabase
      .from('movimientos')
      .select('*')
      .in('cuenta_id', pesos)
      .gte('created_at', inicio.toISOString())
    if (error) throw error
    movimientos = ((data as Omit<Movimiento, 'moneda'>[]) ?? []).map((m) => ({ ...m, moneda: 'ARS' }))
  }

  const propias = new Set(cuentas.map((c) => c.id))
  const { total, categorias } = resumenGastos(movimientos, propias, hoy.getFullYear(), hoy.getMonth())
  return { total, mayorCategoria: categorias[0]?.categoria ?? null, mayorTotal: categorias[0]?.total ?? 0 }
}
