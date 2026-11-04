// npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { respuestaGastos } from '../../src/utils/respuestaGastos.ts'

const fmt = (n) => `$${n}`
const G = {
  total: 1000,
  totalMesAnterior: 1200,
  categorias: [
    { categoria: 'Vivienda', total: 700, porcentaje: 70 },
    { categoria: 'Transporte y viajes', total: 300, porcentaje: 30 },
  ],
}

test('sin pregunta puntual dice el total y lo que más pesó', () => {
  assert.equal(respuestaGastos('en que gaste mas este mes', G, fmt), 'Este mes gastaste $1000. Lo que más pesó fue Vivienda: $700.')
})

test('responde por concepto, con o sin gastos en ese concepto', () => {
  assert.equal(respuestaGastos('cuanto gaste en transporte', G, fmt), 'En Transporte y viajes llevás $300 este mes: el 30% de tus gastos.')
  assert.equal(respuestaGastos('cuanto gaste en salud', G, fmt), 'Este mes no tenés gastos en Educación y salud.')
})

test('compara con el mes pasado en las dos direcciones', () => {
  assert.equal(respuestaGastos('gaste mas que el mes pasado', G, fmt), 'El mes pasado gastaste $1200 y este mes llevás $1000. Vas $200 abajo.')
  assert.match(respuestaGastos('cuanto gaste el mes pasado', { ...G, total: 1500 }, fmt), /Vas \$300 arriba\.$/)
  assert.match(respuestaGastos('mes anterior', { ...G, total: 1200 }, fmt), /Vas igual\.$/)
})

test('sin mes anterior o sin gastos no inventa números', () => {
  assert.equal(respuestaGastos('mes pasado', { ...G, totalMesAnterior: 0 }, fmt), 'El mes pasado no registraste gastos. Este mes llevás $1000.')
  assert.match(respuestaGastos('mis gastos', { total: 0, totalMesAnterior: 0, categorias: [] }, fmt), /todavía no tenés gastos/)
  assert.match(respuestaGastos('mis gastos', null, fmt), /todavía no tenés gastos/)
})
