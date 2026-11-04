import { supabase } from '../lib/supabaseClient'
import { esModoPrueba, gastosPrueba, movimientosPrueba } from '../lib/modoPrueba'
import { resumenGastos } from '../utils/gastos'
import type { GastosDelMes } from '../utils/respuestaGastos'
import type { Cuenta, Movimiento } from '../types'

export type { GastosDelMes }

/** Lo que Moni necesita para contestar sobre gastos: este mes y el anterior, en pesos. */
export async function cargarGastosDelMes(cuentas: Cuenta[]): Promise<GastosDelMes | null> {
  const hoy = new Date()
  const anterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
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
      .gte('created_at', anterior.toISOString())
    if (error) throw error
    movimientos = ((data as Omit<Movimiento, 'moneda'>[]) ?? []).map((m) => ({ ...m, moneda: 'ARS' }))
  }

  const propias = new Set(cuentas.map((c) => c.id))
  const { total, categorias } = resumenGastos(movimientos, propias, hoy.getFullYear(), hoy.getMonth())
  const previo = resumenGastos(movimientos, propias, anterior.getFullYear(), anterior.getMonth())
  return {
    total,
    categorias: categorias.map(({ categoria, total: t, porcentaje }) => ({ categoria, total: t, porcentaje })),
    totalMesAnterior: previo.total,
  }
}
