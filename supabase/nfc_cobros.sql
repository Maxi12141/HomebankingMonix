-- Tarjeta (congelar) y cobros por QR: crear, consultar, cancelar y pagar.

create schema if not exists private;

create extension if not exists pgcrypto with schema extensions;

-- ─── Tarjeta ────────────────────────────────────────────────────────────────
alter table public.cuentas
  add column if not exists tarjeta_congelada boolean not null default false;

-- ─── Cobros NFC / QR ────────────────────────────────────────────────────────
create table if not exists public.cobros_nfc (
  id uuid primary key default gen_random_uuid(),
  comercio_cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  comercio_persona_id uuid not null references public.personas(id) on delete cascade,
  monto numeric(14,2) not null check (monto > 0),
  descripcion text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'pagado', 'expirado', 'cancelado')),
  pagador_cuenta_id uuid references public.cuentas(id) on delete set null,
  expires_at timestamptz not null,
  pagado_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists cobros_nfc_comercio_cuenta_id_idx
  on public.cobros_nfc (comercio_cuenta_id);

create index if not exists cobros_nfc_comercio_persona_id_idx
  on public.cobros_nfc (comercio_persona_id);

create index if not exists cobros_nfc_pagador_cuenta_id_idx
  on public.cobros_nfc (pagador_cuenta_id);

create index if not exists cobros_nfc_estado_expires_idx
  on public.cobros_nfc (estado, expires_at);

alter table public.cobros_nfc enable row level security;
alter table public.cobros_nfc force row level security;

drop policy if exists cobros_nfc_select_own on public.cobros_nfc;
create policy cobros_nfc_select_own
  on public.cobros_nfc for select
  to authenticated
  using (
    (select auth.uid()) = comercio_persona_id
    or pagador_cuenta_id in (
      select c.id from public.cuentas c
      where c.persona_id = (select auth.uid())
    )
  );

alter table public.cobros_nfc replica identity full;

revoke all on table public.cobros_nfc from anon, public;
grant select on table public.cobros_nfc to authenticated;
grant all on table public.cobros_nfc to service_role;

-- ─── Rate limiting (no expuesto a la Data API) ─────────────────────────────
create table if not exists private.rpc_rate (
  id bigint generated always as identity primary key,
  persona_id uuid not null,
  accion text not null,
  created_at timestamptz not null default now()
);

create index if not exists rpc_rate_lookup_idx
  on private.rpc_rate (persona_id, accion, created_at desc);

revoke all on table private.rpc_rate from public, anon, authenticated;

-- ─── Helpers ────────────────────────────────────────────────────────────────
create or replace function private.hash_token(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
$$;

revoke all on function private.hash_token(text) from public, anon, authenticated;

create or replace function private.assert_token(p_token text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32,64}$' then
    raise exception 'Token inválido';
  end if;
end;
$$;

revoke all on function private.assert_token(text) from public, anon, authenticated;

create or replace function private.enforce_rate(p_accion text, p_max integer, p_window interval)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  delete from private.rpc_rate
  where created_at < now() - interval '1 hour';

  select count(*) into v_count
  from private.rpc_rate
  where persona_id = v_uid
    and accion = p_accion
    and created_at > now() - p_window;

  if v_count >= p_max then
    raise exception 'Demasiados intentos. Probá de nuevo en un momento.';
  end if;

  insert into private.rpc_rate (persona_id, accion) values (v_uid, p_accion);
end;
$$;

revoke all on function private.enforce_rate(text, integer, interval) from public, anon, authenticated;

create or replace function private.cuenta_propia(p_cuenta_id uuid)
returns public.cuentas
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cuenta public.cuentas;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  select * into v_cuenta
  from public.cuentas
  where id = p_cuenta_id
    and persona_id = v_uid
    and activa = true;

  if not found then
    raise exception 'Cuenta no encontrada';
  end if;

  return v_cuenta;
end;
$$;

revoke all on function private.cuenta_propia(uuid) from public, anon, authenticated;

-- ─── Cobros ─────────────────────────────────────────────────────────────────
create or replace function private.crear_cobro_nfc(
  p_cuenta_id uuid,
  p_monto numeric,
  p_descripcion text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cuenta public.cuentas;
  v_id uuid;
begin
  v_cuenta := private.cuenta_propia(p_cuenta_id);

  if p_monto is null or p_monto <= 0 or p_monto > 10000000 then
    raise exception 'Monto inválido';
  end if;

  insert into public.cobros_nfc (
    comercio_cuenta_id,
    comercio_persona_id,
    monto,
    descripcion,
    estado,
    expires_at
  )
  values (
    v_cuenta.id,
    v_uid,
    round(p_monto, 2),
    nullif(trim(p_descripcion), ''),
    'pendiente',
    now() + interval '15 minutes'
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.crear_cobro_nfc(
  p_cuenta_id uuid,
  p_monto numeric,
  p_descripcion text
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select private.crear_cobro_nfc(p_cuenta_id, p_monto, p_descripcion);
$$;

create or replace function private.obtener_cobro_nfc(p_cobro_id uuid)
returns table(
  id uuid,
  monto numeric,
  descripcion text,
  estado text,
  expires_at timestamptz,
  comercio_nombre text,
  comercio_apellido text,
  comercio_alias text,
  moneda text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cobro public.cobros_nfc;
  v_persona public.personas;
  v_cuenta public.cuentas;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if p_cobro_id is null then
    raise exception 'Cobro inválido';
  end if;

  select * into v_cobro from public.cobros_nfc where public.cobros_nfc.id = p_cobro_id;
  if not found then
    raise exception 'No encontramos ese cobro';
  end if;

  if v_cobro.estado = 'pendiente' and v_cobro.expires_at <= now() then
    update public.cobros_nfc
    set estado = 'expirado'
    where public.cobros_nfc.id = v_cobro.id
      and estado = 'pendiente';
    v_cobro.estado := 'expirado';
  end if;

  select * into v_persona from public.personas where public.personas.id = v_cobro.comercio_persona_id;
  select * into v_cuenta from public.cuentas where public.cuentas.id = v_cobro.comercio_cuenta_id;

  id := v_cobro.id;
  monto := v_cobro.monto;
  descripcion := v_cobro.descripcion;
  estado := v_cobro.estado;
  expires_at := v_cobro.expires_at;
  comercio_nombre := v_persona.nombre;
  comercio_apellido := v_persona.apellido;
  comercio_alias := v_cuenta.alias;
  moneda := v_cuenta.moneda;
  return next;
end;
$$;

create or replace function public.obtener_cobro_nfc(p_cobro_id uuid)
returns table(
  id uuid,
  monto numeric,
  descripcion text,
  estado text,
  expires_at timestamptz,
  comercio_nombre text,
  comercio_apellido text,
  comercio_alias text,
  moneda text
)
language sql
security definer
set search_path = ''
as $$
  select * from private.obtener_cobro_nfc(p_cobro_id);
$$;

create or replace function private.cancelar_cobro_nfc(p_cobro_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_updated integer;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  update public.cobros_nfc
  set estado = 'cancelado'
  where id = p_cobro_id
    and comercio_persona_id = v_uid
    and estado = 'pendiente';

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'No se pudo cancelar el cobro';
  end if;
end;
$$;

create or replace function public.cancelar_cobro_nfc(p_cobro_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.cancelar_cobro_nfc(p_cobro_id);
$$;

create or replace function private.resolver_qr_cuenta(p_cuenta_id uuid)
returns table(
  cuenta_id uuid,
  nombre text,
  apellido text,
  alias text,
  moneda text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cuenta public.cuentas;
  v_persona public.personas;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if p_cuenta_id is null then
    raise exception 'QR inválido';
  end if;

  perform private.enforce_rate('resolver_qr_cuenta', 30, interval '5 minutes');

  select * into v_cuenta from public.cuentas where id = p_cuenta_id and activa = true;
  if not found then
    raise exception 'No encontramos esa cuenta';
  end if;

  if v_cuenta.persona_id = v_uid then
    raise exception 'Ese QR es el tuyo';
  end if;

  select * into v_persona from public.personas where id = v_cuenta.persona_id;

  cuenta_id := v_cuenta.id;
  nombre := v_persona.nombre;
  apellido := v_persona.apellido;
  alias := v_cuenta.alias;
  moneda := v_cuenta.moneda;
  return next;
end;
$$;

create or replace function public.resolver_qr_cuenta(p_cuenta_id uuid)
returns table(
  cuenta_id uuid,
  nombre text,
  apellido text,
  alias text,
  moneda text
)
language sql
security definer
set search_path = ''
as $$
  select * from private.resolver_qr_cuenta(p_cuenta_id);
$$;

create or replace function private.pagar_qr_cuenta(
  p_cuenta_destino uuid,
  p_monto numeric,
  p_descripcion text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_destino public.cuentas;
  v_pagador public.cuentas;
  v_pagador_persona public.personas;
  v_destino_persona public.personas;
  v_id_a uuid;
  v_id_b uuid;
  v_desc text;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if p_monto is null or p_monto <= 0 or p_monto > 10000000 then
    raise exception 'Monto inválido';
  end if;

  perform private.enforce_rate('pagar_qr_cuenta', 20, interval '5 minutes');

  select * into v_destino from public.cuentas where id = p_cuenta_destino and activa = true;
  if not found then
    raise exception 'La cuenta destino no está disponible';
  end if;

  if v_destino.persona_id = v_uid then
    raise exception 'No podés pagarte a vos mismo';
  end if;

  select * into v_pagador
  from public.cuentas
  where persona_id = v_uid
    and moneda = v_destino.moneda
    and activa = true
  order by created_at
  limit 1;

  if not found then
    raise exception 'No tenés una cuenta activa en esa moneda';
  end if;

  v_id_a := least(v_pagador.id, v_destino.id);
  v_id_b := greatest(v_pagador.id, v_destino.id);

  perform 1
  from public.cuentas
  where id in (v_id_a, v_id_b)
  order by id
  for update;

  select * into v_pagador from public.cuentas where id = v_pagador.id;
  select * into v_destino from public.cuentas where id = v_destino.id;

  if v_pagador.saldo < p_monto then
    raise exception 'Saldo insuficiente';
  end if;

  select * into v_pagador_persona from public.personas where id = v_pagador.persona_id;
  select * into v_destino_persona from public.personas where id = v_destino.persona_id;

  v_desc := concat('Pago QR|', coalesce(nullif(trim(p_descripcion), ''), 'QR Monix'));

  update public.cuentas set saldo = round(saldo - p_monto, 2) where id = v_pagador.id;
  update public.cuentas set saldo = round(saldo + p_monto, 2) where id = v_destino.id;

  insert into public.movimientos (
    cuenta_id, tipo, monto, saldo_resultante, descripcion,
    cuenta_destino_id, destinatario_nombre, destinatario_apellido,
    destinatario_dni, destino_cbu, destino_alias
  ) values (
    v_pagador.id,
    'transferencia_salida',
    round(p_monto, 2),
    round(v_pagador.saldo - p_monto, 2),
    v_desc,
    v_destino.id,
    v_destino_persona.nombre,
    v_destino_persona.apellido,
    v_destino_persona.dni,
    v_destino.cbu,
    v_destino.alias
  );

  insert into public.movimientos (
    cuenta_id, tipo, monto, saldo_resultante, descripcion,
    cuenta_destino_id, destinatario_nombre, destinatario_apellido,
    destinatario_dni, destino_cbu, destino_alias
  ) values (
    v_destino.id,
    'transferencia_entrada',
    round(p_monto, 2),
    round(v_destino.saldo + p_monto, 2),
    v_desc,
    v_pagador.id,
    v_pagador_persona.nombre,
    v_pagador_persona.apellido,
    v_pagador_persona.dni,
    v_pagador.cbu,
    v_pagador.alias
  );
end;
$$;

create or replace function public.pagar_qr_cuenta(
  p_cuenta_destino uuid,
  p_monto numeric,
  p_descripcion text
)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.pagar_qr_cuenta(p_cuenta_destino, p_monto, p_descripcion);
$$;

create or replace function private.pagar_cobro_qr(p_cobro_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cobro public.cobros_nfc;
  v_pagador public.cuentas;
  v_comercio public.cuentas;
  v_pagador_persona public.personas;
  v_comercio_persona public.personas;
  v_id_a uuid;
  v_id_b uuid;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  perform private.enforce_rate('pagar_cobro_qr', 20, interval '5 minutes');

  if p_cobro_id is null then
    raise exception 'Cobro inválido';
  end if;

  select * into v_cobro from public.cobros_nfc where id = p_cobro_id;
  if not found then
    raise exception 'No encontramos ese cobro';
  end if;

  if v_cobro.estado <> 'pendiente' then
    raise exception 'Ese cobro ya no está disponible';
  end if;

  if v_cobro.expires_at <= now() then
    update public.cobros_nfc
    set estado = 'expirado'
    where id = v_cobro.id and estado = 'pendiente';
    raise exception 'El cobro expiró';
  end if;

  select * into v_comercio from public.cuentas where id = v_cobro.comercio_cuenta_id and activa = true;
  if not found then
    raise exception 'La cuenta del comercio no está disponible';
  end if;

  select * into v_pagador
  from public.cuentas
  where persona_id = v_uid
    and moneda = v_comercio.moneda
    and activa = true
  order by created_at
  limit 1;

  if not found then
    raise exception 'No tenés una cuenta activa en esa moneda';
  end if;

  if v_pagador.id = v_comercio.id or v_pagador.persona_id = v_comercio.persona_id then
    raise exception 'No podés pagarte a vos mismo';
  end if;

  v_id_a := least(v_pagador.id, v_comercio.id);
  v_id_b := greatest(v_pagador.id, v_comercio.id);

  perform 1
  from public.cuentas
  where id in (v_id_a, v_id_b)
  order by id
  for update;

  select * into v_pagador from public.cuentas where id = v_pagador.id;
  select * into v_comercio from public.cuentas where id = v_comercio.id;

  if v_pagador.saldo < v_cobro.monto then
    raise exception 'Saldo insuficiente';
  end if;

  select * into v_pagador_persona from public.personas where id = v_pagador.persona_id;
  select * into v_comercio_persona from public.personas where id = v_comercio.persona_id;

  update public.cuentas
  set saldo = round(saldo - v_cobro.monto, 2)
  where id = v_pagador.id;

  update public.cuentas
  set saldo = round(saldo + v_cobro.monto, 2)
  where id = v_comercio.id;

  insert into public.movimientos (
    cuenta_id, tipo, monto, saldo_resultante, descripcion,
    cuenta_destino_id, destinatario_nombre, destinatario_apellido,
    destinatario_dni, destino_cbu, destino_alias
  ) values (
    v_pagador.id,
    'transferencia_salida',
    v_cobro.monto,
    round(v_pagador.saldo - v_cobro.monto, 2),
    concat('Pago QR|', coalesce(v_cobro.descripcion, 'QR Monix')),
    v_comercio.id,
    v_comercio_persona.nombre,
    v_comercio_persona.apellido,
    v_comercio_persona.dni,
    v_comercio.cbu,
    v_comercio.alias
  );

  insert into public.movimientos (
    cuenta_id, tipo, monto, saldo_resultante, descripcion,
    cuenta_destino_id, destinatario_nombre, destinatario_apellido,
    destinatario_dni, destino_cbu, destino_alias
  ) values (
    v_comercio.id,
    'transferencia_entrada',
    v_cobro.monto,
    round(v_comercio.saldo + v_cobro.monto, 2),
    concat('Pago QR|', coalesce(v_cobro.descripcion, 'QR Monix')),
    v_pagador.id,
    v_pagador_persona.nombre,
    v_pagador_persona.apellido,
    v_pagador_persona.dni,
    v_pagador.cbu,
    v_pagador.alias
  );

  update public.cobros_nfc
  set estado = 'pagado',
      pagador_cuenta_id = v_pagador.id,
      pagado_at = now()
  where id = v_cobro.id
    and estado = 'pendiente';

  if not found then
    raise exception 'Ese cobro ya no está disponible';
  end if;
end;
$$;

create or replace function public.pagar_cobro_qr(p_cobro_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.pagar_cobro_qr(p_cobro_id);
$$;

-- ─── Privilegios de funciones ───────────────────────────────────────────────
do $$
declare
  r record;
begin
  for r in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in (
        'hash_token','assert_token','enforce_rate','cuenta_propia',
        'crear_cobro_nfc','obtener_cobro_nfc','cancelar_cobro_nfc','pagar_cobro_qr',
        'resolver_qr_cuenta','pagar_qr_cuenta'
      )
  loop
    execute format('revoke all on function %I.%I(%s) from public, anon, authenticated', r.nspname, r.proname, r.args);
  end loop;

  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'crear_cobro_nfc','obtener_cobro_nfc','cancelar_cobro_nfc','pagar_cobro_qr',
        'resolver_qr_cuenta','pagar_qr_cuenta'
      )
  loop
    execute format('revoke all on function public.%I(%s) from public, anon', r.proname, r.args);
    execute format('grant execute on function public.%I(%s) to authenticated', r.proname, r.args);
    execute format('grant execute on function public.%I(%s) to service_role', r.proname, r.args);
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cobros_nfc'
  ) then
    execute 'alter publication supabase_realtime add table public.cobros_nfc';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cuentas'
  ) then
    execute 'alter publication supabase_realtime add table public.cuentas';
  end if;
end $$;
