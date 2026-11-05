// npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CUENTA_PRUEBA_ARS_ID as ARS,
  CUENTA_PRUEBA_USD_ID as USD,
  convertirMoneda,
  destinoEjemplo,
  moverReserva,
  pedirPrestamo,
  simularMes,
  transferir,
} from '../../src/utils/bancoSimulado.ts'
import { categoriaDeGasto } from '../../src/utils/gastos.ts'

const inicial = () => ({ saldoArs: 100000, saldoUsd: 50, saldoReserva: 20000, movimientos: [], prestamos: [] })
const PROPIAS = new Set([ARS, USD])

test('reservas: ingresar y retirar mueven los dos saldos y dejan movimiento', () => {
  const a = moverReserva(inicial(), 'ingresar', 10000)
  assert.equal(a.saldoArs, 90000)
  assert.equal(a.saldoReserva, 30000)
  assert.equal(a.movimientos[0].tipo, 'extraccion')
  const b = moverReserva(a, 'retirar', 5000)
  assert.equal(b.saldoArs, 95000)
  assert.equal(b.saldoReserva, 25000)
  assert.equal(b.movimientos[0].tipo, 'deposito')
  assert.equal(b.movimientos.length, 2)
})

test('no se puede mover más de lo que hay ni un monto inválido', () => {
  assert.throws(() => moverReserva(inicial(), 'ingresar', 100001), /Saldo insuficiente/)
  assert.throws(() => moverReserva(inicial(), 'retirar', 20001), /Saldo insuficiente/)
  assert.throws(() => moverReserva(inicial(), 'ingresar', -1), /Monto inválido/)
  assert.throws(() => moverReserva(inicial(), 'ingresar', NaN), /Monto inválido/)
  assert.throws(() => convertirMoneda(inicial(), 'comprar', 100, 157000, 'x'), /Saldo insuficiente/)
  assert.throws(() => convertirMoneda(inicial(), 'vender', 51, 1000, 'x'), /Saldo insuficiente/)
  assert.throws(() => transferir(inicial(), { moneda: 'ARS', monto: 100001, descripcion: 'x', nombre: 'a', apellido: 'b', dni: null, cbu: '1', alias: null }), /Saldo insuficiente/)
})

test('un error no cambia el estado', () => {
  const e = inicial()
  assert.throws(() => moverReserva(e, 'ingresar', 999999))
  assert.deepEqual(e, inicial())
})

test('dólares: comprar y vender dejan un movimiento por moneda', () => {
  const a = convertirMoneda(inicial(), 'comprar', 10, 15700, 'Compra de USD|Cotización')
  assert.equal(a.saldoArs, 84300)
  assert.equal(a.saldoUsd, 60)
  assert.deepEqual(a.movimientos.map((m) => [m.moneda, m.tipo]), [['ARS', 'extraccion'], ['USD', 'deposito']])
  const b = convertirMoneda(a, 'vender', 5, 7600, 'Venta de USD|Cotización')
  assert.equal(b.saldoArs, 91900)
  assert.equal(b.saldoUsd, 55)
  assert.deepEqual(b.movimientos.slice(0, 2).map((m) => [m.moneda, m.tipo]), [['ARS', 'deposito'], ['USD', 'extraccion']])
})

test('préstamo: acredita el dinero y queda activo sin cuotas pagas', () => {
  const a = pedirPrestamo(inicial(), { monto: 500000, cuotas: 6, cuota: 105168, tna: 73, sueldoAcreditado: true })
  assert.equal(a.saldoArs, 600000)
  assert.equal(a.prestamos[0].estado, 'activo')
  assert.equal(a.prestamos[0].cuotas_pagadas, 0)
  assert.equal(a.movimientos[0].descripcion, 'Préstamo otorgado')
})

test('simular un mes: acredita intereses en las tres bolsas y cobra la cuota', () => {
  const a = pedirPrestamo(inicial(), { monto: 500000, cuotas: 2, cuota: 1000, tna: 73, sueldoAcreditado: true })
  const { estado, resumen } = simularMes(a)
  assert.ok(estado.saldoReserva > 20000)
  assert.ok(estado.saldoUsd > 50)
  assert.equal(resumen.cuotasPagadas, 1)
  assert.equal(estado.prestamos[0].cuotas_pagadas, 1)
  assert.ok(estado.movimientos.some((m) => m.descripcion === 'Cuota préstamo 1/2'))
  assert.ok(estado.movimientos.some((m) => m.descripcion === 'Rendimiento de Reserva'))
  // 600000 al 32% anual durante 30 días, menos la cuota.
  const esperado = 600000 * Math.pow(1 + 0.32 / 365, 30) - 1000
  assert.ok(Math.abs(estado.saldoArs - esperado) < 0.02)
})

test('el préstamo termina al pagar la última cuota y deja de cobrarse', () => {
  let e = pedirPrestamo(inicial(), { monto: 1000, cuotas: 2, cuota: 600, tna: 73, sueldoAcreditado: true })
  e = simularMes(e).estado
  e = simularMes(e).estado
  assert.equal(e.prestamos[0].estado, 'pagado')
  const { resumen } = simularMes(e)
  assert.equal(resumen.cuotasPagadas, 0)
})

test('sin saldo la cuota queda atrasada y no deja la cuenta en negativo', () => {
  const sinSaldo = { ...inicial(), saldoArs: 10 }
  const a = pedirPrestamo(sinSaldo, { monto: 100, cuotas: 3, cuota: 5000, tna: 73, sueldoAcreditado: true })
  const { estado, resumen } = simularMes(a)
  assert.equal(resumen.cuotasAtrasadas, 1)
  assert.equal(estado.prestamos[0].cuotas_pagadas, 0)
  assert.ok(estado.saldoArs >= 0)
})

test('las estadísticas clasifican bien lo simulado', () => {
  const dest = { nombre: 'María', apellido: 'Gómez', dni: null, cbu: '1', alias: null }
  let e = moverReserva(inicial(), 'ingresar', 100)
  assert.equal(categoriaDeGasto(e.movimientos[0], PROPIAS), null)
  e = convertirMoneda(inicial(), 'comprar', 1, 1570, 'Compra de USD|Cotización')
  assert.equal(categoriaDeGasto(e.movimientos[0], PROPIAS), null)
  e = transferir(inicial(), { ...dest, moneda: 'ARS', monto: 100, descripcion: 'Alquiler|Marzo' })
  assert.equal(categoriaDeGasto(e.movimientos[0], PROPIAS), 'Vivienda')
  e = simularMes(pedirPrestamo(inicial(), { monto: 1000, cuotas: 2, cuota: 600, tna: 73, sueldoAcreditado: true })).estado
  const cuota = e.movimientos.find((m) => m.descripcion.startsWith('Cuota'))
  assert.equal(categoriaDeGasto(cuota, PROPIAS), 'Finanzas')
})

test('los destinos de ejemplo se encuentran por alias o CBU, sin distinguir mayúsculas', () => {
  assert.equal(destinoEjemplo(' Maria.Gomez.Monix ').nombre, 'María')
  assert.equal(destinoEjemplo('0000003100022222222223').nombre, 'Juan')
  assert.equal(destinoEjemplo('nadie.monix'), null)
})
