// npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { consultar, corregirTipeos, normalizar } from '../../src/services/asistenteConsultas.ts'

const AHORA = new Date(2026, 10, 5, 15, 0, 0) // 5 nov 2026
const dia = (d, h = 12) => new Date(2026, 10, 5 - d, h).toISOString()

const CTX = {
  nombre: 'Alex',
  saldoARS: 1_000_000,
  saldoUSD: 200,
  tieneUsd: true,
  saldoReserva: 25_000,
  tasaReserva: 32,
  interesDiarioReserva: 21.9,
  dolarOficial: { compra: 1380, venta: 1430 },
  tarjetaCongelada: false,
  oferta: { montoMax: 12_000_000, cuotasMax: 24, tna: 73 },
  prestamos: [
    { monto: 500_000, cuotasTotales: 12, cuotasPagadas: 4, cuotaMonto: 71_000, proximaCuota: new Date(2026, 10, 12).toISOString(), estado: 'activo' },
  ],
  metas: [{ titulo: 'Viaje', saldo: 300_000, objetivo: 800_000, estado: 'abierta', miAporte: 100_000 }],
  movimientos: [
    { tipo: 'transferencia_entrada', moneda: 'ARS', monto: 50_000, motivo: 'Varios', contraparte: 'Sofía Paz', fecha: dia(0) },
    { tipo: 'deposito', moneda: 'ARS', monto: 18.4, motivo: 'Rendimiento de Reserva', contraparte: null, fecha: dia(0) },
    { tipo: 'transferencia_salida', moneda: 'ARS', monto: 95_000, motivo: 'Alquiler', contraparte: 'Inmobiliaria Centro', fecha: dia(1) },
    { tipo: 'transferencia_salida', moneda: 'ARS', monto: 15_000, motivo: 'Regalo', contraparte: 'Sofía Paz', fecha: dia(2) },
    { tipo: 'extraccion', moneda: 'ARS', monto: 2_000, motivo: 'Reserva', contraparte: null, fecha: dia(2) },
  ],
}

const preguntar = (texto, ctx = CTX, last) => consultar(normalizar(texto), ctx, last, AHORA)
// Los montos salen con espacio duro de Intl: se compara sin espacios.
const plano = (t) => t.replace(/\s/g, ' ')

test('cuánta plata hay en Reservas contesta el número de Reservas, no el saldo en pesos', () => {
  const r = preguntar('¿Cuánta plata tengo en mis reservas?')
  assert.match(plano(r.text), /^Tenés \$ 25\.000,00 en Reservas \(TNA 32%\)\. Rinde unos \$ 21,90 por día\.$/)
  assert.equal(r.href, '/reservas')
})

test('saldo general suma Reservas y dólares sin mezclarlos', () => {
  const r = preguntar('mi saldo')
  assert.match(plano(r.text), /\$ 1\.000\.000,00 disponibles en pesos.*\$ 25\.000,00 en Reservas.*US\$200\.00/)
  assert.match(plano(preguntar('cuanto tengo en total').text), /En total tenés \$ 1\.025\.000,00/)
})

test('dólares: saldo, sin caja y cotización', () => {
  assert.match(plano(preguntar('cuanto tengo en dolares').text), /Tenés US\$200\.00 en dólares/)
  assert.match(preguntar('cuanto tengo en dolares', { ...CTX, tieneUsd: false, saldoUSD: null }).text, /Todavía no abriste tu caja en dólares/)
  assert.match(plano(preguntar('a cuanto esta el dolar').text), /comprás a \$ 1\.430,00 y vendés a \$ 1\.380,00/)
  assert.match(plano(preguntar('cuanto cuestan 100 dolares').text), /\$ 143\.000,00/)
  assert.match(plano(preguntar('cuanto recibo por vender 50 dolares').text), /\$ 69\.000,00/)
})

test('préstamos: próxima cuota, faltantes, deuda y oferta', () => {
  assert.match(plano(preguntar('cuando vence mi cuota').text), /\$ 71\.000,00 y vence el 12 de noviembre \(en 7 días\)/)
  assert.match(preguntar('cuantas cuotas me faltan').text, /Te faltan 8 de 12 cuotas/)
  assert.match(plano(preguntar('cuanto debo').text), /\$ 568\.000,00 en 8 cuotas/)
  assert.match(plano(preguntar('cuanto me prestan').text), /hasta \$ 12\.000\.000,00 en hasta 24 cuotas/)
  assert.match(preguntar('tengo prestamos', { ...CTX, prestamos: [] }).text, /No tenés préstamos activos/)
})

test('movimientos: último, recibido, enviado a alguien y período', () => {
  assert.match(plano(preguntar('mi ultimo movimiento').text), /transferencia recibida de Sofía Paz por \$ 50\.000,00, hoy/)
  assert.match(plano(preguntar('cuanto recibi este mes').text), /^Recibiste \$ 50\.000,00 este mes/)
  assert.match(plano(preguntar('cuanto le mande a sofia').text), /^Enviaste \$ 15\.000,00 este mes con Sofía Paz/)
  assert.match(preguntar('cuantas transferencias hice este mes').text, /^2 transferencias este mes/)
  assert.match(preguntar('cuanto recibi el mes pasado').text, /No registro movimientos así el mes pasado/)
})

test('lo interno (Reserva, Rendimiento) no cuenta como plata que entró o salió', () => {
  assert.match(plano(preguntar('cuanto transferi este mes').text), /\$ 110\.000,00/)
  assert.doesNotMatch(preguntar('cuanto recibi este mes').text, /18,40/)
})

test('rendimiento del mes sale de los movimientos de Reservas', () => {
  assert.match(plano(preguntar('cuanto rinde mi plata').text), /Este mes te acreditaron \$ 18,40/)
})

test('metas y tarjeta', () => {
  assert.match(plano(preguntar('cuanto me falta para mi meta').text), /faltan \$ 500\.000,00/)
  assert.match(preguntar('mi tarjeta esta congelada').text, /débito está activa/)
  assert.match(preguntar('mi tarjeta esta congelada', { ...CTX, tarjetaCongelada: true }).text, /está congelada/)
})

test('si el dato todavía no llegó, lo dice en vez de inventar', () => {
  const sin = { nombre: 'Alex', saldoARS: 10 }
  assert.match(preguntar('cuanto tengo en reservas', sin).text, /Estoy trayendo ese dato/)
  assert.match(preguntar('cuando vence mi cuota', sin).text, /Estoy trayendo ese dato/)
  assert.match(preguntar('mi ultimo movimiento', sin).text, /Estoy trayendo ese dato/)
})

test('las preguntas de "cómo se hace" o genéricas no las toma: siguen los temas fijos', () => {
  for (const q of ['como funciona reservas', 'reservas', 'prestamos', 'metas comunes', 'como transfiero', 'que es una cuota', 'cuanto gaste en alquiler', 'hola']) {
    assert.equal(preguntar(q), null, q)
  }
})

test('seguimiento: "y en dólares" y "y el mes pasado" retoman la consulta anterior', () => {
  assert.match(plano(preguntar('y en dolares', CTX, 'consulta:saldo').text), /Tenés US\$200\.00/)
  assert.match(preguntar('y el mes pasado', CTX, 'consulta:recibido').text, /el mes pasado/)
  assert.equal(preguntar('y en dolares', CTX, 'prestamos'), null)
})

test('corrige errores de tipeo cercanos y no toca lo dudoso', () => {
  assert.equal(corregirTipeos('cuanto tngo en resevas'), 'cuanto tngo en reservas')
  assert.equal(corregirTipeos('mi ultimo movimeinto'), 'mi ultimo movimiento')
  assert.equal(corregirTipeos('tengo en dolars'), 'tengo en dolar')
  assert.equal(corregirTipeos('quiero comprar un auto'), 'quiero comprar un auto')
  assert.match(plano(preguntar('cuanto tengo en resevas').text), /\$ 25\.000,00 en Reservas/)
})
