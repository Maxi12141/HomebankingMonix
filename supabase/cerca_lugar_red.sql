-- Misma red: Chrome no da el SSID del WiFi (igual que Bluetooth/NFC).
-- La IP pública del pedido a Supabase sí llega; dos celulares en el mismo
-- router/facultad suelen compartirla. No se guarda la IP, sólo un hash.

alter table public.presencia_cerca
  add column if not exists ip_hash text;

create index if not exists presencia_cerca_ip_hash_idx
  on public.presencia_cerca (ip_hash)
  where visible = true and ip_hash is not null;

create or replace function private.ip_hash_cliente()
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_raw text;
  v_headers json;
  v_ip text;
begin
  v_raw := current_setting('request.headers', true);
  if v_raw is null or v_raw = '' then
    return null;
  end if;
  begin
    v_headers := v_raw::json;
  exception when others then
    return null;
  end;
  v_ip := split_part(replace(coalesce(v_headers->>'x-forwarded-for', ''), ' ', ''), ',', 1);
  v_ip := nullif(btrim(v_ip), '');
  if v_ip is null then
    v_ip := nullif(btrim(coalesce(v_headers->>'x-real-ip', v_headers->>'cf-connecting-ip', '')), '');
  end if;
  if v_ip is null then
    return null;
  end if;
  return encode(extensions.digest(convert_to(v_ip, 'UTF8'), 'sha256'), 'hex');
end;
$$;

revoke all on function private.ip_hash_cliente() from public, anon, authenticated;

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
  v_ip text := private.ip_hash_cliente();
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
    persona_id, cuenta_id, token_hash, visible, expires_at, last_seen_at, lat, lng, accuracy_m, ip_hash
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
    p_accuracy,
    v_ip
  )
  on conflict (persona_id) do update
    set cuenta_id = excluded.cuenta_id,
        visible = true,
        expires_at = excluded.expires_at,
        last_seen_at = now(),
        lat = excluded.lat,
        lng = excluded.lng,
        accuracy_m = excluded.accuracy_m,
        ip_hash = excluded.ip_hash;
end;
$$;

drop function if exists public.listar_en_este_lugar();
drop function if exists private.listar_en_este_lugar();

create or replace function private.listar_en_este_lugar()
returns table(cuenta_id uuid, nombre text, apellido text, metros integer, misma_red boolean)
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
    and last_seen_at > now() - interval '25 seconds';

  if not found then
    return;
  end if;

  return query
  select
    pr.cuenta_id,
    p.nombre,
    p.apellido,
    case
      when v_yo.lat is not null and pr.lat is not null and v_yo.lng is not null and pr.lng is not null
        then private.metros_entre(v_yo.lat, v_yo.lng, pr.lat, pr.lng)
      else null
    end as metros,
    (v_yo.ip_hash is not null and pr.ip_hash is not null and v_yo.ip_hash = pr.ip_hash) as misma_red
  from public.presencia_cerca pr
  join public.personas p on p.id = pr.persona_id
  join public.cuentas c on c.id = pr.cuenta_id
  where pr.visible = true
    and pr.expires_at > now()
    and pr.last_seen_at > now() - interval '25 seconds'
    and pr.persona_id <> v_uid
    and c.activa = true
    and c.moneda = 'ARS'
    and (
      (v_yo.ip_hash is not null and pr.ip_hash is not null and v_yo.ip_hash = pr.ip_hash)
      or (
        v_yo.lat is not null and pr.lat is not null
        and v_yo.lng is not null and pr.lng is not null
        and private.metros_entre(v_yo.lat, v_yo.lng, pr.lat, pr.lng) <= 20
      )
    )
  order by misma_red desc, metros nulls last, pr.last_seen_at desc
  limit 40;
end;
$$;

revoke all on function private.listar_en_este_lugar() from public, anon, authenticated;

create or replace function public.listar_en_este_lugar()
returns table(cuenta_id uuid, nombre text, apellido text, metros integer, misma_red boolean)
language sql
security definer
set search_path = ''
as $$
  select * from private.listar_en_este_lugar();
$$;

revoke all on function public.listar_en_este_lugar() from public, anon;
grant execute on function public.listar_en_este_lugar() to authenticated, service_role;

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
  v_misma_red boolean;
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
    and last_seen_at > now() - interval '25 seconds';
  if not found then
    raise exception 'Tu ubicación se venció. Volvé a activar En este lugar';
  end if;

  select * into v_otro
  from public.presencia_cerca
  where cuenta_id = p_cuenta_destino
    and visible = true
    and expires_at > now()
    and last_seen_at > now() - interval '25 seconds';
  if not found then
    raise exception 'Esa persona ya no está en este lugar';
  end if;
  if v_otro.persona_id = v_uid then
    raise exception 'No podés transferirte a vos mismo';
  end if;

  v_misma_red := v_yo.ip_hash is not null and v_otro.ip_hash is not null and v_yo.ip_hash = v_otro.ip_hash;
  if v_yo.lat is not null and v_otro.lat is not null and v_yo.lng is not null and v_otro.lng is not null then
    v_metros := private.metros_entre(v_yo.lat, v_yo.lng, v_otro.lat, v_otro.lng);
  else
    v_metros := null;
  end if;
  if not v_misma_red and (v_metros is null or v_metros > 20) then
    raise exception 'Ya no están en la misma red ni a menos de 20 metros';
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

notify pgrst, 'reload schema';
