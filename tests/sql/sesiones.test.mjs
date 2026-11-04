// Sesiones activas: cada cuenta ve y cierra sólo las suyas.
// Uso: npm run test:sql
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8')

const SOL = '00000000-0000-4000-8000-00000000000a'
const JUAN = '00000000-0000-4000-8000-00000000000b'
const SOL_ACA = '20000000-0000-4000-8000-00000000000a'
const SOL_OTRA = '20000000-0000-4000-8000-00000000000b'
const SOL_VENCIDA = '20000000-0000-4000-8000-00000000000c'
const JUAN_ACA = '20000000-0000-4000-8000-00000000000d'

async function nuevaBase() {
  const db = new PGlite({ extensions: { pgcrypto } })
  await db.exec(leer('./base-supabase.sql'))
  // Lo que en producción ya trae Supabase Auth.
  await db.exec(`
    create function auth.jwt() returns jsonb language sql stable
    as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create table auth.sessions (
      id uuid primary key,
      user_id uuid not null,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      refreshed_at timestamp,
      not_after timestamptz,
      user_agent text,
      ip inet
    );
    insert into auth.sessions (id, user_id, user_agent, not_after, ip) values
      ('${SOL_ACA}', '${SOL}', 'celular', null, '10.0.0.1'),
      ('${SOL_OTRA}', '${SOL}', 'compu', null, '10.0.0.2'),
      ('${SOL_VENCIDA}', '${SOL}', 'vieja', now() - interval '1 day', null),
      ('${JUAN_ACA}', '${JUAN}', 'de juan', null, null);
  `)
  await db.exec(leer('../../supabase/sesiones_activas.sql'))
  return db
}

async function como(db, uid, sesion, sql, params) {
  const claims = JSON.stringify({ sub: uid, session_id: sesion })
  await db.exec(`set role authenticated;
    select set_config('request.jwt.claim.sub', '${uid}', false), set_config('request.jwt.claims', '${claims}', false);`)
  try {
    return await db.query(sql, params)
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '', false);`)
  }
}
const abiertas = async (db) => (await db.query('select id from auth.sessions order by id')).rows.map((f) => f.id)

test('cada cuenta ve sólo sus sesiones vigentes, la actual primero y sin la IP', async () => {
  const db = await nuevaBase()
  const { rows } = await como(db, SOL, SOL_OTRA, 'select * from public.mis_sesiones()')
  assert.deepEqual(rows.map((f) => f.id), [SOL_OTRA, SOL_ACA])
  assert.deepEqual(rows.map((f) => f.actual), [true, false])
  assert.equal('ip' in rows[0], false)
})

test('cierra otra sesión propia', async () => {
  const db = await nuevaBase()
  await como(db, SOL, SOL_ACA, 'select public.cerrar_sesion($1)', [SOL_OTRA])
  assert.deepEqual(await abiertas(db), [SOL_ACA, SOL_VENCIDA, JUAN_ACA])
})

test('no puede cerrar la sesión de otra persona', async () => {
  const db = await nuevaBase()
  await assert.rejects(como(db, SOL, SOL_ACA, 'select public.cerrar_sesion($1)', [JUAN_ACA]), /ya no está abierta/)
  assert.ok((await abiertas(db)).includes(JUAN_ACA))
})

test('la sesión en uso no se cierra por acá', async () => {
  const db = await nuevaBase()
  await assert.rejects(como(db, SOL, SOL_ACA, 'select public.cerrar_sesion($1)', [SOL_ACA]), /Cerrar sesión/)
  assert.ok((await abiertas(db)).includes(SOL_ACA))
})

test('sin iniciar sesión no se puede llamar', async () => {
  const db = await nuevaBase()
  await db.exec('set role anon')
  await assert.rejects(db.query('select * from public.mis_sesiones()'), /permission denied/)
  await assert.rejects(db.query('select public.cerrar_sesion($1)', [SOL_ACA]), /permission denied/)
  await db.exec('reset role')
})

test('el navegador no puede leer auth.sessions directo', async () => {
  const db = await nuevaBase()
  await assert.rejects(como(db, SOL, SOL_ACA, 'select * from auth.sessions'), /permission denied/)
})
