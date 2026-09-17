create or replace function public.depositar_en_cuenta(
  p_cuenta_id uuid,
  p_monto numeric,
  p_descripcion text default null
)
returns numeric
language plpgsql
set search_path = public
as $$
declare
  v_nuevo numeric;
begin
  if p_monto is null or p_monto <= 0 then
    raise exception 'Ingresá un monto válido';
  end if;

  update public.cuentas
  set saldo = round(saldo + p_monto, 2)
  where id = p_cuenta_id
    and persona_id = (select auth.uid())
    and activa = true
  returning saldo into v_nuevo;

  if v_nuevo is null then
    raise exception 'No se pudo depositar en esa cuenta';
  end if;

  insert into public.movimientos (cuenta_id, tipo, monto, saldo_resultante, descripcion)
  values (
    p_cuenta_id,
    'deposito',
    round(p_monto, 2),
    v_nuevo,
    nullif(btrim(p_descripcion), '')
  );

  return v_nuevo;
end;
$$;

revoke all on function public.depositar_en_cuenta(uuid, numeric, text) from public;
grant execute on function public.depositar_en_cuenta(uuid, numeric, text) to authenticated;
