import { supabase } from '../lib/supabaseClient'
import { esModoPrueba } from '../lib/modoPrueba'
import { estadoPrueba, reservaPrueba } from '../lib/estadoPrueba'
import { estimacionDiaria } from '../hooks/useReserva'
import { calcularOferta } from '../utils/prestamos'
import { cargarGastosDelMes } from './gastos'
import { listarMetasComunes } from './metasComunes'
import { getDolares } from './mercadoFinanciero'
import type { AsistenteCtx, MovimientoCtx, PrestamoCtx } from './asistenteConocimiento'
import type { Cuenta, Movimiento, Persona, Prestamo, Reserva } from '../types'

// Lo que Moni necesita saber de la persona para contestar con números. Todo es de solo lectura;
// lo que no se pueda leer queda sin definir y Moni lo dice en vez de inventarlo.

const MAX_MOVIMIENTOS = 300

function aMovimientoCtx(m: Movimiento): MovimientoCtx {
  const contraparte = [m.destinatario_nombre, m.destinatario_apellido].filter(Boolean).join(' ').trim()
  return {
    tipo: m.tipo,
    moneda: m.moneda,
    monto: Number(m.monto),
    motivo: (m.descripcion ?? '').split('|')[0].trim(),
    contraparte: contraparte || null,
    fecha: m.created_at,
  }
}

function aPrestamoCtx(p: Prestamo): PrestamoCtx {
  return {
    monto: Number(p.monto),
    cuotasTotales: p.cuotas_totales,
    cuotasPagadas: p.cuotas_pagadas,
    cuotaMonto: Number(p.cuota_monto),
    proximaCuota: p.proxima_cuota_at,
    estado: p.estado,
  }
}

async function leerMovimientos(cuentas: Cuenta[]): Promise<MovimientoCtx[]> {
  if (esModoPrueba()) return estadoPrueba().movimientos.map(aMovimientoCtx)
  if (cuentas.length === 0) return []
  const moneda = new Map(cuentas.map((c) => [c.id, c.moneda]))
  const { data, error } = await supabase
    .from('movimientos')
    .select('*')
    .in('cuenta_id', cuentas.map((c) => c.id))
    .order('created_at', { ascending: false })
    .limit(MAX_MOVIMIENTOS)
  if (error) throw error
  return ((data as Omit<Movimiento, 'moneda'>[]) ?? []).map((m) =>
    aMovimientoCtx({ ...m, moneda: moneda.get(m.cuenta_id) ?? 'ARS' }),
  )
}

async function leerReserva(cuentaId: string): Promise<Reserva | null> {
  if (esModoPrueba()) return reservaPrueba()
  const { data, error } = await supabase.rpc('preparar_reserva', { p_cuenta_id: cuentaId })
  if (error) throw error
  return (data as { reserva: Reserva }).reserva ?? null
}

async function leerPrestamos(cuentaId: string): Promise<PrestamoCtx[]> {
  if (esModoPrueba()) return estadoPrueba().prestamos.map(aPrestamoCtx)
  const { data, error } = await supabase
    .from('prestamos')
    .select('*')
    .eq('cuenta_id', cuentaId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as Prestamo[]).map(aPrestamoCtx)
}

async function leerDolarOficial() {
  const oficial = (await getDolares()).find((d) => d.casa === 'oficial')
  return oficial ? { compra: oficial.compra, venta: oficial.venta } : null
}

function ofertaDe(persona: Persona | null): AsistenteCtx['oferta'] {
  if (!persona || persona.situacion_crediticia_monix == null || !persona.ingreso_mensual) return null
  const o = calcularOferta(persona.situacion_crediticia_monix, persona.sueldo_acreditado)
  return o.montoMax > 0 ? { montoMax: o.montoMax, cuotasMax: o.cuotasMax, tna: o.tna } : null
}

function ok<T>(r: PromiseSettledResult<T>): T | undefined {
  if (r.status === 'fulfilled') return r.value
  console.error('Moni no pudo leer un dato:', r.reason)
  return undefined
}

export async function cargarDatosMoni(cuentas: Cuenta[], persona: Persona | null): Promise<Partial<AsistenteCtx>> {
  const pesos = cuentas.find((c) => c.moneda === 'ARS')
  const [gastos, movimientos, reserva, prestamos, metas, dolar] = await Promise.allSettled([
    cargarGastosDelMes(cuentas),
    leerMovimientos(cuentas),
    pesos ? leerReserva(pesos.id) : Promise.resolve(null),
    pesos ? leerPrestamos(pesos.id) : Promise.resolve([] as PrestamoCtx[]),
    esModoPrueba() ? Promise.resolve([]) : listarMetasComunes(),
    leerDolarOficial(),
  ])

  const r = ok(reserva)
  const datos: Partial<AsistenteCtx> = {
    gastosMes: ok(gastos),
    movimientos: ok(movimientos),
    prestamos: ok(prestamos),
    metas: ok(metas),
    dolarOficial: ok(dolar),
    oferta: ofertaDe(persona),
    tarjetaCongelada: pesos ? Boolean(pesos.tarjeta_congelada) : undefined,
  }
  if (reserva.status === 'fulfilled') {
    datos.saldoReserva = r ? Number(r.saldo) : 0
    datos.tasaReserva = r ? Number(r.tasa_anual) : null
    datos.interesDiarioReserva = r ? estimacionDiaria(Number(r.saldo), Number(r.tasa_anual)) : null
  } else {
    ok(reserva)
  }
  return datos
}
