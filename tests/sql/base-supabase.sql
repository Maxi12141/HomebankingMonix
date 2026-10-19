-- Base mínima que imita un proyecto de Supabase para probar las migraciones
-- de supabase/*.sql en PGlite (tests/sql/*.test.mjs). No se aplica en ningún
-- lado: en producción todo esto ya lo trae Supabase.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

-- auth.uid() lee el usuario de la "sesión" que fija cada test.
create schema auth;
create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;

create schema extensions;
create extension pgcrypto with schema extensions;
create publication supabase_realtime;

-- Esquema base (manual-despliegue.md §7.2): en producción se creó desde el
-- panel. Sólo las columnas anteriores a las migraciones del repo.
create table public.personas (
  id uuid primary key,
  nombre text not null,
  apellido text not null,
  dni text not null constraint personas_dni_key unique,
  direccion text,
  email text not null,
  telefono text,
  fecha_nac date,
  created_at timestamptz not null default now()
);

create table public.cuentas (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.personas(id),
  numero_cuenta text not null,
  tipo text not null default 'caja_ahorro',
  saldo numeric(14,2) not null default 0,
  activa boolean not null default true,
  cbu text unique,
  alias text unique,
  created_at timestamptz not null default now()
);

create table public.movimientos (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas(id),
  tipo text not null,
  monto numeric(14,2) not null,
  saldo_resultante numeric(14,2),
  descripcion text,
  cuenta_destino_id uuid,
  destinatario_nombre text,
  destinatario_apellido text,
  destinatario_dni text,
  destino_cbu text,
  destino_alias text,
  bc_transaccion_id text,
  banco_codigo_origen integer,
  created_at timestamptz not null default now()
);

-- Permisos por defecto de Supabase sobre el esquema public.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
