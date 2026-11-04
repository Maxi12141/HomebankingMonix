-- Sesiones activas: ver en qué dispositivos está abierta tu cuenta y cerrarlos.
-- auth.sessions no se expone al navegador: estas funciones sólo ven y tocan las
-- filas del propio usuario. Cerrar todas las demás usa signOut({ scope: 'others' }).
-- No devuelve la IP: no hace falta para reconocer un dispositivo.

create or replace function public.mis_sesiones()
returns table (id uuid, creada timestamptz, ultimo_uso timestamptz, user_agent text, actual boolean)
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
    coalesce(s.id::text = (auth.jwt() ->> 'session_id'), false)
  from auth.sessions s
  where s.user_id = auth.uid()
    and (s.not_after is null or s.not_after > now())
  order by 5 desc, 3 desc
$$;

create or replace function public.cerrar_sesion(p_sesion uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if p_sesion::text = (auth.jwt() ->> 'session_id') then
    raise exception 'Para salir de este dispositivo usá Cerrar sesión';
  end if;

  delete from auth.sessions where id = p_sesion and user_id = auth.uid();
  if not found then
    raise exception 'Esa sesión ya no está abierta';
  end if;
end;
$$;

revoke all on function public.mis_sesiones() from public, anon;
revoke all on function public.cerrar_sesion(uuid) from public, anon;
grant execute on function public.mis_sesiones() to authenticated, service_role;
grant execute on function public.cerrar_sesion(uuid) to authenticated, service_role;
