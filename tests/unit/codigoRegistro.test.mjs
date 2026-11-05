// npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emailYaRegistrado, minutosYSegundos, VIGENCIA_CODIGO_MS } from '../../src/utils/codigoRegistro.ts'

test('el código dura 5 minutos', () => {
  assert.equal(minutosYSegundos(VIGENCIA_CODIGO_MS), '5:00')
})

test('muestra minutos y segundos sin negativos', () => {
  assert.equal(minutosYSegundos(61_000), '1:01')
  assert.equal(minutosYSegundos(9_000), '0:09')
  assert.equal(minutosYSegundos(500), '0:01')
  assert.equal(minutosYSegundos(0), '0:00')
  assert.equal(minutosYSegundos(-3_000), '0:00')
})

test('reconoce el mail que ya tiene cuenta', () => {
  assert.equal(emailYaRegistrado({ identities: [] }), true)
  assert.equal(emailYaRegistrado({ identities: [{ id: '1' }] }), false)
  assert.equal(emailYaRegistrado({}), false)
})
