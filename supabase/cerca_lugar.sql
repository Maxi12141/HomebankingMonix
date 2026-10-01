-- Supercedido por cerca_lugar_red.sql (misma red por hash de IP + GPS 20 m).
-- No aplicar este archivo solo: pisa el listado y deja de agrupar por WiFi.
-- En este lugar: sala virtual por GPS (Chrome no da Web Bluetooth/NFC estables).
-- El listado y el pago no revelan CBU ni coordenadas ajenas.

alter table public.presencia_cerca
  add column if not exists lat double precision;

alter table public.presencia_cerca
  add column if not exists lng double precision;

alter table public.presencia_cerca
  add column if not exists accuracy_m double precision;

create index if not exists presencia_cerca_visible_seen_idx
  on public.presencia_cerca (visible, last_seen_at desc)
  where visible = true;

create or replace function private.metros_entre(
  p_lat1 double precision,
  p_lng1 double precision,
  p_lat2 double precision,
  p_lng2 double precision
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select (
    6371000 * acos(least(1::double precision, greatest(-1::double precision,
      cos(radians(p_lat1)) * cos(radians(p_lat2)) * cos(radians(p_lng2) - radians(p_lng1))
      + sin(radians(p_lat1)) * sin(radians(p_lat2))
    )))
  )::integer;
$$;

revoke all on function private.metros_entre(double precision, double precision, double precision, double precision)
  from public, anon, authenticated;

create or replace function private.activar_presencia_lugar(
  p_cuenta_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision default null
)
returns void
language plpgsql
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
  if p_lat is null or p_lng is null
     or p_lat < -90 or p_lat > 90
     or p_lng < -180 or p_lng > 180 then
    raise exception 'Ubicación inválida';
  end if;

  perform private.enforce_rate('activar_presencia_lugar', 180, interval '5 minutes');
  v_cuenta := private.cuenta_propia(p_cuenta_id);
  if v_cuenta.moneda is distinct from 'ARS' then
    raise exception 'En este lugar sólo opera la caja en pesos';
  end if;

  insert into public.presencia_cerca (
    persona_id, cuenta_id, token_hash, visible, expires_at, last_seen_at, lat, lng, accuracy_m
  )
  values (
    v_uid,
    v_cuenta.id,
    encode(
      extensions.digest(convert_to(v_uid::text || clock_timestamp()::text, 'UTF8'), 'sha256'),
      'hex'
    ),
    true,
    now() + interval '45 seconds',
    now(),
    p_lat,
    p_lng,
    p_accuracy
  )
  on conflict (persona_id) do update
    set cuenta_id = excluded.cuenta_id,
        visible = true,
        expires_at = excluded.expires_at,
        last_seen_at = now(),
        lat = excluded.lat,
        lng = excluded.lng,
        accuracy_m = excluded.accuracy_m;
end;
$$;

revoke all on function private.activar_presencia_lugar(uuid, double precision, double precision, double precision)
  from public, anon, authenticated;

create or replace function public.activar_presencia_lugar(
  p_cuenta_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.activar_presencia_lugar(p_cuenta_id, p_lat, p_lng, p_accuracy);
$$;

create or replace function private.listar_en_este_lugar()
returns table(cuenta_id uuid, nombre text, apellido text, metros integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_yo public.presencia_cerca;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  perform private.enforce_rate('listar_en_este_lugar', 220, interval '5 minutes');

  select * into v_yo
  from public.presencia_cerca
  where persona_id = v_uid
    and visible = true
    and expires_at > now()
    and last_seen_at > now() - interval '25 seconds'
    and lat is not null
    and lng is not null;

  if not found then
    return;
  end if;

  return query
  select
    pr.cuenta_id,
    p.nombre,
    p.apellido,
    private.metros_entre(v_yo.lat, v_yo.lng, pr.lat, pr.lng) as metros
  from public.presencia_cerca pr
  join public.personas p on p.id = pr.persona_id
  join public.cuentas c on c.id = pr.cuenta_id
  where pr.visible = true
    and pr.expires_at > now()
    and pr.last_seen_at > now() - interval '25 seconds'
    and pr.persona_id <> v_uid
    and pr.lat is not null
    and pr.lng is not null
    and c.activa = true
    and c.moneda = 'ARS'
    and pr.lat between v_yo.lat - 0.00025 and v_yo.lat + 0.00025
    and pr.lng between v_yo.lng - 0.0004 and v_yo.lng + 0.0004
    and private.metros_entre(v_yo.lat, v_yo.lng, pr.lat, pr.lng) <= 20
  order by metros, pr.last_seen_at desc
  limit 40;
end;
$$;

revoke all on function private.listar_en_este_lugar() from public, anon, authenticated;

create or replace function public.listar_en_este_lugar()
returns table(cuenta_id uuid, nombre text, apellido text, metros integer)
language sql
security definer
set search_path = ''
as $$
  select * from private.listar_en_este_lugar();
$$;

create or replace function private.transferir_en_este_lugar(
  p_cuenta_destino uuid,
  p_monto numeric,
  p_concepto text,
  p_operacion_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_yo public.presencia_cerca;
  v_otro public.presencia_cerca;
  v_origen public.cuentas;
  v_destino public.cuentas;
  v_persona public.personas;
  v_monto numeric;
  v_concepto text := nullif(left(btrim(coalesce(p_concepto, '')), 40), '');
  v_desc text;
  v_metros integer;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if p_cuenta_destino is null then
    raise exception 'Elegí a quién transferir';
  end if;
  if p_operacion_id is null then
    raise exception 'Operación inválida';
  end if;
  if p_monto is null or p_monto < 1 or p_monto > 5000000 then
    raise exception 'El monto tiene que ser entre $1 y $5.000.000';
  end if;
  v_monto := round(p_monto, 2);

  perform private.enforce_rate('transferir_en_este_lugar', 20, interval '5 minutes');

  select * into v_yo
  from public.presencia_cerca
  where persona_id = v_uid
    and visible = true
    and expires_at > now()
    and last_seen_at > now() - interval '25 seconds'
    and lat is not null
    and lng is not null;
  if not found then
    raise exception 'Tu ubicación se venció. Volvé a activar En este lugar';
  end if;

  select * into v_otro
  from public.presencia_cerca
  where cuenta_id = p_cuenta_destino
    and visible = true
    and expires_at > now()
    and last_seen_at > now() - interval '25 seconds'
    and lat is not null
    and lng is not null;
  if not found then
    raise exception 'Esa persona ya no está en este lugar';
  end if;
  if v_otro.persona_id = v_uid then
    raise exception 'No podés transferirte a vos mismo';
  end if;

  v_metros := private.metros_entre(v_yo.lat, v_yo.lng, v_otro.lat, v_otro.lng);
  if v_metros > 20 then
    raise exception 'Ya no están a menos de 20 metros';
  end if;

  v_origen := private.cuenta_propia(v_yo.cuenta_id);
  select * into v_destino from public.cuentas where id = v_otro.cuenta_id and activa = true;
  if not found then
    raise exception 'La cuenta destino no está disponible';
  end if;
  if v_destino.cbu is null then
    raise exception 'La cuenta destino no está disponible';
  end if;
  if v_origen.moneda is distinct from 'ARS' or v_destino.moneda is distinct from 'ARS' then
    raise exception 'En este lugar sólo se transfiere en pesos';
  end if;

  v_desc := 'En este lugar';
  if v_concepto is not null then
    v_desc := v_desc || ' · ' || v_concepto;
  end if;

  perform private.transferir_entre_cuentas(
    p_operacion_id,
    v_origen.id,
    v_destino.cbu,
    v_monto,
    v_monto,
    v_desc,
    null
  );

  insert into private.cerca_auditoria (buscador_id, persona_destino_id, accion)
  values (v_uid, v_otro.persona_id, 'transferencia_lugar');

  select * into v_persona from public.personas where id = v_otro.persona_id;

  return jsonb_build_object(
    'id', p_operacion_id,
    'nombre', v_persona.nombre,
    'apellido', v_persona.apellido,
    'monto', v_monto,
    'concepto', v_concepto
  );
end;
$$;

revoke all on function private.transferir_en_este_lugar(uuid, numeric, text, uuid)
  from public, anon, authenticated;

create or replace function public.transferir_en_este_lugar(
  p_cuenta_destino uuid,
  p_monto numeric,
  p_concepto text,
  p_operacion_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.transferir_en_este_lugar(p_cuenta_destino, p_monto, p_concepto, p_operacion_id);
$$;

revoke all on function public.activar_presencia_lugar(uuid, double precision, double precision, double precision)
  from public, anon;
revoke all on function public.listar_en_este_lugar() from public, anon;
revoke all on function public.transferir_en_este_lugar(uuid, numeric, text, uuid) from public, anon;

grant execute on function public.activar_presencia_lugar(uuid, double precision, double precision, double precision)
  to authenticated, service_role;
grant execute on function public.listar_en_este_lugar() to authenticated, service_role;
grant execute on function public.transferir_en_este_lugar(uuid, numeric, text, uuid)
  to authenticated, service_role;
