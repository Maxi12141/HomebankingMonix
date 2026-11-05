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
  's1_rpc_saldos', 'cotizacion_dolar', 'sesiones_activas', 'dos_pasos', 'dispositivos_confianza',
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
    create table auth.sessions (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      refreshed_at timestamp,
      not_after timestamptz,
      user_agent text,
      ip inet
    );
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

// ── Dispositivos de confianza ──────────────────────────────────────────
const crearSesion = async (uid, extra = {}) =>
  (await db.query('insert into auth.sessions (user_id, ip, created_at) values ($1, $2, coalesce($3, now())) returning id', [uid, extra.ip ?? '10.0.0.9', extra.creada ?? null])).rows[0].id
const confiar = async (uid, sesion) =>
  (await como(uid, { aal: 'aal2', sesion }, 'select public.confiar_en_dispositivo() as t')).rows[0].t
const entrar = async (uid, sesion, token) =>
  (await como(uid, { sesion, ruta: '/rpc/entrar_con_dispositivo' }, 'select public.entrar_con_dispositivo($1) as ok', [token])).rows[0].ok
const exigir = (uid, sesion) => como(uid, { sesion, ruta: '/rpc/transferir_entre_cuentas' }, 'select public.exigir_2fa()')
const Bloqueada = /Falta la verificación/

test('dispositivo recordado: la sesión nueva entra sin código y una sesión ajena no', async () => {
  const uid = await crearUsuario({ conFactor: true })
  const token = await confiar(uid, await crearSesion(uid))
  const nueva = await crearSesion(uid)
  await assert.rejects(exigir(uid, nueva), Bloqueada)
  assert.equal(await entrar(uid, nueva, token), true)
  await exigir(uid, nueva)
  await assert.rejects(exigir(uid, await crearSesion(uid)), Bloqueada)
})

test('sin haber pasado el código no se puede recordar un dispositivo', async () => {
  const uid = await crearUsuario({ conFactor: true })
  const sesion = await crearSesion(uid)
  await assert.rejects(como(uid, { sesion }, 'select public.confiar_en_dispositivo()'), Bloqueada)
})

test('el valor del dispositivo no se guarda en claro', async () => {
  const uid = await crearUsuario({ conFactor: true })
  const token = await confiar(uid, await crearSesion(uid))
  assert.match(token, /^[0-9a-f]{64}$/)
  const { rows } = await db.query("select encode(hash, 'hex') as h from private.dispositivos_confianza where user_id = $1", [uid])
  assert.equal(rows.length, 1)
  assert.notEqual(rows[0].h, token)
})

test('el valor de otra cuenta, uno inventado o uno vacío no sirven', async () => {
  const a = await crearUsuario({ conFactor: true })
  const b = await crearUsuario({ conFactor: true })
  const tokenDeA = await confiar(a, await crearSesion(a))
  const sesionB = await crearSesion(b)
  assert.equal(await entrar(b, sesionB, tokenDeA), false)
  assert.equal(await entrar(b, sesionB, 'inventado'), false)
  assert.equal(await entrar(b, sesionB, null), false)
  await assert.rejects(exigir(b, sesionB), Bloqueada)
})

test('la sesión de otra persona no se puede marcar como confiable', async () => {
  const a = await crearUsuario({ conFactor: true })
  const b = await crearUsuario({ conFactor: true })
  const tokenDeB = await confiar(b, await crearSesion(b))
  const sesionA = await crearSesion(a)
  assert.equal(await entrar(b, sesionA, tokenDeB), true)
  await assert.rejects(exigir(a, sesionA), Bloqueada)
})

test('a los 30 días sin uso el dispositivo deja de valer', async () => {
  const uid = await crearUsuario({ conFactor: true })
  const token = await confiar(uid, await crearSesion(uid))
  await db.query("update private.dispositivos_confianza set ultimo_uso = now() - interval '31 days' where user_id = $1", [uid])
  assert.equal(await entrar(uid, await crearSesion(uid), token), false)
})

test('usar el dispositivo renueva los 30 días', async () => {
  const uid = await crearUsuario({ conFactor: true })
  const token = await confiar(uid, await crearSesion(uid))
  await db.query("update private.dispositivos_confianza set ultimo_uso = now() - interval '29 days' where user_id = $1", [uid])
  assert.equal(await entrar(uid, await crearSesion(uid), token), true)
  await db.query("update private.dispositivos_confianza set ultimo_uso = ultimo_uso - interval '29 days' where user_id = $1", [uid])
  assert.equal(await entrar(uid, await crearSesion(uid), token), true)
})

test('cerrar un dispositivo le saca la confianza: el celular robado vuelve a pedir código', async () => {
  const uid = await crearUsuario({ conFactor: true })
  const aca = await crearSesion(uid)
  await confiar(uid, aca)
  const robado = await crearSesion(uid)
  const tokenRobado = await confiar(uid, robado)
  await como(uid, { aal: 'aal2', sesion: aca }, 'select public.cerrar_sesion($1)', [robado])
  assert.equal(await entrar(uid, await crearSesion(uid), tokenRobado), false)
})

test('cerrar una sesión vieja de este mismo dispositivo no lo deja sin confianza', async () => {
  const uid = await crearUsuario({ conFactor: true })
  const token = await confiar(uid, await crearSesion(uid))
  const vieja = await crearSesion(uid)
  const actual = await crearSesion(uid)
  await entrar(uid, vieja, token)
  await entrar(uid, actual, token)
  await como(uid, { sesion: actual }, 'select public.cerrar_sesion($1)', [vieja])
  await exigir(uid, actual)
  assert.equal(await entrar(uid, await crearSesion(uid), token), true)
})

test('no se puede cerrar la sesión de otra persona ni la propia en uso', async () => {
  const a = await crearUsuario({ conFactor: true })
  const b = await crearUsuario({ conFactor: true })
  const deB = await crearSesion(b)
  const tokenB = await confiar(b, deB)
  const deA = await crearSesion(a)
  await assert.rejects(como(a, { aal: 'aal2', sesion: deA }, 'select public.cerrar_sesion($1)', [deB]), /ya no está abierta/)
  await assert.rejects(como(a, { aal: 'aal2', sesion: deA }, 'select public.cerrar_sesion($1)', [deA]), /Cerrar sesión/)
  assert.equal(await entrar(b, deB, tokenB), true)
})

test('cerrar las demás conserva este dispositivo y olvida los otros', async () => {
  const uid = await crearUsuario({ conFactor: true })
  const aca = await crearSesion(uid)
  const tokenAca = await confiar(uid, aca)
  const otra = await crearSesion(uid)
  const tokenOtra = await confiar(uid, otra)
  const ajena = await crearUsuario({ conFactor: true })
  const tokenAjeno = await confiar(ajena, await crearSesion(ajena))

  await como(uid, { aal: 'aal2', sesion: aca }, 'select public.cerrar_otras_sesiones()')
  const quedan = (await db.query('select id from auth.sessions where user_id = $1', [uid])).rows.map((f) => f.id)
  assert.deepEqual(quedan, [aca])
  assert.equal(await entrar(uid, await crearSesion(uid), tokenOtra), false)
  assert.equal(await entrar(uid, await crearSesion(uid), tokenAca), true)
  assert.equal(await entrar(ajena, await crearSesion(ajena), tokenAjeno), true, 'no toca otras cuentas')
})

test('apagar el 2FA o usar la recuperación olvida los dispositivos', async () => {
  const a = await crearUsuario({ conFactor: true })
  const tokenA = await confiar(a, await crearSesion(a))
  await como(a, { aal: 'aal2' }, 'select public.olvidar_dispositivos()')
  assert.equal(await entrar(a, await crearSesion(a), tokenA), false)

  const b = await crearUsuario({ conFactor: true })
  const sesionB = await crearSesion(b)
  const tokenB = await confiar(b, sesionB)
  const [codigo] = await generar(b)
  assert.equal(await usar(b, codigo, sesionB), true)
  assert.equal(await cuenta('private.dispositivos_confianza', b), 0)
  assert.equal(await entrar(b, await crearSesion(b), tokenB), false)
})

test('el panel muestra IP, ciudad y confianza, solo de tus sesiones', async () => {
  const a = await crearUsuario({ conFactor: false })
  const b = await crearUsuario({ conFactor: false })
  const aca = await crearSesion(a, { ip: '190.1.2.3' })
  const otra = await crearSesion(a, { ip: '190.9.9.9' })
  await crearSesion(b)
  await como(a, { sesion: aca }, 'select public.guardar_ubicacion_sesion($1)', ['Córdoba, AR'])
  const { rows } = await como(a, { sesion: aca }, 'select * from public.mis_sesiones()')
  assert.equal(rows.length, 2)
  assert.equal(rows[0].id, aca)
  assert.equal(rows[0].actual, true)
  assert.equal(rows[0].ip, '190.1.2.3')
  assert.equal(rows[0].ciudad, 'Córdoba, AR')
  assert.equal(rows[0].de_confianza, false)
  assert.equal(rows[1].id, otra)
  assert.equal(rows[1].ciudad, null)
})

test('la ciudad solo se guarda en tu sesión, recortada, y vacía no pisa nada', async () => {
  const a = await crearUsuario({ conFactor: false })
  const b = await crearUsuario({ conFactor: false })
  const deA = await crearSesion(a)
  const deB = await crearSesion(b)
  await como(a, { sesion: deB }, 'select public.guardar_ubicacion_sesion($1)', ['Falsa'])
  assert.equal((await db.query('select 1 from private.ubicacion_sesiones where session_id = $1', [deB])).rows.length, 0)
  await como(a, { sesion: deA }, 'select public.guardar_ubicacion_sesion($1)', ['x'.repeat(200)])
  await como(a, { sesion: deA }, 'select public.guardar_ubicacion_sesion($1)', ['   '])
  const { rows } = await db.query('select ciudad from private.ubicacion_sesiones where session_id = $1', [deA])
  assert.equal(rows[0].ciudad.length, 80)
})

test('a los 30 días se cierra la sesión; la reciente sigue', async () => {
  const uid = await crearUsuario({ conFactor: false })
  const vieja = await crearSesion(uid, { creada: new Date(Date.now() - 31 * 864e5).toISOString() })
  const nueva = await crearSesion(uid)
  await db.exec('select private.vencer_sesiones()')
  const quedan = (await db.query('select id from auth.sessions where user_id = $1', [uid])).rows.map((f) => f.id)
  assert.ok(!quedan.includes(vieja))
  assert.ok(quedan.includes(nueva))
})

test('el navegador no llega a las tablas ni a las funciones privadas', async () => {
  const uid = await crearUsuario({ conFactor: false })
  for (const t of ['private.dispositivos_confianza', 'private.sesiones_confiables', 'private.ubicacion_sesiones']) {
    await assert.rejects(como(uid, { aal: 'aal2' }, `select * from ${t}`), /permission denied/)
  }
  await assert.rejects(como(uid, { aal: 'aal2' }, 'select private.vencer_sesiones()'), /permission denied/)
})

test('sin iniciar sesión no se llama a nada de dispositivos', async () => {
  await db.exec('set role anon')
  for (const sql of [
    'select * from public.mis_sesiones()',
    'select public.confiar_en_dispositivo()',
    "select public.entrar_con_dispositivo('x')",
    'select public.cerrar_otras_sesiones()',
    'select public.olvidar_dispositivos()',
    "select public.guardar_ubicacion_sesion('x')",
  ]) {
    await assert.rejects(db.query(sql), /permission denied/)
  }
  await db.exec('reset role')
})

test('con la recuperación todavía se llega sin código, también a entrar con dispositivo', async () => {
  const uid = await crearUsuario({ conFactor: true })
  await como(uid, { ruta: '/rpc/entrar_con_dispositivo' }, 'select public.exigir_2fa()')
  await assert.rejects(como(uid, { ruta: '/rpc/confiar_en_dispositivo' }, 'select public.exigir_2fa()'), Bloqueada)
})
