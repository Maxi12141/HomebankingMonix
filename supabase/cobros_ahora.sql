-- Monix Ahora: un cobro entre dos cuentas Monix. La plata se mueve solo
-- cuando quien paga acepta, en la misma transacción que marca el cobro.

create table if not exists public.cobros_ahora (
  id uuid primary key default gen_random_uuid(),
  cobrador_persona_id uuid not null references public.personas(id) on delete cascade,
  cobrador_cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  pagador_persona_id uuid not null references public.personas(id) on delete cascade,
  pagador_cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  monto numeric(14,2) not null,
  moneda text not null default 'ARS',
  concepto text,
  estado text not null default 'pendiente',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  resuelto_at timestamptz,
  constraint cobros_ahora_monto_chk check (monto >= 1 and monto <= 5000000),
  constraint cobros_ahora_moneda_chk check (moneda = 'ARS'),
  constraint cobros_ahora_estado_chk check (estado in ('pendiente', 'pagado', 'rechazado', 'vencido', 'cancelado')),
  constraint cobros_ahora_personas_chk check (cobrador_persona_id <> pagador_persona_id),
  constraint cobros_ahora_concepto_chk check (concepto is null or char_length(concepto) <= 40)
);

create index if not exists cobros_ahora_pagador_pendiente_idx
  on public.cobros_ahora (pagador_persona_id, created_at desc)
  where estado = 'pendiente';

create index if not exists cobros_ahora_cobrador_reciente_idx
  on public.cobros_ahora (cobrador_persona_id, created_at desc);

alter table public.cobros_ahora enable row level security;
alter table public.cobros_ahora force row level security;

drop policy if exists cobros_ahora_select_partes on public.cobros_ahora;
create policy cobros_ahora_select_partes
  on public.cobros_ahora
  for select
  to authenticated
  using (
    (select auth.uid()) = cobrador_persona_id
    or (select auth.uid()) = pagador_persona_id
  );

alter table public.cobros_ahora replica identity full;

revoke all on table public.cobros_ahora from anon, public;
grant select on table public.cobros_ahora to authenticated;
grant all on table public.cobros_ahora to service_role;

create or replace function private.vencer_cobros_ahora(p_uid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.cobros_ahora
  set estado = 'vencido', resuelto_at = now()
  where estado = 'pendiente'
    and expires_at <= now()
    and (cobrador_persona_id = p_uid or pagador_persona_id = p_uid);
$$;

create or replace function private.cobro_ahora_vista(
  p_id uuid,
  p_nombre text,
  p_apellido text,
  p_alias text,
  p_monto numeric,
  p_concepto text,
  p_estado text,
  p_expires timestamptz
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_id,
    'nombre', p_nombre,
    'apellido', p_apellido,
    'alias', p_alias,
    'monto', p_monto,
    'moneda', 'ARS',
    'concepto', p_concepto,
    'estado', p_estado,
    'expires_at', p_expires
  );
$$;

create or replace function private.alias_ahora(p_alias text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(lower(btrim(coalesce(p_alias, ''))), '^@', ''), '');
$$;

create or replace function private.buscar_persona_ahora(p_alias text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_alias text := private.alias_ahora(p_alias);
  v_persona uuid;
  v_nombre text;
  v_apellido text;
  v_alias_real text;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if v_alias is null then
    raise exception 'Escribí un alias de Monix';
  end if;

  perform private.enforce_rate('buscar_persona_ahora', 40, interval '5 minutes');

  select c.persona_id, c.alias
    into v_persona, v_alias_real
  from public.cuentas c
  where c.activa
    and c.alias is not null
    and lower(c.alias) = v_alias
  limit 1;

  if v_persona is null then
    raise exception 'No hay una cuenta Monix con ese alias';
  end if;
  if v_persona = v_uid then
    raise exception 'No podés cobrarte a vos mismo';
  end if;
  if not exists (
    select 1 from public.cuentas
    where persona_id = v_persona and activa and moneda = 'ARS'
  ) then
    raise exception 'Esa persona no tiene caja en pesos';
  end if;

  select nombre, apellido into v_nombre, v_apellido
  from public.personas where id = v_persona;

  return jsonb_build_object(
    'nombre', v_nombre,
    'apellido', v_apellido,
    'alias', v_alias_real
  );
end;
$$;

create or replace function public.buscar_persona_ahora(p_alias text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.buscar_persona_ahora(p_alias);
$$;

create or replace function private.crear_cobro_ahora(
  p_alias text,
  p_monto numeric,
  p_concepto text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_alias text := private.alias_ahora(p_alias);
  v_concepto text := nullif(left(btrim(coalesce(p_concepto, '')), 40), '');
  v_monto numeric;
  v_origen public.cuentas;
  v_destino public.cuentas;
  v_persona uuid;
  v_row public.cobros_ahora;
  v_nombre text;
  v_apellido text;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if v_alias is null then
    raise exception 'Escribí un alias de Monix';
  end if;
  if p_monto is null or p_monto < 1 or p_monto > 5000000 then
    raise exception 'El monto tiene que ser entre $1 y $5.000.000';
  end if;
  v_monto := round(p_monto, 2);

  perform private.enforce_rate('crear_cobro_ahora', 15, interval '5 minutes');
  perform private.vencer_cobros_ahora(v_uid);

  select * into v_origen
  from public.cuentas
  where persona_id = v_uid and activa and moneda = 'ARS'
  order by created_at
  limit 1;
  if not found then
    raise exception 'Tu caja en pesos no está disponible';
  end if;

  select persona_id into v_persona
  from public.cuentas
  where activa and alias is not null and lower(alias) = v_alias
  limit 1;
  if v_persona is null then
    raise exception 'No hay una cuenta Monix con ese alias';
  end if;
  if v_persona = v_uid then
    raise exception 'No podés cobrarte a vos mismo';
  end if;

  select * into v_destino
  from public.cuentas
  where persona_id = v_persona and activa and moneda = 'ARS'
  order by created_at
  limit 1;
  if not found then
    raise exception 'Esa persona no tiene caja en pesos';
  end if;

  select nombre, apellido into v_nombre, v_apellido
  from public.personas where id = v_destino.persona_id;

  update public.cobros_ahora
  set estado = 'cancelado', resuelto_at = now()
  where cobrador_persona_id = v_uid
    and pagador_persona_id = v_destino.persona_id
    and estado = 'pendiente';

  insert into public.cobros_ahora (
    cobrador_persona_id, cobrador_cuenta_id,
    pagador_persona_id, pagador_cuenta_id,
    monto, moneda, concepto, estado, expires_at
  ) values (
    v_uid, v_origen.id,
    v_destino.persona_id, v_destino.id,
    v_monto, 'ARS', v_concepto, 'pendiente', now() + interval '3 minutes'
  )
  returning * into v_row;

  return private.cobro_ahora_vista(
    v_row.id, v_nombre, v_apellido, v_destino.alias,
    v_row.monto, v_row.concepto, v_row.estado, v_row.expires_at
  );
end;
$$;

create or replace function public.crear_cobro_ahora(
  p_alias text,
  p_monto numeric,
  p_concepto text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.crear_cobro_ahora(p_alias, p_monto, p_concepto);
$$;

create or replace function private.cobros_ahora_entrantes()
returns jsonb
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
  perform private.vencer_cobros_ahora(v_uid);

  return coalesce((
    select jsonb_agg(private.cobro_ahora_vista(
      c.id, p.nombre, p.apellido, cu.alias,
      c.monto, c.concepto, c.estado, c.expires_at
    ) order by c.created_at desc)
    from public.cobros_ahora c
    join public.personas p on p.id = c.cobrador_persona_id
    join public.cuentas cu on cu.id = c.cobrador_cuenta_id
    where c.pagador_persona_id = v_uid
      and c.estado = 'pendiente'
      and c.expires_at > now()
  ), '[]'::jsonb);
end;
$$;

create or replace function public.cobros_ahora_entrantes()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.cobros_ahora_entrantes();
$$;

create or replace function private.mi_cobro_ahora()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.cobros_ahora;
  v_nombre text;
  v_apellido text;
  v_alias text;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  perform private.vencer_cobros_ahora(v_uid);

  select * into v_row
  from public.cobros_ahora
  where cobrador_persona_id = v_uid
    and (
      (estado = 'pendiente' and expires_at > now())
      or (estado in ('pagado', 'rechazado', 'vencido', 'cancelado') and resuelto_at > now() - interval '2 minutes')
    )
  order by created_at desc
  limit 1;

  if not found then
    return null;
  end if;

  select p.nombre, p.apellido, cu.alias
    into v_nombre, v_apellido, v_alias
  from public.personas p
  join public.cuentas cu on cu.id = v_row.pagador_cuenta_id
  where p.id = v_row.pagador_persona_id;

  return private.cobro_ahora_vista(
    v_row.id, v_nombre, v_apellido, v_alias,
    v_row.monto, v_row.concepto, v_row.estado, v_row.expires_at
  );
end;
$$;

create or replace function public.mi_cobro_ahora()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.mi_cobro_ahora();
$$;

create or replace function private.pagar_cobro_ahora(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cobro public.cobros_ahora;
  v_origen public.cuentas;
  v_destino public.cuentas;
  v_origen_persona public.personas;
  v_destino_persona public.personas;
  v_id_a uuid;
  v_id_b uuid;
  v_ya boolean;
  v_desc text;
  v_nombre text;
  v_apellido text;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  perform private.enforce_rate('pagar_cobro_ahora', 20, interval '5 minutes');

  select * into v_cobro from public.cobros_ahora where id = p_id for update;
  if not found then
    raise exception 'No encontramos ese cobro';
  end if;
  if v_cobro.pagador_persona_id <> v_uid then
    raise exception 'Ese cobro no es tuyo';
  end if;
  if v_cobro.estado = 'pagado' then
    select nombre, apellido into v_nombre, v_apellido
    from public.personas where id = v_cobro.cobrador_persona_id;
    return private.cobro_ahora_vista(
      v_cobro.id, v_nombre, v_apellido, null,
      v_cobro.monto, v_cobro.concepto, v_cobro.estado, v_cobro.expires_at
    );
  end if;
  if v_cobro.estado <> 'pendiente' then
    raise exception 'Ese cobro ya no está disponible';
  end if;
  if v_cobro.expires_at <= now() then
    update public.cobros_ahora
    set estado = 'vencido', resuelto_at = now()
    where id = v_cobro.id and estado = 'pendiente';
    raise exception 'El cobro venció';
  end if;

  v_id_a := least(v_cobro.pagador_cuenta_id, v_cobro.cobrador_cuenta_id);
  v_id_b := greatest(v_cobro.pagador_cuenta_id, v_cobro.cobrador_cuenta_id);
  perform 1 from public.cuentas where id in (v_id_a, v_id_b) order by id for update;

  select * into v_origen from public.cuentas where id = v_cobro.pagador_cuenta_id and activa = true;
  if not found then
    raise exception 'Alguna de las cuentas no está disponible';
  end if;
  select * into v_destino from public.cuentas where id = v_cobro.cobrador_cuenta_id and activa = true;
  if not found then
    raise exception 'Alguna de las cuentas no está disponible';
  end if;
  if v_origen.persona_id <> v_uid then
    raise exception 'No autorizado';
  end if;

  select exists(
    select 1 from public.movimientos where operacion_id = v_cobro.id
  ) into v_ya;
  if v_ya then
    update public.cobros_ahora
    set estado = 'pagado', resuelto_at = coalesce(resuelto_at, now())
    where id = v_cobro.id and estado = 'pendiente';
  else
    if v_origen.saldo < v_cobro.monto then
      raise exception 'Saldo insuficiente';
    end if;

    select * into v_origen_persona from public.personas where id = v_origen.persona_id;
    select * into v_destino_persona from public.personas where id = v_destino.persona_id;

    v_desc := 'Monix Ahora';
    if v_cobro.concepto is not null then
      v_desc := v_desc || ' · ' || v_cobro.concepto;
    end if;

    update public.cuentas set saldo = round(saldo - v_cobro.monto, 2) where id = v_origen.id;
    update public.cuentas set saldo = round(saldo + v_cobro.monto, 2) where id = v_destino.id;

    insert into public.movimientos (
      operacion_id, cuenta_id, tipo, monto, saldo_resultante, descripcion,
      cuenta_destino_id, destinatario_nombre, destinatario_apellido,
      destinatario_dni, destino_cbu, destino_alias
    ) values (
      v_cobro.id, v_origen.id, 'transferencia_salida',
      v_cobro.monto, round(v_origen.saldo - v_cobro.monto, 2), v_desc,
      v_destino.id, v_destino_persona.nombre, v_destino_persona.apellido,
      v_destino_persona.dni, v_destino.cbu, v_destino.alias
    );

    insert into public.movimientos (
      cuenta_id, tipo, monto, saldo_resultante, descripcion,
      cuenta_destino_id, destinatario_nombre, destinatario_apellido,
      destinatario_dni, destino_cbu, destino_alias
    ) values (
      v_destino.id, 'transferencia_entrada',
      v_cobro.monto, round(v_destino.saldo + v_cobro.monto, 2), v_desc,
      v_origen.id, v_origen_persona.nombre, v_origen_persona.apellido,
      v_origen_persona.dni, v_origen.cbu, v_origen.alias
    );

    update public.cobros_ahora
    set estado = 'pagado', resuelto_at = now()
    where id = v_cobro.id;
  end if;

  select nombre, apellido into v_nombre, v_apellido
  from public.personas where id = v_cobro.cobrador_persona_id;

  return private.cobro_ahora_vista(
    v_cobro.id, v_nombre, v_apellido, v_destino.alias,
    v_cobro.monto, v_cobro.concepto, 'pagado', v_cobro.expires_at
  );
end;
$$;

create or replace function public.pagar_cobro_ahora(p_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.pagar_cobro_ahora(p_id);
$$;

create or replace function private.rechazar_cobro_ahora(p_id uuid)
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

  update public.cobros_ahora
  set estado = 'rechazado', resuelto_at = now()
  where id = p_id
    and pagador_persona_id = v_uid
    and estado = 'pendiente'
    and expires_at > now();

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'Ese cobro ya no está disponible';
  end if;
end;
$$;

create or replace function public.rechazar_cobro_ahora(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.rechazar_cobro_ahora(p_id);
$$;

create or replace function private.cancelar_cobro_ahora(p_id uuid)
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

  update public.cobros_ahora
  set estado = 'cancelado', resuelto_at = now()
  where id = p_id
    and cobrador_persona_id = v_uid
    and estado = 'pendiente';

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'Ese cobro ya no está disponible';
  end if;
end;
$$;

create or replace function public.cancelar_cobro_ahora(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.cancelar_cobro_ahora(p_id);
$$;

do $$
declare
  r record;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in (
        'vencer_cobros_ahora', 'cobro_ahora_vista', 'alias_ahora',
        'buscar_persona_ahora', 'crear_cobro_ahora', 'cobros_ahora_entrantes',
        'mi_cobro_ahora', 'pagar_cobro_ahora', 'rechazar_cobro_ahora', 'cancelar_cobro_ahora'
      )
  loop
    execute format('revoke all on function private.%I(%s) from public, anon, authenticated', r.proname, r.args);
  end loop;

  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'buscar_persona_ahora', 'crear_cobro_ahora', 'cobros_ahora_entrantes',
        'mi_cobro_ahora', 'pagar_cobro_ahora', 'rechazar_cobro_ahora', 'cancelar_cobro_ahora'
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
      and tablename = 'cobros_ahora'
  ) then
    execute 'alter publication supabase_realtime add table public.cobros_ahora';
  end if;
end $$;
