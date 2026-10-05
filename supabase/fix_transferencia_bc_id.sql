-- Fix: las transferencias Monix → Monix fallaban SIEMPRE con 409.
--
-- private.transferir_entre_cuentas insertaba los dos movimientos (salida del
-- que paga y entrada del que cobra) con el mismo bc_transaccion_id, pero
-- movimientos tiene un índice único sobre esa columna
-- (movimientos_bc_id_unique): el segundo insert chocaba, se deshacía toda la
-- operación y el saldo no se movía, aunque el Banco Central ya la tenía
-- registrada. El id del Banco Central queda sólo en la salida; la entrada no
-- lo necesita (useSyncTransferenciasEntrantes ya ignora las transferencias
-- entre cuentas Monix vía es_cuenta_interna, así que no se acredita dos veces).
--
-- Único cambio respecto de la versión anterior: bc_transaccion_id del insert
-- de la entrada pasa de p_bc_transaccion_id a null.

create or replace function private.transferir_entre_cuentas(
  p_operacion_id uuid,
  p_cuenta_origen uuid,
  p_destino_cbu text,
  p_monto_origen numeric,
  p_monto_destino numeric,
  p_descripcion text,
  p_bc_transaccion_id text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_origen public.cuentas;
  v_destino public.cuentas;
  v_origen_persona public.personas;
  v_destino_persona public.personas;
  v_id_a uuid;
  v_id_b uuid;
  v_ya_procesada boolean;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if p_monto_origen is null or p_monto_origen <= 0 then
    raise exception 'Monto invalido';
  end if;

  perform private.enforce_rate('transferir_entre_cuentas', 30, interval '5 minutes');

  select * into v_origen from public.cuentas where id = p_cuenta_origen and activa = true;
  if not found then
    raise exception 'Tu cuenta no esta disponible';
  end if;
  if v_origen.persona_id <> v_uid then
    raise exception 'No autorizado';
  end if;

  select * into v_destino from public.cuentas where cbu = p_destino_cbu and activa = true;
  if not found then
    raise exception 'La cuenta destino no esta disponible';
  end if;

  if v_origen.id = v_destino.id then
    raise exception 'No podes transferirte a vos mismo';
  end if;

  v_id_a := least(v_origen.id, v_destino.id);
  v_id_b := greatest(v_origen.id, v_destino.id);

  perform 1 from public.cuentas where id in (v_id_a, v_id_b) order by id for update;

  select * into v_origen from public.cuentas where id = v_origen.id;
  select * into v_destino from public.cuentas where id = v_destino.id;

  select exists(
    select 1 from public.movimientos where operacion_id = p_operacion_id
  ) into v_ya_procesada;
  if v_ya_procesada then
    return;
  end if;

  if v_origen.saldo < p_monto_origen then
    raise exception 'Saldo insuficiente para realizar la transferencia';
  end if;

  select * into v_origen_persona from public.personas where id = v_origen.persona_id;
  select * into v_destino_persona from public.personas where id = v_destino.persona_id;

  update public.cuentas set saldo = round(saldo - p_monto_origen, 2) where id = v_origen.id;
  update public.cuentas set saldo = round(saldo + p_monto_destino, 2) where id = v_destino.id;

  insert into public.movimientos (
    operacion_id, cuenta_id, tipo, monto, saldo_resultante, descripcion,
    cuenta_destino_id, destinatario_nombre, destinatario_apellido,
    destinatario_dni, destino_cbu, destino_alias, bc_transaccion_id
  ) values (
    p_operacion_id, v_origen.id, 'transferencia_salida',
    round(p_monto_origen, 2), round(v_origen.saldo - p_monto_origen, 2), p_descripcion,
    v_destino.id, v_destino_persona.nombre, v_destino_persona.apellido,
    v_destino_persona.dni, v_destino.cbu, v_destino.alias, p_bc_transaccion_id
  );

  insert into public.movimientos (
    cuenta_id, tipo, monto, saldo_resultante, descripcion,
    cuenta_destino_id, destinatario_nombre, destinatario_apellido,
    destinatario_dni, destino_cbu, destino_alias, bc_transaccion_id
  ) values (
    v_destino.id, 'transferencia_entrada',
    round(p_monto_destino, 2), round(v_destino.saldo + p_monto_destino, 2), p_descripcion,
    v_origen.id, v_origen_persona.nombre, v_origen_persona.apellido,
    v_origen_persona.dni, v_origen.cbu, v_origen.alias, null
  );
end;
$function$;
