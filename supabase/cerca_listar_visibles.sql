-- Cerca por presencia + ubicación. El listado no expone CBU.

alter table public.presencia_cerca
  add column if not exists lat double precision;

alter table public.presencia_cerca
  add column if not exists lng double precision;

drop function if exists public.activar_presencia(uuid, text);
drop function if exists private.activar_presencia(uuid, text);
drop function if exists public.activar_presencia(uuid, text, double precision, double precision);
drop function if exists private.activar_presencia(uuid, text, double precision, double precision);
drop function if exists public.listar_presencias_visibles();
drop function if exists private.listar_presencias_visibles();
drop function if exists public.listar_presencias_visibles(double precision, double precision, integer);
drop function if exists private.listar_presencias_visibles(double precision, double precision, integer);

create or replace function private.activar_presencia(
  p_cuenta_id uuid,
  p_token text,
  p_lat double precision default null,
  p_lng double precision default null
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
  perform private.assert_token(p_token);
  v_cuenta := private.cuenta_propia(p_cuenta_id);

  insert into public.presencia_cerca (
    persona_id, cuenta_id, token_hash, visible, expires_at, last_seen_at, lat, lng
  )
  values (
    v_uid,
    v_cuenta.id,
    private.hash_token(p_token),
    true,
    now() + interval '30 minutes',
    now(),
    p_lat,
    p_lng
  )
  on conflict (persona_id) do update
    set cuenta_id = excluded.cuenta_id,
        token_hash = excluded.token_hash,
        visible = true,
        expires_at = excluded.expires_at,
        last_seen_at = now(),
        lat = excluded.lat,
        lng = excluded.lng;
end;
$$;

revoke all on function private.activar_presencia(uuid, text, double precision, double precision) from public, anon, authenticated;

create or replace function public.activar_presencia(
  p_cuenta_id uuid,
  p_token text,
  p_lat double precision default null,
  p_lng double precision default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.activar_presencia(p_cuenta_id, p_token, p_lat, p_lng);
$$;

create or replace function private.listar_presencias_visibles(
  p_lat double precision default null,
  p_lng double precision default null,
  p_radio_m integer default 400
)
returns table(nombre text, apellido text, alias text, cuenta_id uuid, metros integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_radio integer := greatest(coalesce(p_radio_m, 400), 50);
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  perform private.enforce_rate('listar_presencias_visibles', 80, interval '5 minutes');

  return query
  select
    p.nombre,
    p.apellido,
    c.alias,
    pr.cuenta_id,
    case
      when p_lat is null or p_lng is null or pr.lat is null or pr.lng is null then null
      else (
        6371000 * acos(least(1::double precision, greatest(-1::double precision,
          cos(radians(p_lat)) * cos(radians(pr.lat)) * cos(radians(pr.lng) - radians(p_lng))
          + sin(radians(p_lat)) * sin(radians(pr.lat))
        )))
      )::integer
    end as metros
  from public.presencia_cerca pr
  join public.personas p on p.id = pr.persona_id
  join public.cuentas c on c.id = pr.cuenta_id
  where pr.visible = true
    and pr.expires_at > now()
    and pr.persona_id <> v_uid
    and c.activa = true
    and (
      p_lat is null
      or p_lng is null
      or pr.lat is null
      or (
        6371000 * acos(least(1::double precision, greatest(-1::double precision,
          cos(radians(p_lat)) * cos(radians(pr.lat)) * cos(radians(pr.lng) - radians(p_lng))
          + sin(radians(p_lat)) * sin(radians(pr.lat))
        )))
      ) <= v_radio
    )
  order by metros nulls last, pr.last_seen_at desc
  limit 40;
end;
$$;

revoke all on function private.listar_presencias_visibles(double precision, double precision, integer) from public, anon, authenticated;

create or replace function public.listar_presencias_visibles(
  p_lat double precision default null,
  p_lng double precision default null,
  p_radio_m integer default 400
)
returns table(nombre text, apellido text, alias text, cuenta_id uuid, metros integer)
language sql
security definer
set search_path = ''
as $$
  select * from private.listar_presencias_visibles(p_lat, p_lng, p_radio_m);
$$;

revoke all on function public.activar_presencia(uuid, text, double precision, double precision) from public, anon;
revoke all on function public.listar_presencias_visibles(double precision, double precision, integer) from public, anon;
grant execute on function public.activar_presencia(uuid, text, double precision, double precision) to authenticated, service_role;
grant execute on function public.listar_presencias_visibles(double precision, double precision, integer) to authenticated, service_role;

-- abrir destino por cuenta (si ya existía, se recrea igual)
create or replace function private.abrir_destino_cerca_cuenta(p_cuenta_id uuid)
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
  v_row public.presencia_cerca;
  v_persona public.personas;
  v_cuenta public.cuentas;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if p_cuenta_id is null then
    raise exception 'Cuenta inválida';
  end if;

  perform private.enforce_rate('abrir_destino_cerca_cuenta', 12, interval '5 minutes');

  select * into v_row
  from public.presencia_cerca
  where cuenta_id = p_cuenta_id
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

revoke all on function private.abrir_destino_cerca_cuenta(uuid) from public, anon, authenticated;

create or replace function public.abrir_destino_cerca_cuenta(p_cuenta_id uuid)
returns table(
  nombre text,
  apellido text,
  alias text,
  cbu text,
  cuenta_id uuid,
  moneda text
)
language sql
security definer
set search_path = ''
as $$
  select * from private.abrir_destino_cerca_cuenta(p_cuenta_id);
$$;

revoke all on function public.abrir_destino_cerca_cuenta(uuid) from public, anon;
grant execute on function public.abrir_destino_cerca_cuenta(uuid) to authenticated, service_role;
