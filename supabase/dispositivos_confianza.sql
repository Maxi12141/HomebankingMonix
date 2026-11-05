-- Dispositivos de confianza: en un dispositivo donde ya pasaste el código, entrar no lo vuelve
-- a pedir. Sí lo piden un dispositivo nuevo, el link de recuperación, cambiar la contraseña,
-- apagar el 2FA, varios ingresos fallidos en ese dispositivo y 30 días sin usarlo.
-- Requiere sesiones_activas.sql y dos_pasos.sql. Nada de esto cambia el ingreso de cuentas sin 2FA.
--
-- El dispositivo guarda un valor al azar de 256 bits; acá solo queda su hash. El JWT sigue
-- siendo aal1: la confianza se marca por sesión, y RLS y exigir_2fa la leen de la base.

create table if not exists private.dispositivos_confianza (
  hash bytea primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  ultimo_uso timestamptz not null default now()
);
create index if not exists dispositivos_confianza_user_idx on private.dispositivos_confianza (user_id);

create table if not exists private.sesiones_confiables (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  hash bytea not null references private.dispositivos_confianza(hash) on delete cascade
);
create index if not exists sesiones_confiables_hash_idx on private.sesiones_confiables (hash);

create table if not exists private.ubicacion_sesiones (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  ciudad text not null
);

revoke all on table private.dispositivos_confianza from public, anon, authenticated;
revoke all on table private.sesiones_confiables from public, anon, authenticated;
revoke all on table private.ubicacion_sesiones from public, anon, authenticated;

create or replace function private.sesion_actual()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'session_id', '')::uuid
$$;
revoke all on function private.sesion_actual() from public, anon, authenticated;

create or replace function public.sesion_verificada()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors f
      where f.user_id = auth.uid() and f.status = 'verified'
    )
    or exists (
      select 1
      from private.sesiones_confiables c
      join private.dispositivos_confianza d on d.hash = c.hash
      where c.session_id = private.sesion_actual() and d.user_id = auth.uid()
    )
$$;

create or replace function public.exigir_2fa()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if public.sesion_verificada() then
    return;
  end if;
  -- Antes del código solo se llega a demostrar que sos vos de otra forma.
  if coalesce(current_setting('request.path', true), '') in ('/rpc/usar_codigo_recuperacion', '/rpc/entrar_con_dispositivo') then
    return;
  end if;
  raise exception 'Falta la verificación en dos pasos' using errcode = '42501';
end;
$$;

-- Después de pasar el código: este dispositivo queda recordado.
create or replace function public.confiar_en_dispositivo()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sesion uuid := private.sesion_actual();
  v_token text;
  v_hash bytea;
begin
  if v_uid is null or v_sesion is null then
    raise exception 'No autenticado';
  end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2'
    or not exists (select 1 from auth.mfa_factors f where f.user_id = v_uid and f.status = 'verified') then
    raise exception 'Falta la verificación en dos pasos' using errcode = '42501';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := extensions.digest(v_uid::text || ':' || v_token, 'sha256');
  insert into private.dispositivos_confianza (hash, user_id) values (v_hash, v_uid);
  insert into private.sesiones_confiables (session_id, hash) values (v_sesion, v_hash)
  on conflict (session_id) do update set hash = excluded.hash;
  return v_token;
end;
$$;

-- Al iniciar sesión en un dispositivo recordado. Un token de otra cuenta o vencido no sirve.
create or replace function public.entrar_con_dispositivo(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sesion uuid := private.sesion_actual();
  v_hash bytea;
begin
  if v_uid is null or v_sesion is null then
    raise exception 'No autenticado';
  end if;

  v_hash := extensions.digest(v_uid::text || ':' || coalesce(p_token, ''), 'sha256');
  update private.dispositivos_confianza
  set ultimo_uso = now()
  where hash = v_hash and user_id = v_uid and ultimo_uso > now() - interval '30 days';
  if not found then
    return false;
  end if;

  insert into private.sesiones_confiables (session_id, hash) values (v_sesion, v_hash)
  on conflict (session_id) do update set hash = excluded.hash;
  return true;
end;
$$;

-- Cerrar un dispositivo también le saca la confianza: si no, con el celular robado se vuelve a
-- entrar sin código. La excepción es una sesión vieja de este mismo dispositivo.
create or replace function public.cerrar_sesion(p_sesion uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sesion uuid := private.sesion_actual();
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if p_sesion = v_sesion then
    raise exception 'Para salir de este dispositivo usá Cerrar sesión';
  end if;
  if not exists (select 1 from auth.sessions s where s.id = p_sesion and s.user_id = v_uid) then
    raise exception 'Esa sesión ya no está abierta';
  end if;

  delete from private.dispositivos_confianza d
  using private.sesiones_confiables c
  where c.session_id = p_sesion
    and d.hash = c.hash
    and d.user_id = v_uid
    and d.hash is distinct from (select a.hash from private.sesiones_confiables a where a.session_id = v_sesion);

  delete from auth.sessions where id = p_sesion and user_id = v_uid;
end;
$$;

-- Lo usan "cerrar las demás", cambiar la contraseña y activar el 2FA.
create or replace function public.cerrar_otras_sesiones()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sesion uuid := private.sesion_actual();
begin
  if v_uid is null or v_sesion is null then
    raise exception 'No autenticado';
  end if;

  delete from private.dispositivos_confianza d
  where d.user_id = v_uid
    and d.hash is distinct from (select a.hash from private.sesiones_confiables a where a.session_id = v_sesion);

  delete from auth.sessions where user_id = v_uid and id <> v_sesion;
end;
$$;

-- Al apagar el 2FA: si se vuelve a activar, ningún dispositivo queda recordado de antes.
create or replace function public.olvidar_dispositivos()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  delete from private.dispositivos_confianza where user_id = auth.uid();
end;
$$;

create or replace function public.usar_codigo_recuperacion(p_codigo text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_codigo text;
  v_intentos integer;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  select count(*) into v_intentos
  from private.intentos_recuperacion_2fa
  where user_id = v_uid and created_at > now() - interval '1 hour';
  if v_intentos >= 5 then
    raise exception 'Hiciste muchos intentos con códigos de recuperación. Esperá una hora y probá de nuevo.';
  end if;

  v_codigo := translate(upper(regexp_replace(coalesce(p_codigo, ''), '[^0-9A-Za-z]', '', 'g')), 'OIL', '011');

  delete from private.codigos_recuperacion_2fa
  where user_id = v_uid and hash = extensions.digest(v_uid::text || ':' || v_codigo, 'sha256');
  if not found then
    insert into private.intentos_recuperacion_2fa (user_id) values (v_uid);
    return false;
  end if;

  delete from private.codigos_recuperacion_2fa where user_id = v_uid;
  delete from private.intentos_recuperacion_2fa where user_id = v_uid;
  delete from private.dispositivos_confianza where user_id = v_uid;
  delete from auth.mfa_factors where user_id = v_uid;
  delete from auth.sessions
  where user_id = v_uid and id::text is distinct from (auth.jwt() ->> 'session_id');
  return true;
end;
$$;

create or replace function public.guardar_ubicacion_sesion(p_ciudad text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sesion uuid := private.sesion_actual();
  v_ciudad text := left(btrim(coalesce(p_ciudad, '')), 80);
begin
  if auth.uid() is null or v_sesion is null then
    raise exception 'No autenticado';
  end if;
  if v_ciudad = '' then
    return;
  end if;
  insert into private.ubicacion_sesiones (session_id, ciudad)
  select s.id, v_ciudad from auth.sessions s where s.id = v_sesion and s.user_id = auth.uid()
  on conflict (session_id) do update set ciudad = excluded.ciudad;
end;
$$;

-- Devuelve columnas nuevas: Postgres no deja cambiarlas con create or replace.
drop function if exists public.mis_sesiones();
create function public.mis_sesiones()
returns table (
  id uuid,
  creada timestamptz,
  ultimo_uso timestamptz,
  user_agent text,
  actual boolean,
  ip text,
  ciudad text,
  de_confianza boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    s.id,
    s.created_at,
    coalesce(s.refreshed_at at time zone 'UTC', s.updated_at, s.created_at),
    s.user_agent,
    coalesce(s.id = private.sesion_actual(), false),
    host(s.ip),
    u.ciudad,
    c.session_id is not null
  from auth.sessions s
  left join private.ubicacion_sesiones u on u.session_id = s.id
  left join private.sesiones_confiables c on c.session_id = s.id
  where s.user_id = auth.uid()
    and (s.not_after is null or s.not_after > now())
  order by 5 desc, 3 desc
$$;

-- Tope de 30 días. Lo corre pg_cron (sesiones_vencimiento.sql).
create or replace function private.vencer_sesiones()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.sessions where created_at < now() - interval '30 days';
  delete from private.dispositivos_confianza where ultimo_uso < now() - interval '30 days';
  delete from private.intentos_recuperacion_2fa where created_at < now() - interval '1 day';
end;
$$;

revoke all on function private.vencer_sesiones() from public, anon, authenticated;
revoke all on function public.mis_sesiones() from public, anon;
revoke all on function public.confiar_en_dispositivo() from public, anon;
revoke all on function public.entrar_con_dispositivo(text) from public, anon;
revoke all on function public.cerrar_sesion(uuid) from public, anon;
revoke all on function public.cerrar_otras_sesiones() from public, anon;
revoke all on function public.olvidar_dispositivos() from public, anon;
revoke all on function public.usar_codigo_recuperacion(text) from public, anon;
revoke all on function public.guardar_ubicacion_sesion(text) from public, anon;
grant execute on function public.mis_sesiones() to authenticated, service_role;
grant execute on function public.confiar_en_dispositivo() to authenticated, service_role;
grant execute on function public.entrar_con_dispositivo(text) to authenticated, service_role;
grant execute on function public.cerrar_sesion(uuid) to authenticated, service_role;
grant execute on function public.cerrar_otras_sesiones() to authenticated, service_role;
grant execute on function public.olvidar_dispositivos() to authenticated, service_role;
grant execute on function public.usar_codigo_recuperacion(text) to authenticated, service_role;
grant execute on function public.guardar_ubicacion_sesion(text) to authenticated, service_role;
grant execute on function public.sesion_verificada() to anon, authenticated, service_role;
grant execute on function public.exigir_2fa() to anon, authenticated, service_role;
