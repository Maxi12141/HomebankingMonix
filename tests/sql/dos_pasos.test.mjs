// Verificación en dos pasos: el control del servidor y los códigos de recuperación.
// Uso: npm run test:sql
import { before, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8')
const MIGRACIONES = [
  'reservas', 'cuentas_interes', 'cuentas_moneda', 'personas_credito', 'personas_situacion_crediticia',
  'prestamos', 'policies', 'cobros_qr', 'qr_lecturas', 'depositar', 'transferencia_atomica', 'fix_transferencia_bc_id',
  's1_rpc_saldos', 'cotizacion_dolar', 'dos_pasos',
]

// Cada prueba usa su propio usuario: la base se comparte porque armarla tarda.
let contador = 0
const nuevoId = () => `30000000-0000-4000-8000-${String(++contador).padStart(12, '0')}`
let db

async function crearUsuario({ conFactor }) {
  const uid = nuevoId()
  await db.query('insert into auth.users (id) values ($1)', [uid])
  if (conFactor) await db.query(`insert into auth.mfa_factors (user_id, status) values ($1, 'verified')`, [uid])
  return uid
}

async function como(uid, { aal = 'aal1', sesion = null, ruta = '/rest' }, sql, params) {
  const claims = JSON.stringify({ sub: uid, aal, session_id: sesion })
  await db.exec(`set role authenticated;
    select set_config('request.jwt.claim.sub', '${uid}', false),
           set_config('request.jwt.claims', '${claims}', false),
           set_config('request.path', '${ruta}', false);`)
  try {
    return await db.query(sql, params)
  } finally {
    await db.exec(`reset role;
      select set_config('request.jwt.claim.sub', '', false),
             set_config('request.jwt.claims', '', false),
             set_config('request.path', '', false);`)
  }
}
const generar = async (uid) => (await como(uid, { aal: 'aal2' }, 'select public.generar_codigos_recuperacion() as c')).rows[0].c
const usar = async (uid, codigo, sesion = null) =>
  (await como(uid, { sesion, ruta: '/rpc/usar_codigo_recuperacion' }, 'select public.usar_codigo_recuperacion($1) as ok', [codigo])).rows[0].ok
const cuenta = async (tabla, uid) =>
  Number((await db.query(`select count(*) as n from ${tabla} where user_id = $1`, [uid])).rows[0].n)

before(async () => {
  db = new PGlite({ extensions: { pgcrypto } })
  await db.exec(leer('./base-supabase.sql'))
  await db.exec(`
    create role authenticator nologin;
    create function auth.jwt() returns jsonb language sql stable
    as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create table auth.users (id uuid primary key);
    create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null, status text not null);
    create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid not null);
  `)
  for (const m of MIGRACIONES) await db.exec(leer(`../../supabase/${m}.sql`))
  await db.exec(leer('../../supabase/dos_pasos_activar.sql'))
})

test('sin 2FA activo, cualquier sesión pasa', async () => {
  const uid = await crearUsuario({ conFactor: false })
  await como(uid, {}, 'select public.exigir_2fa()')
})

test('con 2FA activo, la sesión sin código no puede pedir nada', async () => {
  const uid = await crearUsuario({ conFactor: true })
  await assert.rejects(como(uid, {}, 'select public.exigir_2fa()'), /Falta la verificación/)
  await assert.rejects(como(uid, { ruta: '/rpc/transferir_entre_cuentas' }, 'select public.exigir_2fa()'), /Falta la verificación/)
})

test('con 2FA activo, la sesión con código pasa', async () => {
  const uid = await crearUsuario({ conFactor: true })
  await como(uid, { aal: 'aal2' }, 'select public.exigir_2fa()')
})

test('un factor sin confirmar no exige código: activarlo a medias no bloquea la cuenta', async () => {
  const uid = await crearUsuario({ conFactor: false })
  await db.query(`insert into auth.mfa_factors (user_id, status) values ($1, 'unverified')`, [uid])
  await como(uid, {}, 'select public.exigir_2fa()')
})

test('sin sesión y con la clave de servidor, el control no interfiere', async () => {
  await db.exec(`set role anon`)
  await db.query('select public.exigir_2fa()')
  await db.exec(`reset role; set role service_role`)
  await db.query('select public.exigir_2fa()')
  await db.exec('reset role')
})

test('sin código solo se llega a la recuperación', async () => {
  const uid = await crearUsuario({ conFactor: true })
  await como(uid, { ruta: '/rpc/usar_codigo_recuperacion' }, 'select public.exigir_2fa()')
  await assert.rejects(como(uid, { ruta: '/rpc/usar_codigo_recuperacion/otra' }, 'select public.exigir_2fa()'), /Falta la verificación/)
})

test('los avisos en tiempo real tampoco llegan sin código', async () => {
  const uid = await crearUsuario({ conFactor: true })
  await db.query(`insert into public.personas (id, nombre, apellido, dni, email) values ($1, 'Ana', 'Sol', $2, $3)`, [uid, uid.slice(-8), `${uid}@monix.test`])
  await db.query(`insert into public.cuentas (persona_id, numero_cuenta, saldo, cbu, alias) values ($1, $2, 100, $2, $2)`, [uid, uid.slice(-10)])
  const sinCodigo = await como(uid, {}, 'select id from public.cuentas where persona_id = $1', [uid])
  assert.equal(sinCodigo.rows.length, 0)
  const conCodigo = await como(uid, { aal: 'aal2' }, 'select id from public.cuentas where persona_id = $1', [uid])
  assert.equal(conCodigo.rows.length, 1)
})

test('genera 8 códigos distintos y no guarda ninguno en claro', async () => {
  const uid = await crearUsuario({ conFactor: true })
  const codigos = await generar(uid)
  assert.equal(new Set(codigos).size, 8)
  for (const c of codigos) assert.match(c, /^[0-9A-Z]{5}-[0-9A-Z]{5}$/)
  const guardados = await db.query('select encode(hash, $1) as h from private.codigos_recuperacion_2fa where user_id = $2', ['escape', uid])
  assert.equal(guardados.rows.length, 8)
  for (const { h } of guardados.rows) assert.ok(!codigos.some((c) => h.includes(c.replace('-', ''))))
})

test('generar pide el código y reemplaza los anteriores', async () => {
  const uid = await crearUsuario({ conFactor: true })
  await assert.rejects(como(uid, {}, 'select public.generar_codigos_recuperacion()'), /Falta la verificación/)
  const viejos = await generar(uid)
  await generar(uid)
  assert.equal(await usar(uid, viejos[0]), false)
})

test('sin 2FA activo no se generan códigos', async () => {
  const uid = await crearUsuario({ conFactor: false })
  await assert.rejects(generar(uid), /Falta la verificación/)
})

test('un código bueno apaga el 2FA, gasta todos los códigos y cierra las demás sesiones', async () => {
  const uid = await crearUsuario({ conFactor: true })
  const [codigo] = await generar(uid)
  const actual = (await db.query('insert into auth.sessions (user_id) values ($1) returning id', [uid])).rows[0].id
  await db.query('insert into auth.sessions (user_id) values ($1)', [uid])

  assert.equal(await usar(uid, codigo, actual), true)
  assert.equal(await cuenta('auth.mfa_factors', uid), 0)
  assert.equal(await cuenta('private.codigos_recuperacion_2fa', uid), 0)
  const quedan = (await db.query('select id from auth.sessions where user_id = $1', [uid])).rows.map((f) => f.id)
  assert.deepEqual(quedan, [actual])
})

test('acepta el código en minúsculas, sin guion y con letras confundidas', async () => {
  const uid = await crearUsuario({ conFactor: true })
  const [codigo] = await generar(uid)
  const escrito = codigo.replace('-', ' ').toLowerCase().replace(/0/g, 'o').replace(/1/g, 'l')
  assert.equal(await usar(uid, escrito), true)
})

test('el código de otra cuenta no sirve', async () => {
  const a = await crearUsuario({ conFactor: true })
  const b = await crearUsuario({ conFactor: true })
  const [codigoDeA] = await generar(a)
  await generar(b)
  assert.equal(await usar(b, codigoDeA), false)
  assert.equal(await cuenta('auth.mfa_factors', b), 1)
  assert.equal(await cuenta('private.codigos_recuperacion_2fa', a), 8)
})

test('después de 5 intentos fallidos frena, y el fallido queda registrado', async () => {
  const uid = await crearUsuario({ conFactor: true })
  const [bueno] = await generar(uid)
  for (let i = 0; i < 5; i++) assert.equal(await usar(uid, 'MALO'), false)
  assert.equal(await cuenta('private.intentos_recuperacion_2fa', uid), 5)
  await assert.rejects(usar(uid, bueno), /muchos intentos/)
  assert.equal(await cuenta('auth.mfa_factors', uid), 1)
})

test('sin iniciar sesión no se puede llamar a la recuperación', async () => {
  await db.exec('set role anon')
  await assert.rejects(db.query(`select public.usar_codigo_recuperacion('X')`), /permission denied/)
  await assert.rejects(db.query('select public.generar_codigos_recuperacion()'), /permission denied/)
  await db.exec('reset role')
})

test('el navegador no puede leer los códigos ni los factores directo', async () => {
  const uid = await crearUsuario({ conFactor: true })
  await assert.rejects(como(uid, { aal: 'aal2' }, 'select * from private.codigos_recuperacion_2fa'), /permission denied/)
  await assert.rejects(como(uid, { aal: 'aal2' }, 'select * from auth.mfa_factors'), /permission denied/)
})
