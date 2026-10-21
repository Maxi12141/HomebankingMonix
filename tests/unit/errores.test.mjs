// npm run test:unit (node --test; Node 24 lee el .ts quitando los tipos)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mensajeError } from '../../src/lib/errores.ts'

const F = 'No pudimos crear tu cuenta. Probá de nuevo en unos minutos.'
console.error = () => {}

test('lo técnico nunca llega al usuario: cae al fallback', () => {
  assert.equal(mensajeError({ message: 'Could not find the function public.alta_cliente(p_alias, p_cbu) in the schema cache' }, F), F)
  assert.equal(mensajeError(new TypeError('Cannot read properties of undefined'), F), F)
  assert.equal(mensajeError(null, F), F)
})

test('errores conocidos de red, Auth y Postgres se traducen', () => {
  assert.equal(mensajeError(new TypeError('Failed to fetch'), F), 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.')
  assert.equal(mensajeError(new Error('User already registered'), F), 'Ese email ya está registrado. Ingresá con tu contraseña.')
  assert.equal(mensajeError({ message: 'duplicate key value violates unique constraint "personas_dni_key"' }, F), 'Ese DNI ya está registrado.')
})

test('nuestros raise exception: pasan los buenos, se arreglan los fríos', () => {
  assert.equal(mensajeError({ message: 'No tenés saldo suficiente en pesos' }, F), 'No tenés saldo suficiente en pesos')
  assert.equal(mensajeError({ message: 'ERROR: Monto invalido\nCONTEXT: PL/pgSQL' }, F), 'Ingresá un monto válido.')
  assert.equal(mensajeError({ message: 'No autenticado' }, F), 'Tu sesión venció. Ingresá de nuevo y probá otra vez.')
})

test('error del Banco Central usa su texto amigable', () => {
  const err = Object.assign(new Error('{"message":"conflict"}'), { name: 'BancoCentralError', amigable: 'Ese dato ya está registrado en el Banco Central.' })
  assert.equal(mensajeError(err, F), 'Ese dato ya está registrado en el Banco Central.')
})
