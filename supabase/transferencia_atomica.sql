-- Arregla dos bugs reales de la auditoría 2026-09-21 (docs/auditoria-completa-2026-09-21.md):
--
-- 1) Transferencias Monix→Monix nunca se acreditaban del lado del cliente: la
--    política RLS de `cuentas` sólo permite UPDATE donde persona_id=auth.uid(),
--    así que el UPDATE directo a la cuenta del destinatario (TransferPage.tsx)
--    quedaba filtrado a 0 filas sin ningún error. Lo que "salvaba" la plata
--    era un efecto secundario no intencional en useSyncTransferenciasEntrantes.
-- 2) Sin idempotencia: si el Banco Central ya aceptó la transferencia pero el
--    guardado local fallaba después, no había forma de evitar reenviarla.
--
-- Se resuelve con el mismo patrón que ya usa `pagar_qr_cuenta` en
-- cerca_nfc.sql: una función SECURITY DEFINER con FOR UPDATE sobre las
-- cuentas involucradas, que hace el débito/crédito y los movimientos en una
-- sola transacción atómica del lado del servidor. Se agrega además una
-- columna `operacion_id` para poder pedirle a esta función "aplicá esta
-- transferencia una sola vez" aunque el cliente reintente.

alter table public.movimientos add column if not exists operacion_id uuid;

create unique index if not exists movimientos_operacion_id_uidx
  on public.movimientos (operacion_id)
  where operacion_id is not null;

-- Transferencia entre dos cuentas Monix. Recibe el CBU del destino, no su
-- id: por RLS, el cliente autenticado NUNCA puede resolver el id de la
-- cuenta de otra persona (esa es justamente la causa del bug #1 de la
-- auditoría) — como esta función corre SECURITY DEFINER, sí puede buscarla
-- ella misma por CBU, sin depender de que el cliente ya la conozca.
create or replace function private.transferir_entre_cuentas(
  p_operacion_id uuid,
  p_cuenta_origen uuid,
  p_destino_cbu text,
  p_monto_origen numeric,
  p_monto_destino numeric,
  p_descripcion text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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
    raise exception 'Monto inválido';
  end if;

  perform private.enforce_rate('transferir_entre_cuentas', 30, interval '5 minutes');

  select * into v_origen from public.cuentas where id = p_cuenta_origen and activa = true;
  if not found then
    raise exception 'Tu cuenta no está disponible';
  end if;
  if v_origen.persona_id <> v_uid then
    raise exception 'No autorizado';
  end if;

  select * into v_destino from public.cuentas where cbu = p_destino_cbu and activa = true;
  if not found then
    raise exception 'La cuenta destino no está disponible';
  end if;

  if v_origen.id = v_destino.id then
    raise exception 'No podés transferirte a vos mismo';
  end if;

  -- Bloqueamos ambas cuentas en un orden fijo (el menor id primero) para
  -- que dos transferencias concurrentes que toquen las mismas dos cuentas
  -- en sentido inverso no se deadlockeen entre sí.
  v_id_a := least(v_origen.id, v_destino.id);
  v_id_b := greatest(v_origen.id, v_destino.id);

  perform 1 from public.cuentas where id in (v_id_a, v_id_b) order by id for update;

  select * into v_origen from public.cuentas where id = v_origen.id;
  select * into v_destino from public.cuentas where id = v_destino.id;

  -- Idempotencia: si esta misma operación ya se aplicó (reintento tras un
  -- error de red en la respuesta, doble click, etc.), no la volvemos a
  -- aplicar — el saldo ya se movió la primera vez que se vio este id.
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
    destinatario_dni, destino_cbu, destino_alias
  ) values (
    p_operacion_id, v_origen.id, 'transferencia_salida',
    round(p_monto_origen, 2), round(v_origen.saldo - p_monto_origen, 2), p_descripcion,
    v_destino.id, v_destino_persona.nombre, v_destino_persona.apellido,
    v_destino_persona.dni, v_destino.cbu, v_destino.alias
  );

  insert into public.movimientos (
    cuenta_id, tipo, monto, saldo_resultante, descripcion,
    cuenta_destino_id, destinatario_nombre, destinatario_apellido,
    destinatario_dni, destino_cbu, destino_alias
  ) values (
    v_destino.id, 'transferencia_entrada',
    round(p_monto_destino, 2), round(v_destino.saldo + p_monto_destino, 2), p_descripcion,
    v_origen.id, v_origen_persona.nombre, v_origen_persona.apellido,
    v_origen_persona.dni, v_origen.cbu, v_origen.alias
  );
end;
$$;

create or replace function public.transferir_entre_cuentas(
  p_operacion_id uuid,
  p_cuenta_origen uuid,
  p_destino_cbu text,
  p_monto_origen numeric,
  p_monto_destino numeric,
  p_descripcion text
)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.transferir_entre_cuentas(
    p_operacion_id, p_cuenta_origen, p_destino_cbu, p_monto_origen, p_monto_destino, p_descripcion
  );
$$;

-- Transferencia a un CBU de OTRO banco: acá sólo se descuenta la cuenta
-- propia + se deja el movimiento de salida. El movimiento real de fondos
-- entre bancos pasa por la API del Banco Central (transferir(), fuera de
-- Postgres) — este RPC sólo cubre la parte local, con la misma idempotencia
-- por operacion_id que la función de arriba.
create or replace function private.debitar_transferencia_externa(
  p_operacion_id uuid,
  p_cuenta_origen uuid,
  p_monto numeric,
  p_descripcion text,
  p_destino_cbu text,
  p_destino_alias text,
  p_destinatario_nombre text,
  p_destinatario_apellido text,
  p_destinatario_dni text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_origen public.cuentas;
  v_ya_procesada boolean;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'Monto inválido';
  end if;

  perform private.enforce_rate('debitar_transferencia_externa', 30, interval '5 minutes');

  select * into v_origen from public.cuentas where id = p_cuenta_origen and activa = true for update;
  if not found then
    raise exception 'Tu cuenta no está disponible';
  end if;
  if v_origen.persona_id <> v_uid then
    raise exception 'No autorizado';
  end if;

  select exists(
    select 1 from public.movimientos where operacion_id = p_operacion_id
  ) into v_ya_procesada;
  if v_ya_procesada then
    return;
  end if;

  if v_origen.saldo < p_monto then
    raise exception 'Saldo insuficiente para realizar la transferencia';
  end if;

  update public.cuentas set saldo = round(saldo - p_monto, 2) where id = v_origen.id;

  insert into public.movimientos (
    operacion_id, cuenta_id, tipo, monto, saldo_resultante, descripcion,
    destinatario_nombre, destinatario_apellido, destinatario_dni,
    destino_cbu, destino_alias
  ) values (
    p_operacion_id, v_origen.id, 'transferencia_salida',
    round(p_monto, 2), round(v_origen.saldo - p_monto, 2), p_descripcion,
    p_destinatario_nombre, p_destinatario_apellido, p_destinatario_dni,
    p_destino_cbu, p_destino_alias
  );
end;
$$;

create or replace function public.debitar_transferencia_externa(
  p_operacion_id uuid,
  p_cuenta_origen uuid,
  p_monto numeric,
  p_descripcion text,
  p_destino_cbu text,
  p_destino_alias text,
  p_destinatario_nombre text,
  p_destinatario_apellido text,
  p_destinatario_dni text
)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.debitar_transferencia_externa(
    p_operacion_id, p_cuenta_origen, p_monto, p_descripcion,
    p_destino_cbu, p_destino_alias, p_destinatario_nombre, p_destinatario_apellido, p_destinatario_dni
  );
$$;

-- Compra/venta de USD: swap entre dos cuentas de la MISMA persona (pesos y
-- dólares). Más simple que la transferencia entre personas — no hace falta
-- resolver nada por RLS, las dos cuentas ya son del que llama — pero tenía
-- el mismo problema de fondo: leer el saldo en el cliente, calcular y
-- pisarlo con dos UPDATE separados sin lock ni chequeo de error en el
-- insert de movimientos (bug #4 y #3 de la auditoría, en CompraVentaDolaresPage).
create or replace function private.convertir_moneda_propia(
  p_operacion_id uuid,
  p_cuenta_ars uuid,
  p_cuenta_usd uuid,
  p_monto_ars numeric,
  p_monto_usd numeric,
  p_modo text, -- 'comprar' (ARS -> USD) o 'vender' (USD -> ARS)
  p_descripcion text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_ars public.cuentas;
  v_usd public.cuentas;
  v_id_a uuid;
  v_id_b uuid;
  v_ya_procesada boolean;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if p_modo not in ('comprar', 'vender') then
    raise exception 'Modo inválido';
  end if;

  if p_monto_ars is null or p_monto_ars <= 0 or p_monto_usd is null or p_monto_usd <= 0 then
    raise exception 'Monto inválido';
  end if;

  perform private.enforce_rate('convertir_moneda_propia', 30, interval '5 minutes');

  v_id_a := least(p_cuenta_ars, p_cuenta_usd);
  v_id_b := greatest(p_cuenta_ars, p_cuenta_usd);
  perform 1 from public.cuentas where id in (v_id_a, v_id_b) order by id for update;

  select * into v_ars from public.cuentas where id = p_cuenta_ars and activa = true;
  if not found or v_ars.persona_id <> v_uid or v_ars.moneda <> 'ARS' then
    raise exception 'No autorizado';
  end if;

  select * into v_usd from public.cuentas where id = p_cuenta_usd and activa = true;
  if not found or v_usd.persona_id <> v_uid or v_usd.moneda <> 'USD' then
    raise exception 'No autorizado';
  end if;

  select exists(
    select 1 from public.movimientos where operacion_id = p_operacion_id
  ) into v_ya_procesada;
  if v_ya_procesada then
    return;
  end if;

  if p_modo = 'comprar' then
    if v_ars.saldo < p_monto_ars then
      raise exception 'No tenés saldo suficiente en pesos';
    end if;
    update public.cuentas set saldo = round(saldo - p_monto_ars, 2) where id = v_ars.id;
    update public.cuentas set saldo = round(saldo + p_monto_usd, 2) where id = v_usd.id;
  else
    if v_usd.saldo < p_monto_usd then
      raise exception 'No tenés saldo suficiente en dólares';
    end if;
    update public.cuentas set saldo = round(saldo + p_monto_ars, 2) where id = v_ars.id;
    update public.cuentas set saldo = round(saldo - p_monto_usd, 2) where id = v_usd.id;
  end if;

  insert into public.movimientos (operacion_id, cuenta_id, tipo, monto, saldo_resultante, descripcion)
  values (
    p_operacion_id, v_ars.id,
    case when p_modo = 'comprar' then 'extraccion' else 'deposito' end,
    round(p_monto_ars, 2),
    (select saldo from public.cuentas where id = v_ars.id),
    p_descripcion
  );

  insert into public.movimientos (cuenta_id, tipo, monto, saldo_resultante, descripcion)
  values (
    v_usd.id,
    case when p_modo = 'comprar' then 'deposito' else 'extraccion' end,
    round(p_monto_usd, 2),
    (select saldo from public.cuentas where id = v_usd.id),
    p_descripcion
  );
end;
$$;

create or replace function public.convertir_moneda_propia(
  p_operacion_id uuid,
  p_cuenta_ars uuid,
  p_cuenta_usd uuid,
  p_monto_ars numeric,
  p_monto_usd numeric,
  p_modo text,
  p_descripcion text
)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.convertir_moneda_propia(
    p_operacion_id, p_cuenta_ars, p_cuenta_usd, p_monto_ars, p_monto_usd, p_modo, p_descripcion
  );
$$;

do $$
declare
  r record;
begin
  for r in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in ('transferir_entre_cuentas', 'debitar_transferencia_externa', 'convertir_moneda_propia')
  loop
    execute format('revoke all on function %I.%I(%s) from public, anon, authenticated', r.nspname, r.proname, r.args);
  end loop;

  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('transferir_entre_cuentas', 'debitar_transferencia_externa', 'convertir_moneda_propia')
  loop
    execute format('revoke all on function public.%I(%s) from public, anon', r.proname, r.args);
    execute format('grant execute on function public.%I(%s) to authenticated', r.proname, r.args);
    execute format('grant execute on function public.%I(%s) to service_role', r.proname, r.args);
  end loop;
end $$;
