// npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { haceCuanto, inactividadVencida, INACTIVIDAD_MAXIMA_MS, nombreDispositivo, tipoDispositivo } from '../../src/utils/sesiones.ts'

test('reconoce navegador y sistema de los dispositivos comunes', () => {
  const casos = [
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36', 'Chrome en Android'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1', 'Safari en iPhone'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 CriOS/130.0 Mobile/15E148 Safari/604.1', 'Chrome en iPhone'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0', 'Edge en Windows'],
    ['Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36', 'Samsung Internet en Android'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:131.0) Gecko/20100101 Firefox/131.0', 'Firefox en Mac'],
  ]
  for (const [ua, esperado] of casos) assert.equal(nombreDispositivo(ua), esperado)
})

test('sin datos no inventa un dispositivo', () => {
  assert.equal(nombreDispositivo(null), 'Dispositivo sin identificar')
  assert.equal(nombreDispositivo('curl/8.0'), 'Dispositivo sin identificar')
})

test('dice hace cuánto con singular y plural', () => {
  const ahora = new Date('2026-11-04T12:00:00Z')
  const antes = (min) => new Date(ahora.getTime() - min * 60_000).toISOString()
  assert.equal(haceCuanto(antes(0), ahora), 'recién')
  assert.equal(haceCuanto(antes(1), ahora), 'hace 1 minuto')
  assert.equal(haceCuanto(antes(59), ahora), 'hace 59 minutos')
  assert.equal(haceCuanto(antes(60), ahora), 'hace 1 hora')
  assert.equal(haceCuanto(antes(60 * 24), ahora), 'hace 1 día')
  assert.equal(haceCuanto(antes(60 * 24 * 3), ahora), 'hace 3 días')
})

test('reconoce el tipo de dispositivo', () => {
  assert.equal(tipoDispositivo('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Mobile/15E148 Safari/604.1'), 'Celular')
  assert.equal(tipoDispositivo('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/130.0 Mobile Safari/537.36'), 'Celular')
  assert.equal(tipoDispositivo('Mozilla/5.0 (Linux; Android 14; SM-X710) Chrome/130.0 Safari/537.36'), 'Tablet')
  assert.equal(tipoDispositivo('Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) Safari/604.1'), 'Tablet')
  assert.equal(tipoDispositivo('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36'), 'Computadora')
  assert.equal(tipoDispositivo('curl/8.0'), null)
  assert.equal(tipoDispositivo(null), null)
})

test('a los 15 minutos sin uso vence, salvo con biometría', () => {
  const ahora = 1_000_000_000
  assert.equal(inactividadVencida(ahora - INACTIVIDAD_MAXIMA_MS + 1, ahora, false), false)
  assert.equal(inactividadVencida(ahora - INACTIVIDAD_MAXIMA_MS, ahora, false), true)
  assert.equal(inactividadVencida(ahora - INACTIVIDAD_MAXIMA_MS * 10, ahora, true), false)
  assert.equal(inactividadVencida(null, ahora, false), false, 'sin marca no cierra')
  assert.equal(INACTIVIDAD_MAXIMA_MS, 15 * 60_000)
})
