// S-1 (docs/auditoria-2026-10.md, V2): el saldo sólo cambia en el servidor.
// Aplica las migraciones REALES de supabase/ sobre PGlite (Postgres en WASM)
// y prueba cada RPC como el usuario "authenticated" de Supabase.
// Uso: npm run test:sql
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

// Orden de manual-despliegue.md §7.3, más los dos pasos de S-1.
const MIGRACIONES = [
  'reservas', 'cuentas_interes', 'cuentas_moneda', 'personas_credito', 'personas_situacion_crediticia',
  'prestamos', 'policies', 'cobros_qr', 'depositar', 'transferencia_atomica', 'fix_transferencia_bc_id',
  's1_rpc_saldos',
]
const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8')

const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'
const NUEVO = '00000000-0000-4000-8000-00000000000c'
const OTRO_NUEVO = '00000000-0000-4000-8000-00000000000d'

async function nuevaBase({ revocar }) {
  const db = new PGlite({ extensions: { pgcrypto } })
  await db.exec(leer('./base-supabase.sql'))
  for (const m of MIGRACIONES) await db.exec(leer(`../../supabase/${m}.sql`))
  if (revocar) await db.exec(leer('../../supabase/s1_revocar_escrituras.sql'))
  await db.exec(`
    insert into public.personas (id, nombre, apellido, dni, email, ingreso_mensual, situacion_crediticia_monix)
    values ('${A}', 'Sol', 'Río', '30111222', 'sol@monix.test', 1000000, 1),
           ('${B}', 'Juan', 'Pérez', '30333444', 'juan@monix.test', 1000000, 4);
    insert into public.cuentas (id, persona_id, numero_cuenta, saldo, cbu, alias)
    values ('10000000-0000-4000-8000-00000000000a', '${A}', '0001', 100000, 'CBU-A', 'sol.rio'),
           ('10000000-0000-4000-8000-00000000000b', '${B}', '0002', 50000, 'CBU-B', 'juan.perez');
  `)
  return db
}
const CUENTA_A = '10000000-0000-4000-8000-00000000000a'
const CUENTA_B = '10000000-0000-4000-8000-00000000000b'

// Corre el SQL como un usuario logueado (rol authenticated + su uid).
async function como(db, uid, sql, params) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`)
  try {
    return await db.query(sql, params)
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
  }
}
async function comoServicio(db, sql, params) {
  await db.exec('set role service_role')
  try {
    return await db.query(sql, params)
  } finally {
    await db.exec('reset role')
  }
}
const uno = async (db, sql) => (await db.query(sql)).rows[0]
const saldo = async (db, cuenta) => Number((await uno(db, `select saldo from public.cuentas where id = '${cuenta}'`)).saldo)

test('V2 antes de S-1: el usuario puede escribirse el saldo desde el navegador', async () => {
  const db = await nuevaBase({ revocar: false })
  await como(db, A, `update public.cuentas set saldo = 99999999 where id = '${CUENTA_A}'`)
  assert.equal(await saldo(db, CUENTA_A), 99999999)
})

test('después de S-1: el navegador no escribe saldos, préstamos ni movimientos', async () => {
  const db = await nuevaBase({ revocar: true })
  const prohibido = [
    `update public.cuentas set saldo = 99999999 where id = '${CUENTA_A}'`,
    `insert into public.cuentas (persona_id, numero_cuenta, saldo) values ('${A}', '9', 5000000)`,
    `insert into public.movimientos (cuenta_id, tipo, monto) values ('${CUENTA_A}', 'deposito', 1)`,
    `update public.personas set situacion_crediticia_monix = 1 where id = '${A}'`,
    `insert into public.prestamos (cuenta_id, monto, cuotas_totales, cuota_monto, tna, situacion_bcra, proxima_cuota_at) values ('${CUENTA_A}', 1, 1, 1, 1, 1, now())`,
    `insert into public.reservas (cuenta_id, saldo) values ('${CUENTA_A}', 1000000)`,
  ]
  for (const sql of prohibido) {
    await assert.rejects(como(db, A, sql), /permission denied/, sql)
  }
  assert.equal(await saldo(db, CUENTA_A), 100000)
})

test('después de S-1: siguen funcionando las ediciones permitidas', async () => {
  const db = await nuevaBase({ revocar: true })
  await como(db, A, `update public.cuentas set alias = 'sol.nuevo', tarjeta_congelada = true where id = '${CUENTA_A}'`)
  await como(db, A, `update public.personas set telefono = '1112345678', ingreso_mensual = 2000000, sueldo_acreditado = true where id = '${A}'`)
  const c = await uno(db, `select alias, tarjeta_congelada from public.cuentas where id = '${CUENTA_A}'`)
  assert.deepEqual(c, { alias: 'sol.nuevo', tarjeta_congelada: true })
  // Y no puede tocar las cuentas de otro: RLS filtra la fila.
  await como(db, A, `update public.cuentas set alias = 'robado' where id = '${CUENTA_B}'`)
  assert.equal((await uno(db, `select alias from public.cuentas where id = '${CUENTA_B}'`)).alias, 'juan.perez')
})

test('depositar_en_cuenta sigue funcionando sin permiso de UPDATE', async () => {
  const db = await nuevaBase({ revocar: true })
  const r = await como(db, A, 'select public.depositar_en_cuenta($1, $2, $3) as saldo', [CUENTA_A, 2500.5, 'Efectivo'])
  assert.equal(Number(r.rows[0].saldo), 102500.5)
  await assert.rejects(como(db, A, 'select public.depositar_en_cuenta($1, $2)', [CUENTA_B, 10]), /No se pudo depositar/)
})

test('reserva: ingresar y retirar son atómicos y validan saldos', async () => {
  const db = await nuevaBase({ revocar: true })
  await como(db, A, 'select public.preparar_reserva($1)', [CUENTA_A])
  let r = (await como(db, A, 'select public.mover_reserva($1, $2, $3) as r', [CUENTA_A, 30000, 'ingresar'])).rows[0].r
  assert.deepEqual([Number(r.saldo_cuenta), Number(r.saldo_reserva)], [70000, 30000])
  r = (await como(db, A, 'select public.mover_reserva($1, $2, $3) as r', [CUENTA_A, 10000, 'retirar'])).rows[0].r
  assert.deepEqual([Number(r.saldo_cuenta), Number(r.saldo_reserva)], [80000, 20000])

  await assert.rejects(como(db, A, 'select public.mover_reserva($1, $2, $3)', [CUENTA_A, 999999, 'ingresar']), /No tenés saldo suficiente/)
  await assert.rejects(como(db, A, 'select public.mover_reserva($1, $2, $3)', [CUENTA_A, 999999, 'retirar']), /No te alcanza/)
  await assert.rejects(como(db, A, 'select public.mover_reserva($1, $2, $3)', [CUENTA_A, 0.001, 'ingresar']), /monto válido/)
  await assert.rejects(como(db, A, 'select public.mover_reserva($1, $2, $3)', [CUENTA_A, -5, 'retirar']), /monto válido/)
  await assert.rejects(como(db, A, 'select public.mover_reserva($1, $2, $3)', [CUENTA_B, 10, 'ingresar']), /No autorizado/)
  assert.equal(await saldo(db, CUENTA_A), 80000) // los rechazos no movieron nada
  const movs = (await db.query(`select count(*)::int n from public.movimientos where cuenta_id = '${CUENTA_A}' and descripcion like 'Reserva|%'`)).rows[0].n
  assert.equal(movs, 2)
})

test('mercadoMONIX: debita, valida saldo y monto', async () => {
  const db = await nuevaBase({ revocar: true })
  const r = await como(db, A, 'select public.comprar_mercado($1, $2, $3) as saldo', [CUENTA_A, 12500, 'Auriculares x1'])
  assert.equal(Number(r.rows[0].saldo), 87500)
  const mov = await uno(db, `select descripcion from public.movimientos where cuenta_id = '${CUENTA_A}' order by created_at desc limit 1`)
  assert.equal(mov.descripcion, 'mercadoMONIX|Auriculares x1')
  await assert.rejects(como(db, A, 'select public.comprar_mercado($1, $2, $3)', [CUENTA_A, 1e9, 'TV']), /No tenés saldo suficiente/)
  await assert.rejects(como(db, A, 'select public.comprar_mercado($1, $2, $3)', [CUENTA_A, -100, 'Truco']), /monto válido/)
})

test('préstamos: la oferta se recalcula en el servidor', async () => {
  const db = await nuevaBase({ revocar: true })
  // Situación 1, sin sueldo: TNA 85, hasta $ 8.000.000 en 24 cuotas, cuota ≤ 30 % del ingreso.
  const r = (await como(db, A, 'select public.solicitar_prestamo($1, $2, $3, $4) as r', [CUENTA_A, 500000, 12, 1])).rows[0].r
  assert.equal(Number(r.tna), 85)
  // Misma fórmula que calcularCuota (sistema francés).
  const i = 85 / 100 / 12
  const f = Math.pow(1 + i, 12)
  assert.equal(Number(r.cuota), Math.round(((500000 * i * f) / (f - 1)) * 100) / 100)
  assert.equal(await saldo(db, CUENTA_A), 600000)

  // B tiene situación 4 registrada: aunque el navegador diga 1, rige la 4 (hasta $ 300.000, 6 cuotas).
  await assert.rejects(como(db, B, 'select public.solicitar_prestamo($1, $2, $3, $4)', [CUENTA_B, 500000, 6, 1]), /Esta oferta admite hasta \$ 300\.000/)
  await assert.rejects(como(db, B, 'select public.solicitar_prestamo($1, $2, $3, $4)', [CUENTA_B, 100000, 12, 1]), /hasta 6 cuotas/)
  // La cuota no puede superar el 30 % del ingreso.
  await db.exec(`update public.personas set ingreso_mensual = 10000 where id = '${A}'`)
  await assert.rejects(como(db, A, 'select public.solicitar_prestamo($1, $2, $3, $4)', [CUENTA_A, 500000, 12, 1]), /no puede superar el 30%/)
  await db.exec(`update public.personas set ingreso_mensual = null where id = '${A}'`)
  await assert.rejects(como(db, A, 'select public.solicitar_prestamo($1, $2, $3, $4)', [CUENTA_A, 1000, 1, 1]), /Declará tu ingreso/)
  // Situación 5 (informada por el navegador): sin oferta.
  await db.exec(`update public.personas set ingreso_mensual = 1000000 where id = '${A}'`)
  await assert.rejects(como(db, A, 'select public.solicitar_prestamo($1, $2, $3, $4)', [CUENTA_A, 1000, 1, 5]), /no podemos ofrecerte/)
})

test('préstamos: cobra las cuotas vencidas una sola vez', async () => {
  const db = await nuevaBase({ revocar: true })
  const r = (await como(db, A, 'select public.solicitar_prestamo($1, $2, $3, $4) as r', [CUENTA_A, 120000, 12, 1])).rows[0].r
  const cuota = Number(r.cuota)
  // Tres cuotas vencidas: hace dos meses y un día, hace un mes y un día, ayer.
  await db.exec(`update public.prestamos set proxima_cuota_at = now() - interval '2 months 1 day'`)
  const s1 = Number((await como(db, A, 'select public.cobrar_cuotas_prestamos($1) as s', [CUENTA_A])).rows[0].s)
  assert.equal(s1, Math.round((220000 - 3 * cuota) * 100) / 100)
  assert.equal((await uno(db, 'select cuotas_pagadas from public.prestamos')).cuotas_pagadas, 3)
  const s2 = Number((await como(db, A, 'select public.cobrar_cuotas_prestamos($1) as s', [CUENTA_A])).rows[0].s)
  assert.equal(s2, s1) // la segunda pasada no cobra de nuevo
})

test('interés diario: se acredita en el servidor y no se duplica', async () => {
  const db = await nuevaBase({ revocar: true })
  await db.exec(`update public.cuentas set ultima_interes_at = now() - interval '10 days' where id = '${CUENTA_A}'`)
  const r = await como(db, A, 'select * from public.acreditar_interes_cuentas()')
  const esperado = Math.round(100000 * (Math.pow(1 + 32 / 100 / 365, 10) - 1) * 100) / 100
  assert.equal(Number(r.rows.find((x) => x.cuenta_id === CUENTA_A).interes), esperado)
  assert.equal(await saldo(db, CUENTA_A), Math.round((100000 + esperado) * 100) / 100)
  const r2 = await como(db, A, 'select * from public.acreditar_interes_cuentas()')
  assert.equal(Number(r2.rows[0].interes), 0)
  // Sólo acredita en las cuentas propias.
  assert.equal(r.rows.length, 1)
})

test('alta de cliente: persona, cuenta con bono y movimiento en una transacción', async () => {
  const db = await nuevaBase({ revocar: true })
  const args = ['Ana', 'Gómez', '40111222', 'ana@monix.test', '', '1990-05-01', 'Calle 1', '0003', 'CBU-C', 'ana.gomez']
  const sql = 'select public.alta_cliente($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) as r'
  const r = (await como(db, NUEVO, sql, args)).rows[0].r
  assert.ok(r.situacion >= 1 && r.situacion <= 5)
  assert.equal(await saldo(db, r.cuenta_id), 150000)
  const p = await uno(db, `select situacion_crediticia_monix, telefono from public.personas where id = '${NUEVO}'`)
  assert.deepEqual(p, { situacion_crediticia_monix: r.situacion, telefono: null })
  await assert.rejects(como(db, NUEVO, sql, args), /Ya tenés una cuenta/)
  // Otro usuario con el mismo DNI: el Registro reconoce este error por "duplicate" y "dni".
  await assert.rejects(como(db, OTRO_NUEVO, sql, [...args.slice(0, 7), '0004', 'CBU-D', 'otro.alias']), /duplicate key.*personas_dni_key/)
  await como(db, NUEVO, 'select public.marcar_situacion_informada()')
  assert.ok((await uno(db, `select situacion_informada_at from public.personas where id = '${NUEVO}'`)).situacion_informada_at)
})

test('cuenta en dólares: una sola por persona', async () => {
  const db = await nuevaBase({ revocar: true })
  const id = (await como(db, A, 'select public.abrir_cuenta_usd($1, $2, $3) as id', ['0005', 'CBU-USD', 'sol.usd'])).rows[0].id
  assert.deepEqual(await uno(db, `select moneda, saldo::float s from public.cuentas where id = '${id}'`), { moneda: 'USD', s: 0 })
  await assert.rejects(como(db, A, 'select public.abrir_cuenta_usd($1, $2, $3)', ['0006', 'CBU-USD2', 'sol.usd2']), /Ya tenés una cuenta en dólares/)
})

test('transferencias entrantes: sólo el servidor acredita, una vez por transacción', async () => {
  const db = await nuevaBase({ revocar: true })
  const args = [CUENTA_A, 'bc-123', 5000, 7, 'Juan', 'Otro', '20111', 'CBU-EXTERNO', 'juan.otro']
  const sql = 'select public.acreditar_transferencia_entrante($1, $2, $3, $4, $5, $6, $7, $8, $9) as ok'
  await assert.rejects(como(db, A, sql, args), /permission denied/) // el navegador no puede
  assert.equal((await comoServicio(db, sql, args)).rows[0].ok, true)
  assert.equal(await saldo(db, CUENTA_A), 105000)
  assert.equal((await comoServicio(db, sql, args)).rows[0].ok, false) // misma transacción: no se repite
  // Monix → Monix ya la registra transferir_entre_cuentas: acá se ignora.
  assert.equal((await comoServicio(db, sql, [CUENTA_A, 'bc-124', 100, 7, 'Juan', 'Pérez', '1', 'CBU-B', 'juan.perez'])).rows[0].ok, false)
  assert.equal(await saldo(db, CUENTA_A), 105000)
})
