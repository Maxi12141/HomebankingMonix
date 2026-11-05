// npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nivelDeSesion, sesionPideCodigo } from '../../src/utils/dosPasos.ts'

const token = (datos) => `cabecera.${Buffer.from(JSON.stringify(datos)).toString('base64url')}.firma`
const verificado = [{ status: 'verified' }]

test('lee el nivel del token, también con caracteres de base64url', () => {
  assert.equal(nivelDeSesion(token({ aal: 'aal2', nombre: '¿ñandú?>>>' })), 'aal2')
  assert.equal(nivelDeSesion(token({ sub: 'x' })), null)
  assert.equal(nivelDeSesion('roto'), null)
})

test('sin 2FA activo nunca pide código', () => {
  assert.equal(sesionPideCodigo(null), false)
  assert.equal(sesionPideCodigo({ access_token: token({ aal: 'aal1' }), user: {} }), false)
  assert.equal(sesionPideCodigo({ access_token: token({ aal: 'aal1' }), user: { factors: null } }), false)
})

test('un factor a medio activar no pide código', () => {
  assert.equal(sesionPideCodigo({ access_token: token({ aal: 'aal1' }), user: { factors: [{ status: 'unverified' }] } }), false)
})

test('con 2FA activo pide código hasta que la sesión lo pasa', () => {
  assert.equal(sesionPideCodigo({ access_token: token({ aal: 'aal1' }), user: { factors: verificado } }), true)
  assert.equal(sesionPideCodigo({ access_token: token({ aal: 'aal2' }), user: { factors: verificado } }), false)
})

test('si no puede leer el token, pide código', () => {
  assert.equal(sesionPideCodigo({ access_token: 'roto', user: { factors: verificado } }), true)
})
