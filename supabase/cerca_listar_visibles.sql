-- Cerca sin radio: listar a quienes activaron “Visible” y abrir destino por cuenta.
-- No expone CBU en el listado. El CBU se revela al transferir o guardar contacto.

create or replace function private.listar_presencias_visibles()
returns table(nombre text, apellido text, alias text, cuenta_id uuid)
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

  perform private.enforce_rate('listar_presencias_visibles', 40, interval '5 minutes');

  return query
  select p.nombre, p.apellido, c.alias, pr.cuenta_id
  from public.presencia_cerca pr
  join public.personas p on p.id = pr.persona_id
  join public.cuentas c on c.id = pr.cuenta_id
  where pr.visible = true
    and pr.expires_at > now()
    and pr.persona_id <> v_uid
    and c.activa = true
  order by pr.last_seen_at desc
  limit 40;
end;
$$;

revoke all on function private.listar_presencias_visibles() from public, anon, authenticated;

create or replace function public.listar_presencias_visibles()
returns table(nombre text, apellido text, alias text, cuenta_id uuid)
language sql
security definer
set search_path = ''
as $$
  select * from private.listar_presencias_visibles();
$$;

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

revoke all on function public.listar_presencias_visibles() from public, anon;
revoke all on function public.abrir_destino_cerca_cuenta(uuid) from public, anon;
grant execute on function public.listar_presencias_visibles() to authenticated, service_role;
grant execute on function public.abrir_destino_cerca_cuenta(uuid) to authenticated, service_role;
