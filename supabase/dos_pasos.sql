-- Verificación en dos pasos con app autenticadora (TOTP de Supabase Auth).
-- Los códigos de 6 dígitos los maneja Auth. Acá van los códigos de recuperación y
-- las funciones que dicen si la sesión ya pasó el segundo paso.
-- Esta migración no cambia nada para nadie: el control se enciende en dos_pasos_activar.sql.

create table if not exists private.codigos_recuperacion_2fa (
  hash bytea primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists codigos_recuperacion_2fa_user_idx on private.codigos_recuperacion_2fa (user_id);

create table if not exists private.intentos_recuperacion_2fa (
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists intentos_recuperacion_2fa_user_idx on private.intentos_recuperacion_2fa (user_id, created_at);

revoke all on table private.codigos_recuperacion_2fa from public, anon, authenticated;
revoke all on table private.intentos_recuperacion_2fa from public, anon, authenticated;

-- Sin 2FA activo cualquier sesión vale; con 2FA activo, solo la que pasó el código.
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
$$;

-- PostgREST la corre antes de cada pedido (ver dos_pasos_activar.sql).
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
  -- Quien perdió el celular todavía no tiene el código: esta es su única salida.
  if coalesce(current_setting('request.path', true), '') = '/rpc/usar_codigo_recuperacion' then
    return;
  end if;
  raise exception 'Falta la verificación en dos pasos' using errcode = '42501';
end;
$$;

-- Crockford base32: 50 bits por código y sin letras que se confundan con números.
create or replace function public.generar_codigos_recuperacion()
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_alfabeto constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_codigos text[] := '{}';
  v_bytes bytea;
  v_codigo text;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2'
    or not exists (select 1 from auth.mfa_factors f where f.user_id = v_uid and f.status = 'verified') then
    raise exception 'Falta la verificación en dos pasos' using errcode = '42501';
  end if;

  delete from private.codigos_recuperacion_2fa where user_id = v_uid;

  for i in 1..8 loop
    v_bytes := extensions.gen_random_bytes(10);
    v_codigo := '';
    for j in 0..9 loop
      v_codigo := v_codigo || substr(v_alfabeto, (get_byte(v_bytes, j) % 32) + 1, 1);
    end loop;
    insert into private.codigos_recuperacion_2fa (hash, user_id)
    values (extensions.digest(v_uid::text || ':' || v_codigo, 'sha256'), v_uid);
    v_codigos := v_codigos || (substr(v_codigo, 1, 5) || '-' || substr(v_codigo, 6, 5));
  end loop;

  return v_codigos;
end;
$$;

-- Devuelve false en vez de fallar: un error desharía el registro del intento.
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
  delete from auth.mfa_factors where user_id = v_uid;
  delete from auth.sessions
  where user_id = v_uid and id::text is distinct from (auth.jwt() ->> 'session_id');
  return true;
end;
$$;

revoke all on function public.generar_codigos_recuperacion() from public, anon;
revoke all on function public.usar_codigo_recuperacion(text) from public, anon;
grant execute on function public.generar_codigos_recuperacion() to authenticated, service_role;
grant execute on function public.usar_codigo_recuperacion(text) to authenticated, service_role;

-- Si anon no pudiera ejecutarlas, fallaría cada pedido a la API.
grant execute on function public.sesion_verificada() to anon, authenticated, service_role;
grant execute on function public.exigir_2fa() to anon, authenticated, service_role;
