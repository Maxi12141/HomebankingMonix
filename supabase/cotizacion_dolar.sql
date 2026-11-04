-- El servidor deja de creerle al navegador los montos de una conversión.
-- Antes, transferir_entre_cuentas acreditaba cualquier p_monto_destino (incluso
-- negativo, que le descontaba a la cuenta ajena) y convertir_moneda_propia
-- aceptaba cualquier precio. Va después de fix_transferencia_bc_id.sql.
-- La tabla se mantiene al día con cotizacion_dolar_cron.sql.

create table if not exists private.cotizacion_dolar (
  casa text primary key,
  compra numeric not null check (compra > 0),
  venta numeric not null check (venta > 0),
  actualizada_en timestamptz not null default now()
);

-- p_modo es el lado del cliente: 'comprar' (entrega pesos) o 'vender' (entrega dólares).
-- Sólo frena lo que favorece al cliente. El 3% cubre la diferencia entre el precio
-- que vio en pantalla y el último que guardó el servidor.
create or replace function private.validar_cambio(
  p_monto_ars numeric,
  p_monto_usd numeric,
  p_modo text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cotizacion private.cotizacion_dolar;
begin
  select * into v_cotizacion from private.cotizacion_dolar where casa = 'oficial';
  if not found or v_cotizacion.actualizada_en < now() - interval '7 days' then
    raise exception 'No pudimos verificar la cotización del dólar. Probá de nuevo en un rato.';
  end if;

  if (p_modo = 'comprar' and p_monto_ars < p_monto_usd * v_cotizacion.venta * 0.97 - 0.02)
    or (p_modo = 'vender' and p_monto_ars > p_monto_usd * v_cotizacion.compra * 1.03 + 0.02) then
    raise exception 'La cotización del dólar cambió. Revisá el monto y volvé a intentar.';
  end if;
end;
$$;

revoke all on function private.validar_cambio(numeric, numeric, text) from public, anon, authenticated;

-- La base real sólo tiene la versión de 7 argumentos que llama TransferPage.
-- La de 6 quedó en transferencia_atomica.sql y no valida nada: no puede seguir disponible.
drop function if exists public.transferir_entre_cuentas(uuid, uuid, text, numeric, numeric, text);
drop function if exists private.transferir_entre_cuentas(uuid, uuid, text, numeric, numeric, text);

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
  v_monto_destino numeric;
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

  -- En la misma moneda el destino recibe lo que sale del origen, sin importar lo que mande el navegador.
  if v_origen.moneda = v_destino.moneda then
    v_monto_destino := p_monto_origen;
  else
    if p_monto_destino is null or p_monto_destino <= 0 then
      raise exception 'Monto invalido';
    end if;
    v_monto_destino := p_monto_destino;
    if v_origen.moneda = 'ARS' then
      perform private.validar_cambio(p_monto_origen, v_monto_destino, 'comprar');
    else
      perform private.validar_cambio(v_monto_destino, p_monto_origen, 'vender');
    end if;
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
  update public.cuentas set saldo = round(saldo + v_monto_destino, 2) where id = v_destino.id;

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
    round(v_monto_destino, 2), round(v_destino.saldo + v_monto_destino, 2), p_descripcion,
    v_origen.id, v_origen_persona.nombre, v_origen_persona.apellido,
    v_origen_persona.dni, v_origen.cbu, v_origen.alias, null
  );
end;
$function$;

create or replace function public.transferir_entre_cuentas(
  p_operacion_id uuid,
  p_cuenta_origen uuid,
  p_destino_cbu text,
  p_monto_origen numeric,
  p_monto_destino numeric,
  p_descripcion text,
  p_bc_transaccion_id text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.transferir_entre_cuentas(
    p_operacion_id, p_cuenta_origen, p_destino_cbu, p_monto_origen, p_monto_destino, p_descripcion, p_bc_transaccion_id
  );
$$;

revoke all on function public.transferir_entre_cuentas(uuid, uuid, text, numeric, numeric, text, text) from public, anon;
grant execute on function public.transferir_entre_cuentas(uuid, uuid, text, numeric, numeric, text, text) to authenticated;
revoke all on function private.transferir_entre_cuentas(uuid, uuid, text, numeric, numeric, text, text) from public, anon, authenticated;

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
  perform private.validar_cambio(p_monto_ars, p_monto_usd, p_modo);

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
