-- S-1 · Paso 1 de 3: el saldo sólo cambia en el servidor.
--
-- Auditoría 2026-10 (docs/auditoria-2026-10.md, V2): las políticas RLS dejaban
-- que cualquier usuario logueado escribiera su propio saldo, sus préstamos, su
-- situación crediticia y sus movimientos desde la consola del navegador.
--
-- Esta migración es ADITIVA: crea una RPC SECURITY DEFINER por cada escritura
-- que hoy hace el navegador, valida y escribe todo en una sola transacción, y
-- no le quita nada al cliente. Orden de despliegue (ver manual-despliegue.md):
--   1. Aplicar este archivo (la app vieja sigue funcionando igual).
--   2. Desplegar el front que llama a estas RPC y la Edge Function
--      sincronizar-entrantes.
--   3. Aplicar s1_revocar_escrituras.sql, que le quita al cliente el permiso
--      de escribir esas tablas. Al revés, producción se rompe.
--
-- Requiere: cobros_qr.sql (private.enforce_rate), reservas.sql, prestamos.sql,
-- transferencia_atomica.sql (movimientos.operacion_id).

-- ─── Helpers ────────────────────────────────────────────────────────────────

-- Interés compuesto diario, igual que calcInterestForDays (useReserva.ts).
create or replace function private.interes_compuesto(p_saldo numeric, p_tasa_anual numeric, p_dias integer)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when p_saldo <= 0 or p_dias <= 0 or p_tasa_anual <= 0 then 0::numeric
    else round(p_saldo * (power(1 + p_tasa_anual / 100 / 365, p_dias) - 1), 2)
  end;
$$;

-- Cuenta activa del usuario logueado, bloqueada para esta transacción.
create or replace function private.cuenta_propia(p_cuenta_id uuid)
returns public.cuentas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cuenta public.cuentas;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  select * into v_cuenta
  from public.cuentas
  where id = p_cuenta_id and persona_id = auth.uid() and activa = true
  for update;
  if not found then
    raise exception 'No autorizado';
  end if;
  return v_cuenta;
end;
$$;

create or replace function private.validar_monto(p_monto numeric)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_monto is null or p_monto <= 0 or p_monto <> round(p_monto, 2) then
    raise exception 'Ingresá un monto válido';
  end if;
  return p_monto;
end;
$$;

-- "$ 1.500.000" para los mensajes de error.
create or replace function private.formato_ars(p_monto numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select '$ ' || replace(to_char(round(p_monto), 'FM999,999,999,999'), ',', '.');
$$;

-- ─── Depositar: pasa a SECURITY DEFINER ─────────────────────────────────────
-- Antes corría con los permisos del usuario y dependía de que pudiera hacer
-- UPDATE sobre cuentas. Mismo comportamiento; deja de depender de ese permiso.
create or replace function public.depositar_en_cuenta(
  p_cuenta_id uuid,
  p_monto numeric,
  p_descripcion text default null
)
returns numeric
language plpgsql
security definer
set search_path = ''
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
  values (p_cuenta_id, 'deposito', round(p_monto, 2), v_nuevo, nullif(btrim(p_descripcion), ''));

  return v_nuevo;
end;
$$;

-- ─── Interés diario de las cuentas (antes: accrueInterest en useCuenta.ts) ──
create or replace function public.acreditar_interes_cuentas()
returns table (cuenta_id uuid, interes numeric)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  c public.cuentas;
  v_dias integer;
  v_interes numeric;
  v_nuevo numeric;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  for c in
    select * from public.cuentas
    where persona_id = auth.uid() and activa = true
    order by id
    for update
  loop
    v_interes := 0;
    if c.ultima_interes_at is null then
      update public.cuentas set ultima_interes_at = now(), tasa_anual = coalesce(tasa_anual, 32) where id = c.id;
    else
      v_dias := floor(extract(epoch from (now() - c.ultima_interes_at)) / 86400);
      v_interes := private.interes_compuesto(c.saldo, coalesce(c.tasa_anual, 32), v_dias);
      if v_interes > 0 then
        update public.cuentas
        set saldo = round(saldo + v_interes, 2),
            ultima_interes_at = c.ultima_interes_at + make_interval(days => v_dias),
            tasa_anual = coalesce(tasa_anual, 32)
        where id = c.id
        returning saldo into v_nuevo;

        insert into public.movimientos (cuenta_id, tipo, monto, saldo_resultante, descripcion)
        values (c.id, 'deposito', v_interes, v_nuevo, 'Rendimiento de Reserva');
      end if;
    end if;
    cuenta_id := c.id;
    interes := v_interes;
    return next;
  end loop;
end;
$$;

-- ─── Reserva: alta y rendimiento (antes: useReserva.ts) ─────────────────────
create or replace function public.preparar_reserva(p_cuenta_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cuenta public.cuentas := private.cuenta_propia(p_cuenta_id);
  r public.reservas;
  v_dias integer;
  v_interes numeric := 0;
begin
  insert into public.reservas (cuenta_id, saldo, tasa_anual)
  values (v_cuenta.id, 0, 32)
  on conflict (cuenta_id) do nothing;

  select * into r from public.reservas where cuenta_id = v_cuenta.id for update;

  v_dias := floor(extract(epoch from (now() - r.ultima_interes_at)) / 86400);
  v_interes := private.interes_compuesto(r.saldo, r.tasa_anual, v_dias);
  if v_interes > 0 then
    update public.reservas
    set saldo = round(saldo + v_interes, 2),
        ultima_interes_at = r.ultima_interes_at + make_interval(days => v_dias)
    where id = r.id
    returning * into r;

    insert into public.movimientos (cuenta_id, tipo, monto, saldo_resultante, descripcion)
    values (v_cuenta.id, 'deposito', v_interes, r.saldo, 'Rendimiento de Reserva');
  end if;

  return json_build_object('reserva', row_to_json(r), 'interes', v_interes);
end;
$$;

-- ─── Reserva: ingresar o retirar, atómico (antes: ReservasPage.tsx) ─────────
-- Antes eran tres llamadas separadas: si la segunda fallaba, la plata se
-- debitaba de un lado y no llegaba al otro.
create or replace function public.mover_reserva(p_cuenta_id uuid, p_monto numeric, p_modo text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cuenta public.cuentas;
  v_monto numeric := private.validar_monto(p_monto);
  r public.reservas;
  v_saldo_cuenta numeric;
begin
  if p_modo not in ('ingresar', 'retirar') then
    raise exception 'Operación inválida';
  end if;
  perform private.enforce_rate('mover_reserva', 30, interval '5 minutes');
  v_cuenta := private.cuenta_propia(p_cuenta_id);

  select * into r from public.reservas where cuenta_id = v_cuenta.id for update;
  if not found then
    raise exception 'No encontramos tu reserva';
  end if;

  if p_modo = 'ingresar' then
    if v_cuenta.saldo < v_monto then
      raise exception 'No tenés saldo suficiente en tu cuenta';
    end if;
    update public.cuentas set saldo = round(saldo - v_monto, 2) where id = v_cuenta.id returning saldo into v_saldo_cuenta;
    update public.reservas set saldo = round(saldo + v_monto, 2) where id = r.id returning * into r;
    insert into public.movimientos (cuenta_id, tipo, monto, saldo_resultante, descripcion)
    values (v_cuenta.id, 'extraccion', v_monto, v_saldo_cuenta, 'Reserva|Ingreso a ahorro MONIX');
  else
    if r.saldo < v_monto then
      raise exception 'No te alcanza lo que tenés en la reserva para retirar ese monto.';
    end if;
    update public.reservas set saldo = round(saldo - v_monto, 2) where id = r.id returning * into r;
    update public.cuentas set saldo = round(saldo + v_monto, 2) where id = v_cuenta.id returning saldo into v_saldo_cuenta;
    insert into public.movimientos (cuenta_id, tipo, monto, saldo_resultante, descripcion)
    values (v_cuenta.id, 'deposito', v_monto, v_saldo_cuenta, 'Reserva|Retiro de ahorro MONIX');
  end if;

  return json_build_object('saldo_cuenta', v_saldo_cuenta, 'saldo_reserva', r.saldo);
end;
$$;

-- ─── mercadoMONIX (antes: MercadoMonixPage.tsx) ─────────────────────────────
create or replace function public.comprar_mercado(p_cuenta_id uuid, p_monto numeric, p_detalle text)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cuenta public.cuentas;
  v_monto numeric := private.validar_monto(p_monto);
  v_nuevo numeric;
begin
  perform private.enforce_rate('comprar_mercado', 20, interval '5 minutes');
  v_cuenta := private.cuenta_propia(p_cuenta_id);
  if v_cuenta.saldo < v_monto then
    raise exception 'No tenés saldo suficiente en tu cuenta';
  end if;

  update public.cuentas set saldo = round(saldo - v_monto, 2) where id = v_cuenta.id returning saldo into v_nuevo;
  insert into public.movimientos (cuenta_id, tipo, monto, saldo_resultante, descripcion)
  values (v_cuenta.id, 'extraccion', v_monto, v_nuevo, 'mercadoMONIX|' || left(coalesce(btrim(p_detalle), 'Compra'), 120));
  return v_nuevo;
end;
$$;

-- ─── Préstamos: alta (antes: PrestamosPage.tsx) ─────────────────────────────
-- La oferta se recalcula acá con las mismas reglas que utils/prestamos.ts.
-- La situación crediticia la consulta el navegador al Banco Central; como no
-- se puede verificar desde acá, se usa la PEOR entre esa y la que Monix
-- registró al dar de alta a la persona (que el usuario ya no puede editar).
create or replace function public.solicitar_prestamo(
  p_cuenta_id uuid,
  p_monto numeric,
  p_cuotas integer,
  p_situacion integer
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_persona public.personas;
  v_cuenta public.cuentas;
  v_monto numeric := private.validar_monto(p_monto);
  v_sit integer;
  v_ajuste numeric;
  v_monto_max numeric;
  v_cuotas_max integer;
  v_tna numeric;
  v_ratio numeric;
  v_i numeric;
  v_f numeric;
  v_cuota numeric;
  v_nuevo numeric;
begin
  perform private.enforce_rate('solicitar_prestamo', 5, interval '1 hour');
  select * into v_persona from public.personas where id = auth.uid();
  if not found then
    raise exception 'No autorizado';
  end if;
  if v_persona.ingreso_mensual is null then
    raise exception 'Declará tu ingreso mensual en tu Perfil para poder solicitar un préstamo.';
  end if;

  v_sit := least(greatest(coalesce(p_situacion, 1), coalesce(v_persona.situacion_crediticia_monix, 1), 1), 5);
  select a, m, c into v_ajuste, v_monto_max, v_cuotas_max
  from (values (1, 0, 8000000, 24), (2, 8, 4000000, 18), (3, 18, 1200000, 12), (4, 30, 300000, 6), (5, 0, 0, 0))
    as niveles(s, a, m, c)
  where s = v_sit;
  if v_cuotas_max = 0 then
    raise exception 'Por ahora no podemos ofrecerte un préstamo.';
  end if;

  v_tna := greatest(85 + v_ajuste - case when v_persona.sueldo_acreditado then 12 else 0 end, 0);
  v_monto_max := round(v_monto_max * case when v_persona.sueldo_acreditado then 1.5 else 1 end);
  v_ratio := case when v_persona.sueldo_acreditado then 0.35 else 0.30 end;

  if p_cuotas is null or p_cuotas < 1 or p_cuotas > v_cuotas_max then
    raise exception 'Esta oferta admite hasta % cuotas', v_cuotas_max;
  end if;
  if v_monto > v_monto_max then
    raise exception 'Esta oferta admite hasta %', private.formato_ars(v_monto_max);
  end if;

  -- Cuota fija, sistema francés (calcularCuota en utils/prestamos.ts).
  v_i := v_tna / 100 / 12;
  if v_i = 0 then
    v_cuota := round(v_monto / p_cuotas, 2);
  else
    v_f := power(1 + v_i, p_cuotas);
    v_cuota := round(v_monto * v_i * v_f / (v_f - 1), 2);
  end if;
  if v_cuota > v_persona.ingreso_mensual * v_ratio then
    raise exception '%', 'La cuota no puede superar el ' || round(v_ratio * 100) || '% de tu ingreso declarado ('
      || private.formato_ars(v_persona.ingreso_mensual * v_ratio) || ').';
  end if;

  v_cuenta := private.cuenta_propia(p_cuenta_id);
  if v_cuenta.moneda <> 'ARS' then
    raise exception 'Los préstamos se acreditan en tu cuenta en pesos';
  end if;

  insert into public.prestamos (cuenta_id, monto, cuotas_totales, cuota_monto, tna, situacion_bcra, sueldo_acreditado, proxima_cuota_at)
  values (v_cuenta.id, v_monto, p_cuotas, v_cuota, v_tna, v_sit, v_persona.sueldo_acreditado, now() + interval '1 month');

  update public.cuentas set saldo = round(saldo + v_monto, 2) where id = v_cuenta.id returning saldo into v_nuevo;
  insert into public.movimientos (cuenta_id, tipo, monto, saldo_resultante, descripcion)
  values (v_cuenta.id, 'deposito', v_monto, v_nuevo, 'Préstamo otorgado');

  return json_build_object('saldo', v_nuevo, 'cuota', v_cuota, 'tna', v_tna, 'situacion', v_sit);
end;
$$;

-- ─── Préstamos: cobro de cuotas vencidas (antes: usePrestamos.ts) ───────────
create or replace function public.cobrar_cuotas_prestamos(p_cuenta_id uuid)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cuenta public.cuentas := private.cuenta_propia(p_cuenta_id);
  v_saldo numeric := v_cuenta.saldo;
  p public.prestamos;
  v_pagadas integer;
  v_proxima timestamptz;
begin
  for p in
    select * from public.prestamos
    where cuenta_id = v_cuenta.id and estado = 'activo'
    order by created_at
    for update
  loop
    v_pagadas := p.cuotas_pagadas;
    v_proxima := p.proxima_cuota_at;
    -- Sin saldo, la cuota queda atrasada y se reintenta en la próxima carga.
    while v_proxima <= now() and v_pagadas < p.cuotas_totales and v_saldo >= p.cuota_monto loop
      v_saldo := round(v_saldo - p.cuota_monto, 2);
      v_pagadas := v_pagadas + 1;
      v_proxima := v_proxima + interval '1 month';
      insert into public.movimientos (cuenta_id, tipo, monto, saldo_resultante, descripcion)
      values (v_cuenta.id, 'extraccion', p.cuota_monto, v_saldo, 'Cuota préstamo ' || v_pagadas || '/' || p.cuotas_totales);
    end loop;
    if v_pagadas <> p.cuotas_pagadas then
      update public.prestamos
      set cuotas_pagadas = v_pagadas,
          proxima_cuota_at = v_proxima,
          estado = case when v_pagadas >= p.cuotas_totales then 'pagado' else 'activo' end
      where id = p.id;
    end if;
  end loop;

  if v_saldo <> v_cuenta.saldo then
    update public.cuentas set saldo = v_saldo where id = v_cuenta.id;
  end if;
  return v_saldo;
end;
$$;

-- ─── Alta de cliente (antes: RegisterPage.tsx) ──────────────────────────────
-- Persona, caja de ahorro en pesos con el bono de bienvenida y su movimiento,
-- en una sola transacción. La situación crediticia ficticia inicial la elige
-- el servidor (misma distribución que situacionCrediticiaFicticia) y se
-- devuelve para que el navegador se la informe al Banco Central.
create or replace function public.alta_cliente(
  p_nombre text,
  p_apellido text,
  p_dni text,
  p_email text,
  p_telefono text,
  p_fecha_nac date,
  p_direccion text,
  p_numero_cuenta text,
  p_cbu text,
  p_alias text
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_bono constant numeric := 150000; -- BONO_BIENVENIDA en lib/onboarding.ts
  v_tiro numeric := random() * 100;
  v_sit integer;
  v_min numeric;
  v_max numeric;
  v_deuda numeric;
  v_cuenta_id uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if exists (select 1 from public.personas where id = auth.uid()) then
    raise exception 'Ya tenés una cuenta en Monix';
  end if;

  -- Pesos 50/28/12/7/3, iguales a DISTRIBUCION_SITUACION.
  select s, mn, mx into v_sit, v_min, v_max
  from (values (1, 50, 0, 0), (2, 78, 10000, 40000), (3, 90, 150000, 350000), (4, 97, 600000, 900000), (5, 100, 2000000, 4500000))
    as d(s, hasta, mn, mx)
  where v_tiro < hasta
  order by hasta
  limit 1;
  v_deuda := round((v_min + random() * (v_max - v_min)) / 1000) * 1000;

  insert into public.personas (id, nombre, apellido, dni, email, telefono, fecha_nac, direccion, situacion_crediticia_monix)
  values (auth.uid(), btrim(p_nombre), btrim(p_apellido), btrim(p_dni), btrim(p_email), nullif(btrim(p_telefono), ''), p_fecha_nac, nullif(btrim(p_direccion), ''), v_sit);

  insert into public.cuentas (persona_id, numero_cuenta, tipo, moneda, saldo, activa, cbu, alias)
  values (auth.uid(), p_numero_cuenta, 'caja_ahorro', 'ARS', c_bono, true, p_cbu, p_alias)
  returning id into v_cuenta_id;

  insert into public.movimientos (cuenta_id, tipo, monto, saldo_resultante, descripcion)
  values (v_cuenta_id, 'deposito', c_bono, c_bono, 'Bono de bienvenida');

  return json_build_object('cuenta_id', v_cuenta_id, 'situacion', v_sit, 'monto_deuda', v_deuda);
end;
$$;

create or replace function public.marcar_situacion_informada()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.personas set situacion_informada_at = now()
  where id = auth.uid() and situacion_informada_at is null;
$$;

-- ─── Cuenta en dólares (antes: CuentasPage.tsx) ─────────────────────────────
create or replace function public.abrir_cuenta_usd(p_numero_cuenta text, p_cbu text, p_alias text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not exists (select 1 from public.personas where id = auth.uid()) then
    raise exception 'No autorizado';
  end if;
  if exists (select 1 from public.cuentas where persona_id = auth.uid() and moneda = 'USD' and activa = true) then
    raise exception 'Ya tenés una cuenta en dólares';
  end if;
  insert into public.cuentas (persona_id, numero_cuenta, tipo, moneda, saldo, activa, cbu, alias)
  values (auth.uid(), p_numero_cuenta, 'caja_ahorro', 'USD', 0, true, p_cbu, p_alias)
  returning id into v_id;
  return v_id;
end;
$$;

-- ─── Transferencias entrantes de otros bancos ───────────────────────────────
-- SÓLO la llama la Edge Function sincronizar-entrantes (service_role), que es
-- la que consulta al Banco Central con su propia API key. El navegador no
-- puede: si pudiera, le bastaría inventar una transferencia para acreditarse.
create or replace function public.acreditar_transferencia_entrante(
  p_cuenta_id uuid,
  p_bc_transaccion_id text,
  p_importe numeric,
  p_banco_codigo_origen integer,
  p_nombre text,
  p_apellido text,
  p_dni text,
  p_cbu_origen text,
  p_alias_origen text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nuevo numeric;
begin
  perform private.validar_monto(p_importe);
  -- Bloquear la cuenta serializa las pasadas: dos sincronizaciones a la vez
  -- no pueden acreditar dos veces la misma transferencia.
  perform 1 from public.cuentas where id = p_cuenta_id and activa = true for update;
  if not found then
    return false;
  end if;
  if exists (select 1 from public.movimientos where cuenta_id = p_cuenta_id and bc_transaccion_id = p_bc_transaccion_id) then
    return false;
  end if;
  -- Monix → Monix ya la registra transferir_entre_cuentas.
  if exists (select 1 from public.cuentas where cbu = p_cbu_origen) then
    return false;
  end if;

  update public.cuentas set saldo = round(saldo + p_importe, 2) where id = p_cuenta_id returning saldo into v_nuevo;
  insert into public.movimientos (
    cuenta_id, tipo, monto, saldo_resultante, bc_transaccion_id, banco_codigo_origen,
    destinatario_nombre, destinatario_apellido, destinatario_dni, destino_cbu, destino_alias
  ) values (
    p_cuenta_id, 'transferencia_entrada', p_importe, v_nuevo, p_bc_transaccion_id, p_banco_codigo_origen,
    p_nombre, p_apellido, p_dni, p_cbu_origen, p_alias_origen
  );
  return true;
end;
$$;

-- ─── Permisos ───────────────────────────────────────────────────────────────
revoke all on function private.interes_compuesto(numeric, numeric, integer) from public, anon, authenticated;
revoke all on function private.cuenta_propia(uuid) from public, anon, authenticated;
revoke all on function private.validar_monto(numeric) from public, anon, authenticated;
revoke all on function private.formato_ars(numeric) from public, anon, authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.depositar_en_cuenta(uuid, numeric, text)',
    'public.acreditar_interes_cuentas()',
    'public.preparar_reserva(uuid)',
    'public.mover_reserva(uuid, numeric, text)',
    'public.comprar_mercado(uuid, numeric, text)',
    'public.solicitar_prestamo(uuid, numeric, integer, integer)',
    'public.cobrar_cuotas_prestamos(uuid)',
    'public.alta_cliente(text, text, text, text, text, date, text, text, text, text)',
    'public.marcar_situacion_informada()',
    'public.abrir_cuenta_usd(text, text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end;
$$;

revoke all on function public.acreditar_transferencia_entrante(uuid, text, numeric, integer, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.acreditar_transferencia_entrante(uuid, text, numeric, integer, text, text, text, text, text) to service_role;
