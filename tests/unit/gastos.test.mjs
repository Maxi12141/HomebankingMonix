// npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { categoriaDeGasto, resumenGastos } from '../../src/utils/gastos.ts'

const PROPIAS = new Set(['ars', 'usd'])
const mov = (descripcion, monto = 100, extra = {}) => ({
  moneda: 'ARS',
  tipo: 'transferencia_salida',
  monto,
  descripcion,
  cuenta_destino_id: null,
  created_at: new Date(2026, 10, 15, 12).toISOString(),
  ...extra,
})
const categoria = (...args) => categoriaDeGasto(mov(...args), PROPIAS)

test('el motivo de la transferencia define la categoría, aunque tenga mensaje', () => {
  assert.equal(categoria('Alquiler'), 'Vivienda')
  assert.equal(categoria('Alquiler|Noviembre'), 'Vivienda')
  assert.equal(categoria('Viajes'), 'Transporte y viajes')
  assert.equal(categoria('Honorarios'), 'Pagos de trabajo')
  assert.equal(categoria('Regalo'), 'Regalos y compartidos')
  assert.equal(categoria('Comisiones'), 'Compras y servicios')
})

test('los gastos propios de la app tienen su categoría', () => {
  assert.equal(categoria('mercadoMONIX|Auriculares x1', 100, { tipo: 'extraccion' }), 'Compras y servicios')
  assert.equal(categoria('Pago QR|QR Monix'), 'Pagos con QR')
  assert.equal(categoria('Cuota préstamo 1/6', 100, { tipo: 'extraccion' }), 'Finanzas')
})

test('sin motivo conocido va a Varios', () => {
  assert.equal(categoria('Supermercado del barrio'), 'Varios')
  assert.equal(categoria(null), 'Varios')
})

test('mover dinero entre lo propio no es un gasto', () => {
  assert.equal(categoria('Reserva|Ingreso a ahorro MONIX', 100, { tipo: 'extraccion' }), null)
  assert.equal(categoria('Meta común|Aporte a Viaje', 100, { tipo: 'extraccion' }), null)
  assert.equal(categoria('Compra de USD|Cotización oficial', 100, { tipo: 'extraccion' }), null)
  assert.equal(categoria('Varios', 100, { cuenta_destino_id: 'usd' }), null)
})

test('lo que entra y lo que está en dólares no cuenta', () => {
  assert.equal(categoria('Varios', 100, { tipo: 'deposito' }), null)
  assert.equal(categoria('Varios', 100, { tipo: 'transferencia_entrada' }), null)
  assert.equal(categoria('Varios', 100, { moneda: 'USD' }), null)
})

test('el resumen suma sólo ese mes y ordena de mayor a menor', () => {
  const otroMes = { created_at: new Date(2026, 9, 31, 12).toISOString() }
  const r = resumenGastos(
    [mov('Compra', 300), mov('Alquiler', 500), mov('Expensas', 200), mov('Alquiler', 9999, otroMes), mov('Reserva|x', 7777)],
    PROPIAS,
    2026,
    10,
  )
  assert.equal(r.total, 1000)
  assert.deepEqual(r.categorias.map((c) => [c.categoria, c.total, c.porcentaje]), [
    ['Vivienda', 700, 70],
    ['Compras y servicios', 300, 30],
  ])
})

test('un mes sin gastos da cero', () => {
  assert.deepEqual(resumenGastos([], PROPIAS, 2026, 10), { total: 0, categorias: [] })
})
