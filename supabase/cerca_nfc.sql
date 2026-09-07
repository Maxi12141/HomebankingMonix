-- Monix Cerca (BLE/NFC) + pago contactless.
-- Los tokens que viajan por radio nunca son CBU/alias: solo un secreto rotativo hasheado.

create schema if not exists private;

create extension if not exists pgcrypto with schema extensions;

-- ─── Tarjeta ────────────────────────────────────────────────────────────────
alter table public.cuentas
  add column if not exists tarjeta_congelada boolean not null default false;

alter table public.cuentas
  add column if not exists nfc_contacto_activo boolean not null default false;

-- ─── Presencia (acercar celulares) ──────────────────────────────────────────
create table if not exists public.presencia_cerca (
  id bigint generated always as identity primary key,
  persona_id uuid not null references public.personas(id) on delete cascade,
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  token_hash text not null,
  visible boolean not null default true,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint presencia_cerca_persona_id_key unique (persona_id),
  constraint presencia_cerca_token_hash_key unique (token_hash)
);

create index if not exists presencia_cerca_cuenta_id_idx
  on public.presencia_cerca (cuenta_id);

create index if not exists presencia_cerca_expires_at_idx
  on public.presencia_cerca (expires_at);

create index if not exists presencia_cerca_visible_expires_idx
  on public.presencia_cerca (visible, expires_at);

alter table public.presencia_cerca enable row level security;
alter table public.presencia_cerca force row level security;

drop policy if exists presencia_cerca_select_own on public.presencia_cerca;
create policy presencia_cerca_select_own
  on public.presencia_cerca for select
  to authenticated
  using ((select auth.uid()) = persona_id);

drop policy if exists presencia_cerca_insert_own on public.presencia_cerca;
create policy presencia_cerca_insert_own
  on public.presencia_cerca for insert
  to authenticated
  with check ((select auth.uid()) = persona_id);

drop policy if exists presencia_cerca_update_own on public.presencia_cerca;
create policy presencia_cerca_update_own
  on public.presencia_cerca for update
  to authenticated
  using ((select auth.uid()) = persona_id)
  with check ((select auth.uid()) = persona_id);

drop policy if exists presencia_cerca_delete_own on public.presencia_cerca;
create policy presencia_cerca_delete_own
  on public.presencia_cerca for delete
  to authenticated
  using ((select auth.uid()) = persona_id);

revoke all on table public.presencia_cerca from anon, public;
grant select, insert, update, delete on table public.presencia_cerca to authenticated;
grant all on table public.presencia_cerca to service_role;

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

-- ─── Secretos NFC (no expuestos a la Data API) ──────────────────────────────
create table if not exists private.nfc_criptogramas (
  id bigint generated always as identity primary key,
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  token_hash text not null,
  usado boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint nfc_criptogramas_token_hash_key unique (token_hash)
);

create index if not exists nfc_criptogramas_cuenta_id_idx
  on private.nfc_criptogramas (cuenta_id);

create index if not exists nfc_criptogramas_expires_idx
  on private.nfc_criptogramas (expires_at)
  where usado = false;

create table if not exists private.nfc_tarjetas (
  cuenta_id uuid primary key references public.cuentas(id) on delete cascade,
  token_hash text not null,
  updated_at timestamptz not null default now(),
  constraint nfc_tarjetas_token_hash_key unique (token_hash)
);

create table if not exists private.cerca_auditoria (
  id bigint generated always as identity primary key,
  buscador_id uuid not null,
  persona_destino_id uuid,
  accion text not null,
  created_at timestamptz not null default now()
);

create index if not exists cerca_auditoria_buscador_idx
  on private.cerca_auditoria (buscador_id, created_at desc);

create table if not exists private.rpc_rate (
  id bigint generated always as identity primary key,
  persona_id uuid not null,
  accion text not null,
  created_at timestamptz not null default now()
);

create index if not exists rpc_rate_lookup_idx
  on private.rpc_rate (persona_id, accion, created_at desc);

revoke all on table private.nfc_criptogramas from public, anon, authenticated;
revoke all on table private.nfc_tarjetas from public, anon, authenticated;
revoke all on table private.cerca_auditoria from public, anon, authenticated;
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

-- ─── Presencia ──────────────────────────────────────────────────────────────
create or replace function private.activar_presencia(p_cuenta_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cuenta public.cuentas;
begin
  perform private.assert_token(p_token);
  v_cuenta := private.cuenta_propia(p_cuenta_id);

  insert into public.presencia_cerca (
    persona_id, cuenta_id, token_hash, visible, expires_at, last_seen_at
  )
  values (
    v_uid,
    v_cuenta.id,
    private.hash_token(p_token),
    true,
    now() + interval '30 minutes',
    now()
  )
  on conflict (persona_id) do update
    set cuenta_id = excluded.cuenta_id,
        token_hash = excluded.token_hash,
        visible = true,
        expires_at = excluded.expires_at,
        last_seen_at = now();
end;
$$;

create or replace function public.activar_presencia(p_cuenta_id uuid, p_token text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.activar_presencia(p_cuenta_id, p_token);
$$;

create or replace function private.desactivar_presencia()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  update public.presencia_cerca
  set visible = false,
      expires_at = now(),
      last_seen_at = now()
  where persona_id = v_uid;
end;
$$;

create or replace function public.desactivar_presencia()
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.desactivar_presencia();
$$;

create or replace function private.resolver_presencia(p_token text)
returns table(nombre text, apellido text, alias text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_row public.presencia_cerca;
  v_persona public.personas;
  v_cuenta public.cuentas;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  perform private.assert_token(p_token);
  perform private.enforce_rate('resolver_presencia', 40, interval '5 minutes');

  v_hash := private.hash_token(p_token);

  select * into v_row
  from public.presencia_cerca
  where token_hash = v_hash
    and visible = true
    and expires_at > now();

  if not found then
    return;
  end if;

  if v_row.persona_id = v_uid then
    return;
  end if;

  select * into v_persona from public.personas where id = v_row.persona_id;
  select * into v_cuenta from public.cuentas where id = v_row.cuenta_id;

  insert into private.cerca_auditoria (buscador_id, persona_destino_id, accion)
  values (v_uid, v_row.persona_id, 'visto');

  nombre := v_persona.nombre;
  apellido := v_persona.apellido;
  alias := v_cuenta.alias;
  return next;
end;
$$;

create or replace function public.resolver_presencia(p_token text)
returns table(nombre text, apellido text, alias text)
language sql
security invoker
set search_path = ''
as $$
  select * from private.resolver_presencia(p_token);
$$;

create or replace function private.abrir_destino_cerca(p_token text)
returns table(
  nombre text,
  apellido text,
  alias text,
  cbu text,
  cuenta_id uuid,
  moneda text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_row public.presencia_cerca;
  v_persona public.personas;
  v_cuenta public.cuentas;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  perform private.assert_token(p_token);
  perform private.enforce_rate('abrir_destino_cerca', 12, interval '5 minutes');

  v_hash := private.hash_token(p_token);

  select * into v_row
  from public.presencia_cerca
  where token_hash = v_hash
    and visible = true
    and expires_at > now();

  if not found then
    raise exception 'La persona ya no está visible cerca';
  end if;

  if v_row.persona_id = v_uid then
    raise exception 'No podés transferirte a vos mismo';
  end if;

  select * into v_persona from public.personas where id = v_row.persona_id;
  select * into v_cuenta from public.cuentas where id = v_row.cuenta_id and activa = true;

  if not found or v_cuenta.cbu is null then
    raise exception 'La cuenta destino no está disponible';
  end if;

  insert into private.cerca_auditoria (buscador_id, persona_destino_id, accion)
  values (v_uid, v_row.persona_id, 'revelado_cbu');

  nombre := v_persona.nombre;
  apellido := v_persona.apellido;
  alias := v_cuenta.alias;
  cbu := v_cuenta.cbu;
  cuenta_id := v_cuenta.id;
  moneda := v_cuenta.moneda;
  return next;
end;
$$;

create or replace function public.abrir_destino_cerca(p_token text)
returns table(
  nombre text,
  apellido text,
  alias text,
  cbu text,
  cuenta_id uuid,
  moneda text
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.abrir_destino_cerca(p_token);
$$;

-- ─── NFC tarjeta / criptograma ──────────────────────────────────────────────
create or replace function private.registrar_tarjeta_nfc(p_cuenta_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cuenta public.cuentas;
begin
  perform private.assert_token(p_token);
  v_cuenta := private.cuenta_propia(p_cuenta_id);

  if v_cuenta.tarjeta_congelada then
    raise exception 'La tarjeta está congelada';
  end if;

  insert into private.nfc_tarjetas (cuenta_id, token_hash, updated_at)
  values (v_cuenta.id, private.hash_token(p_token), now())
  on conflict (cuenta_id) do update
    set token_hash = excluded.token_hash,
        updated_at = now();

  update public.cuentas
  set nfc_contacto_activo = true
  where id = v_cuenta.id;
end;
$$;

create or replace function public.registrar_tarjeta_nfc(p_cuenta_id uuid, p_token text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.registrar_tarjeta_nfc(p_cuenta_id, p_token);
$$;

create or replace function private.generar_criptograma_nfc(p_cuenta_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cuenta public.cuentas;
begin
  perform private.assert_token(p_token);
  v_cuenta := private.cuenta_propia(p_cuenta_id);

  if v_cuenta.tarjeta_congelada then
    raise exception 'La tarjeta está congelada';
  end if;

  if not v_cuenta.nfc_contacto_activo then
    raise exception 'Activá el pago contactless en Mi Tarjeta';
  end if;

  delete from private.nfc_criptogramas
  where cuenta_id = v_cuenta.id
    and (usado = true or expires_at < now());

  insert into private.nfc_criptogramas (cuenta_id, token_hash, expires_at)
  values (v_cuenta.id, private.hash_token(p_token), now() + interval '90 seconds');
end;
$$;

create or replace function public.generar_criptograma_nfc(p_cuenta_id uuid, p_token text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.generar_criptograma_nfc(p_cuenta_id, p_token);
$$;

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
security invoker
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
security invoker
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
security invoker
set search_path = ''
as $$
  select private.cancelar_cobro_nfc(p_cobro_id);
$$;

create or replace function private.pagar_cobro_nfc(p_cobro_id uuid, p_secreto text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
  v_cobro public.cobros_nfc;
  v_pagador public.cuentas;
  v_comercio public.cuentas;
  v_pagador_persona public.personas;
  v_comercio_persona public.personas;
  v_crypto private.nfc_criptogramas;
  v_gasto_dia numeric;
  v_limite numeric;
  v_id_a uuid;
  v_id_b uuid;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  perform private.assert_token(p_secreto);
  perform private.enforce_rate('pagar_cobro_nfc', 20, interval '5 minutes');

  v_hash := private.hash_token(p_secreto);

  select * into v_cobro
  from public.cobros_nfc
  where id = p_cobro_id;

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

  -- Criptograma de un solo uso (teléfono) o chip estático de la tarjeta.
  select * into v_crypto
  from private.nfc_criptogramas
  where token_hash = v_hash
    and usado = false
    and expires_at > now();

  if found then
    select * into v_pagador from public.cuentas where id = v_crypto.cuenta_id;
  else
    select c.* into v_pagador
    from private.nfc_tarjetas t
    join public.cuentas c on c.id = t.cuenta_id
    where t.token_hash = v_hash;
  end if;

  if v_pagador.id is null then
    raise exception 'Chip o teléfono no reconocido';
  end if;

  if not v_pagador.activa then
    raise exception 'La cuenta pagadora no está activa';
  end if;

  if v_pagador.tarjeta_congelada then
    raise exception 'La tarjeta está congelada';
  end if;

  if not v_pagador.nfc_contacto_activo then
    raise exception 'El pago contactless está desactivado';
  end if;

  select * into v_comercio from public.cuentas where id = v_cobro.comercio_cuenta_id and activa = true;
  if not found then
    raise exception 'La cuenta del comercio no está disponible';
  end if;

  if v_pagador.id = v_comercio.id or v_pagador.persona_id = v_comercio.persona_id then
    raise exception 'No podés pagarte a vos mismo';
  end if;

  if v_pagador.moneda <> v_comercio.moneda then
    raise exception 'La moneda de la tarjeta no coincide con el cobro';
  end if;

  -- El POS (comercio) o el dueño de la tarjeta pueden confirmar el débito.
  if v_uid <> v_cobro.comercio_persona_id and v_uid <> v_pagador.persona_id then
    raise exception 'No tenés permiso para este pago';
  end if;

  if v_crypto.id is null then
    v_limite := case when v_pagador.moneda = 'USD' then 1500 else 250000 end;
    select coalesce(sum(m.monto), 0) into v_gasto_dia
    from public.movimientos m
    where m.cuenta_id = v_pagador.id
      and m.tipo = 'transferencia_salida'
      and m.descripcion like 'Pago NFC|%'
      and m.created_at >= date_trunc('day', now());

    if v_gasto_dia + v_cobro.monto > v_limite then
      raise exception 'Superaste el límite diario de la tarjeta contactless';
    end if;
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
    concat('Pago NFC|', coalesce(v_cobro.descripcion, 'Contactless')),
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
    concat('Pago NFC|', coalesce(v_cobro.descripcion, 'Contactless')),
    v_pagador.id,
    v_pagador_persona.nombre,
    v_pagador_persona.apellido,
    v_pagador_persona.dni,
    v_pagador.cbu,
    v_pagador.alias
  );

  if v_crypto.id is not null then
    update private.nfc_criptogramas
    set usado = true
    where id = v_crypto.id
      and usado = false;

    if not found then
      raise exception 'El código de pago ya fue usado';
    end if;
  end if;

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

create or replace function public.pagar_cobro_nfc(p_cobro_id uuid, p_secreto text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.pagar_cobro_nfc(p_cobro_id, p_secreto);
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
        'activar_presencia','desactivar_presencia','resolver_presencia','abrir_destino_cerca',
        'registrar_tarjeta_nfc','generar_criptograma_nfc','crear_cobro_nfc',
        'obtener_cobro_nfc','cancelar_cobro_nfc','pagar_cobro_nfc'
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
        'activar_presencia','desactivar_presencia','resolver_presencia','abrir_destino_cerca',
        'registrar_tarjeta_nfc','generar_criptograma_nfc','crear_cobro_nfc',
        'obtener_cobro_nfc','cancelar_cobro_nfc','pagar_cobro_nfc'
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
end $$;
