// npm run test:unit (node --test; Node 24 lee el .ts quitando los tipos)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseMonto } from '../../src/utils/monto.ts'

test('formato argentino: punto de miles, coma decimal', () => {
  assert.equal(parseMonto('1.500'), 1500) // el bug anterior lo leía como 1,5
  assert.equal(parseMonto('1.500,75'), 1500.75)
  assert.equal(parseMonto('12.345.678,9'), 12345678.9)
  assert.equal(parseMonto('1500,5'), 1500.5)
  assert.equal(parseMonto('0,75'), 0.75)
})

test('punto decimal cuando no puede ser de miles', () => {
  assert.equal(parseMonto('1500'), 1500)
  assert.equal(parseMonto('1500.5'), 1500.5)
  assert.equal(parseMonto('0.75'), 0.75)
  assert.equal(parseMonto('25000.00'), 25000)
})

test('tolera espacios y el signo $', () => {
  assert.equal(parseMonto(' $ 1.500 '), 1500)
})

test('rechaza lo que no es un monto válido', () => {
  for (const malo of ['', '   ', 'abc', '1,2,3', '1.50.0', '1.5000', '1,500.75', '12,345', '-100', '1e5', '1.500,755', '.5', ',5']) {
    assert.ok(Number.isNaN(parseMonto(malo)), `debería rechazar "${malo}"`)
  }
})
