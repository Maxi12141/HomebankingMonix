-- Metas comunes: pool de ahorro grupal. El saldo rinde TNA 32% (como Reservas)
-- y no sale sin mayoría de los integrantes.

create table if not exists public.metas_comunes (
  id uuid primary key default gen_random_uuid(),
  creador_id uuid not null references public.personas(id) on delete restrict,
  titulo text not null,
  proposito text not null default '',
  objetivo_monto numeric(14,2),
  saldo numeric(14,2) not null default 0,
  tasa_anual numeric(6,2) not null default 32.00,
  rendimiento_acumulado numeric(14,2) not null default 0,
  ultima_interes_at timestamptz not null default now(),
  codigo_invitacion text not null,
  estado text not null default 'abierta',
  created_at timestamptz not null default now(),
  constraint metas_comunes_titulo_chk check (char_length(btrim(titulo)) between 3 and 80),
  constraint metas_comunes_proposito_chk check (char_length(proposito) <= 120),
  constraint metas_comunes_objetivo_chk check (objetivo_monto is null or objetivo_monto >= 0),
  constraint metas_comunes_saldo_chk check (saldo >= 0),
  constraint metas_comunes_tasa_chk check (tasa_anual >= 0),
  constraint metas_comunes_estado_chk check (estado in ('abierta', 'votacion', 'desembolsada'))
);

create unique index if not exists metas_comunes_codigo_uidx
  on public.metas_comunes (codigo_invitacion);

create index if not exists metas_comunes_creador_idx
  on public.metas_comunes (creador_id);

create table if not exists public.metas_miembros (
  id uuid primary key default gen_random_uuid(),
  meta_id uuid not null references public.metas_comunes(id) on delete cascade,
  persona_id uuid not null references public.personas(id) on delete restrict,
  cuenta_id uuid not null references public.cuentas(id) on delete restrict,
  rol text not null default 'miembro',
  aporte_total numeric(14,2) not null default 0,
  estado text not null default 'activo',
  created_at timestamptz not null default now(),
  constraint metas_miembros_rol_chk check (rol in ('creador', 'miembro')),
  constraint metas_miembros_estado_chk check (estado in ('activo')),
  constraint metas_miembros_aporte_chk check (aporte_total >= 0),
  constraint metas_miembros_persona_uidx unique (meta_id, persona_id)
);

create index if not exists metas_miembros_persona_idx
  on public.metas_miembros (persona_id);

create index if not exists metas_miembros_meta_idx
  on public.metas_miembros (meta_id);

create table if not exists public.metas_aportes (
  id uuid primary key default gen_random_uuid(),
  meta_id uuid not null references public.metas_comunes(id) on delete cascade,
  persona_id uuid references public.personas(id) on delete restrict,
  monto numeric(14,2) not null,
  tipo text not null default 'aporte',
  created_at timestamptz not null default now(),
  constraint metas_aportes_tipo_chk check (tipo in ('aporte', 'rendimiento', 'pago', 'devolucion')),
  constraint metas_aportes_monto_chk check (monto <> 0)
);

create index if not exists metas_aportes_meta_idx
  on public.metas_aportes (meta_id, created_at desc);

create table if not exists public.metas_votaciones (
  id uuid primary key default gen_random_uuid(),
  meta_id uuid not null references public.metas_comunes(id) on delete cascade,
  propuesta_por uuid not null references public.personas(id) on delete restrict,
  tipo text not null,
  destino_cbu text,
  destino_alias text,
  destino_nombre text,
  concepto text,
  estado text not null default 'abierta',
  created_at timestamptz not null default now(),
  executed_at timestamptz,
  constraint metas_votaciones_tipo_chk check (tipo in ('pagar', 'devolver')),
  constraint metas_votaciones_estado_chk check (estado in ('abierta', 'aprobada', 'rechazada', 'ejecutada'))
);

create unique index if not exists metas_votaciones_abierta_uidx
  on public.metas_votaciones (meta_id)
  where estado = 'abierta';

create index if not exists metas_votaciones_meta_idx
  on public.metas_votaciones (meta_id, created_at desc);

create table if not exists public.metas_votos (
  id uuid primary key default gen_random_uuid(),
  votacion_id uuid not null references public.metas_votaciones(id) on delete cascade,
  persona_id uuid not null references public.personas(id) on delete restrict,
  a_favor boolean not null,
  created_at timestamptz not null default now(),
  constraint metas_votos_persona_uidx unique (votacion_id, persona_id)
);

create index if not exists metas_votos_votacion_idx
  on public.metas_votos (votacion_id);

alter table public.metas_comunes enable row level security;
alter table public.metas_miembros enable row level security;
alter table public.metas_aportes enable row level security;
alter table public.metas_votaciones enable row level security;
alter table public.metas_votos enable row level security;

create or replace function public.usuario_en_meta(p_meta_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.metas_miembros
    where meta_id = p_meta_id
      and persona_id = (select auth.uid())
      and estado = 'activo'
  );
$$;

revoke all on function public.usuario_en_meta(uuid) from public, anon;
grant execute on function public.usuario_en_meta(uuid) to authenticated, service_role;

drop policy if exists metas_comunes_select on public.metas_comunes;
create policy metas_comunes_select on public.metas_comunes
  for select to authenticated
  using (public.usuario_en_meta(id));

drop policy if exists metas_miembros_select on public.metas_miembros;
create policy metas_miembros_select on public.metas_miembros
  for select to authenticated
  using (public.usuario_en_meta(meta_id));

drop policy if exists metas_aportes_select on public.metas_aportes;
create policy metas_aportes_select on public.metas_aportes
  for select to authenticated
  using (public.usuario_en_meta(meta_id));

drop policy if exists metas_votaciones_select on public.metas_votaciones;
create policy metas_votaciones_select on public.metas_votaciones
  for select to authenticated
  using (public.usuario_en_meta(meta_id));

drop policy if exists metas_votos_select on public.metas_votos;
create policy metas_votos_select on public.metas_votos
  for select to authenticated
  using (
    exists (
      select 1 from public.metas_votaciones v
      where v.id = metas_votos.votacion_id
        and public.usuario_en_meta(v.meta_id)
    )
  );

revoke all on table public.metas_comunes from public, anon, authenticated;
revoke all on table public.metas_miembros from public, anon, authenticated;
revoke all on table public.metas_aportes from public, anon, authenticated;
revoke all on table public.metas_votaciones from public, anon, authenticated;
revoke all on table public.metas_votos from public, anon, authenticated;
grant select on table public.metas_comunes to authenticated, service_role;
grant select on table public.metas_miembros to authenticated, service_role;
grant select on table public.metas_aportes to authenticated, service_role;
grant select on table public.metas_votaciones to authenticated, service_role;
grant select on table public.metas_votos to authenticated, service_role;

create or replace function private.meta_codigo_nuevo()
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_codigo text;
begin
  loop
    v_codigo := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    exit when not exists (
      select 1 from public.metas_comunes where codigo_invitacion = v_codigo
    );
  end loop;
  return v_codigo;
end;
$$;

create or replace function private.meta_devengar(p_meta_id uuid)
returns public.metas_comunes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta public.metas_comunes;
  v_days integer;
  v_interes numeric(14,2);
begin
  select * into v_meta
  from public.metas_comunes
  where id = p_meta_id
  for update;
  if not found then
    raise exception 'No encontramos esa meta';
  end if;
  if v_meta.estado = 'desembolsada' or v_meta.saldo <= 0 then
    return v_meta;
  end if;
  v_days := floor(extract(epoch from (now() - v_meta.ultima_interes_at)) / 86400);
  if v_days <= 0 or v_meta.tasa_anual <= 0 then
    return v_meta;
  end if;
  v_interes := round(
    v_meta.saldo * (power(1 + (v_meta.tasa_anual / 100 / 365), v_days) - 1),
    2
  );
  if v_interes <= 0 then
    update public.metas_comunes
      set ultima_interes_at = ultima_interes_at + (v_days * interval '1 day')
      where id = v_meta.id
      returning * into v_meta;
    return v_meta;
  end if;
  update public.metas_comunes
    set saldo = round(saldo + v_interes, 2),
        rendimiento_acumulado = round(rendimiento_acumulado + v_interes, 2),
        ultima_interes_at = ultima_interes_at + (v_days * interval '1 day')
    where id = v_meta.id
    returning * into v_meta;
  insert into public.metas_aportes (meta_id, persona_id, monto, tipo)
  values (v_meta.id, null, v_interes, 'rendimiento');
  return v_meta;
end;
$$;

create or replace function private.meta_requiere_miembro(p_meta_id uuid)
returns public.metas_miembros
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_miembro public.metas_miembros;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  select * into v_miembro
  from public.metas_miembros
  where meta_id = p_meta_id
    and persona_id = v_uid
    and estado = 'activo';
  if not found then
    raise exception 'No formás parte de esta meta';
  end if;
  return v_miembro;
end;
$$;

create or replace function private.meta_detalle(p_meta_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_meta public.metas_comunes;
  v_n integer;
  v_necesarios integer;
  v_votacion public.metas_votaciones;
  v_a_favor integer := 0;
  v_en_contra integer := 0;
  v_diario numeric(14,2);
begin
  select * into v_meta from public.metas_comunes where id = p_meta_id;
  if not found then
    raise exception 'No encontramos esa meta';
  end if;

  select count(*)::integer into v_n
  from public.metas_miembros
  where meta_id = p_meta_id and estado = 'activo';
  v_necesarios := (v_n / 2) + 1;

  select * into v_votacion
  from public.metas_votaciones
  where meta_id = p_meta_id and estado = 'abierta'
  order by created_at desc
  limit 1;

  if v_votacion.id is not null then
    select
      coalesce(sum(case when a_favor then 1 else 0 end), 0)::integer,
      coalesce(sum(case when not a_favor then 1 else 0 end), 0)::integer
    into v_a_favor, v_en_contra
    from public.metas_votos
    where votacion_id = v_votacion.id;
  end if;

  if v_meta.saldo > 0 and v_meta.tasa_anual > 0 then
    v_diario := round(v_meta.saldo * (power(1 + (v_meta.tasa_anual / 100 / 365), 1) - 1), 2);
  else
    v_diario := 0;
  end if;

  return jsonb_build_object(
    'id', v_meta.id,
    'titulo', v_meta.titulo,
    'proposito', v_meta.proposito,
    'objetivo', v_meta.objetivo_monto,
    'saldo', v_meta.saldo,
    'tasaAnual', v_meta.tasa_anual,
    'rendimientoAcumulado', v_meta.rendimiento_acumulado,
    'codigo', v_meta.codigo_invitacion,
    'estado', v_meta.estado,
    'creadorId', v_meta.creador_id,
    'createdAt', v_meta.created_at,
    'estimacionDiaria', v_diario,
    'miembros', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'personaId', m.persona_id,
        'nombre', p.nombre,
        'apellido', p.apellido,
        'rol', m.rol,
        'aporteTotal', m.aporte_total
      ) order by m.aporte_total desc, p.apellido), '[]'::jsonb)
      from public.metas_miembros m
      join public.personas p on p.id = m.persona_id
      where m.meta_id = p_meta_id and m.estado = 'activo'
    ),
    'aportes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id,
        'nombre', p.nombre,
        'apellido', p.apellido,
        'monto', a.monto,
        'tipo', a.tipo,
        'createdAt', a.created_at
      ) order by a.created_at desc), '[]'::jsonb)
      from (
        select * from public.metas_aportes
        where meta_id = p_meta_id
        order by created_at desc
        limit 40
      ) a
      left join public.personas p on p.id = a.persona_id
    ),
    'votacion', case when v_votacion.id is null then null else jsonb_build_object(
      'id', v_votacion.id,
      'tipo', v_votacion.tipo,
      'destinoCbu', v_votacion.destino_cbu,
      'destinoAlias', v_votacion.destino_alias,
      'destinoNombre', v_votacion.destino_nombre,
      'concepto', v_votacion.concepto,
      'estado', v_votacion.estado,
      'aFavor', v_a_favor,
      'enContra', v_en_contra,
      'necesarios', v_necesarios,
      'miembros', v_n,
      'miVoto', (
        select vt.a_favor
        from public.metas_votos vt
        where vt.votacion_id = v_votacion.id and vt.persona_id = v_uid
      ),
      'votos', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'personaId', p.id,
          'nombre', p.nombre,
          'apellido', p.apellido,
          'aFavor', vt.a_favor
        ) order by vt.created_at), '[]'::jsonb)
        from public.metas_votos vt
        join public.personas p on p.id = vt.persona_id
        where vt.votacion_id = v_votacion.id
      )
    ) end
  );
end;
$$;

create or replace function private.meta_ejecutar_votacion(p_votacion_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_votacion public.metas_votaciones;
  v_meta public.metas_comunes;
  v_destino public.cuentas;
  v_persona public.personas;
  v_miembro public.metas_miembros;
  v_monto numeric(14,2);
  v_suma numeric(14,2);
  v_restante numeric(14,2);
  v_parte numeric(14,2);
  v_n integer := 0;
  v_i integer := 0;
begin
  select * into v_votacion
  from public.metas_votaciones
  where id = p_votacion_id
  for update;
  if not found or v_votacion.estado is distinct from 'abierta' then
    return;
  end if;

  v_meta := private.meta_devengar(v_votacion.meta_id);
  v_monto := v_meta.saldo;
  if v_monto <= 0 then
    raise exception 'La meta no tiene saldo para desembolsar';
  end if;

  if v_votacion.tipo = 'pagar' then
    v_destino := null::public.cuentas;
    if v_votacion.destino_cbu is not null then
      select * into v_destino from public.cuentas
      where cbu = v_votacion.destino_cbu and activa = true and moneda = 'ARS';
    end if;
    if v_destino.id is null and v_votacion.destino_alias is not null then
      select * into v_destino from public.cuentas
      where lower(alias) = lower(v_votacion.destino_alias) and activa = true and moneda = 'ARS';
    end if;
    if v_destino.id is null then
      raise exception 'El pago de la meta sale a una cuenta Monix. Si es otro banco, devolvé entre ustedes y transferí';
    end if;

    perform 1 from public.cuentas where id = v_destino.id for update;
    select * into v_destino from public.cuentas where id = v_destino.id;
    select * into v_persona from public.personas where id = v_destino.persona_id;

    update public.cuentas
      set saldo = round(saldo + v_monto, 2)
      where id = v_destino.id;

    insert into public.movimientos (
      cuenta_id, tipo, monto, saldo_resultante, descripcion,
      destinatario_nombre, destinatario_apellido, destino_cbu, destino_alias
    ) values (
      v_destino.id, 'deposito', v_monto, round(v_destino.saldo + v_monto, 2),
      'Meta común|Pago ' || v_meta.titulo,
      v_persona.nombre, v_persona.apellido, v_destino.cbu, v_destino.alias
    );

    insert into public.metas_aportes (meta_id, persona_id, monto, tipo)
    values (v_meta.id, v_votacion.propuesta_por, -v_monto, 'pago');

    update public.metas_comunes
      set saldo = 0, estado = 'desembolsada'
      where id = v_meta.id;

  elsif v_votacion.tipo = 'devolver' then
    perform 1
    from public.cuentas c
    join public.metas_miembros m on m.cuenta_id = c.id
    where m.meta_id = v_meta.id and m.estado = 'activo'
    order by c.id
    for update of c;

    select coalesce(sum(aporte_total), 0) into v_suma
    from public.metas_miembros
    where meta_id = v_meta.id and estado = 'activo';

    select count(*)::integer into v_n
    from public.metas_miembros
    where meta_id = v_meta.id and estado = 'activo';

    v_restante := v_monto;
    for v_miembro in
      select * from public.metas_miembros
      where meta_id = v_meta.id and estado = 'activo'
      order by aporte_total desc, created_at
    loop
      v_i := v_i + 1;
      if v_i = v_n then
        v_parte := v_restante;
      elsif v_suma > 0 then
        v_parte := round(v_monto * (v_miembro.aporte_total / v_suma), 2);
      else
        v_parte := round(v_monto / v_n, 2);
      end if;
      if v_parte < 0 then
        v_parte := 0;
      end if;
      if v_parte > v_restante then
        v_parte := v_restante;
      end if;
      v_restante := round(v_restante - v_parte, 2);
      if v_parte <= 0 then
        continue;
      end if;

      update public.cuentas
        set saldo = round(saldo + v_parte, 2)
        where id = v_miembro.cuenta_id
        returning * into v_destino;

      insert into public.movimientos (
        cuenta_id, tipo, monto, saldo_resultante, descripcion
      ) values (
        v_miembro.cuenta_id, 'deposito', v_parte, v_destino.saldo,
        'Meta común|Devolución ' || v_meta.titulo
      );
    end loop;

    insert into public.metas_aportes (meta_id, persona_id, monto, tipo)
    values (v_meta.id, v_votacion.propuesta_por, -v_monto, 'devolucion');

    update public.metas_comunes
      set saldo = 0, estado = 'desembolsada'
      where id = v_meta.id;
  end if;

  update public.metas_votaciones
    set estado = 'ejecutada', executed_at = now()
    where id = v_votacion.id;
end;
$$;

create or replace function private.crear_meta_comun(
  p_titulo text,
  p_proposito text,
  p_objetivo numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_cuenta public.cuentas;
  v_titulo text := left(btrim(coalesce(p_titulo, '')), 80);
  v_proposito text := left(btrim(coalesce(p_proposito, '')), 120);
  v_objetivo numeric(14,2);
  v_meta public.metas_comunes;
  v_n integer;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if char_length(v_titulo) < 3 then
    raise exception 'El nombre de la meta tiene que tener al menos 3 letras';
  end if;
  perform private.enforce_rate('crear_meta_comun', 12, interval '5 minutes');

  select count(*)::integer into v_n
  from public.metas_miembros m
  join public.metas_comunes c on c.id = m.meta_id
  where m.persona_id = v_uid and m.estado = 'activo' and c.estado <> 'desembolsada';
  if v_n >= 12 then
    raise exception 'Ya estás en el máximo de metas abiertas';
  end if;

  v_cuenta := private.cuenta_propia(
    (select id from public.cuentas
     where persona_id = v_uid and moneda = 'ARS' and activa = true
     limit 1)
  );

  if p_objetivo is null or p_objetivo <= 0 then
    v_objetivo := null;
  else
    v_objetivo := round(p_objetivo, 2);
  end if;

  insert into public.metas_comunes (
    creador_id, titulo, proposito, objetivo_monto, codigo_invitacion
  ) values (
    v_uid, v_titulo, v_proposito, v_objetivo, private.meta_codigo_nuevo()
  )
  returning * into v_meta;

  insert into public.metas_miembros (meta_id, persona_id, cuenta_id, rol)
  values (v_meta.id, v_uid, v_cuenta.id, 'creador');

  return private.meta_detalle(v_meta.id);
end;
$$;

create or replace function private.unirse_meta_comun(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_codigo text := upper(btrim(coalesce(p_codigo, '')));
  v_meta public.metas_comunes;
  v_cuenta public.cuentas;
  v_n integer;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if v_codigo = '' then
    raise exception 'Ingresá el código de la meta';
  end if;
  perform private.enforce_rate('unirse_meta_comun', 30, interval '5 minutes');

  select * into v_meta
  from public.metas_comunes
  where codigo_invitacion = v_codigo;
  if not found then
    raise exception 'No hay ninguna meta con ese código';
  end if;
  if v_meta.estado = 'desembolsada' then
    raise exception 'Esa meta ya se desembolsó';
  end if;

  if exists (
    select 1 from public.metas_miembros
    where meta_id = v_meta.id and persona_id = v_uid
  ) then
    return private.meta_detalle(v_meta.id);
  end if;

  select count(*)::integer into v_n
  from public.metas_miembros
  where meta_id = v_meta.id and estado = 'activo';
  if v_n >= 20 then
    raise exception 'Esta meta ya tiene el máximo de personas';
  end if;

  v_cuenta := private.cuenta_propia(
    (select id from public.cuentas
     where persona_id = v_uid and moneda = 'ARS' and activa = true
     limit 1)
  );

  insert into public.metas_miembros (meta_id, persona_id, cuenta_id, rol)
  values (v_meta.id, v_uid, v_cuenta.id, 'miembro');

  return private.meta_detalle(v_meta.id);
end;
$$;

create or replace function private.invitar_meta_comun(p_meta_id uuid, p_alias text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alias text := lower(btrim(coalesce(p_alias, '')));
  v_destino public.cuentas;
  v_meta public.metas_comunes;
  v_n integer;
begin
  perform private.meta_requiere_miembro(p_meta_id);
  perform private.enforce_rate('invitar_meta_comun', 40, interval '5 minutes');
  v_alias := regexp_replace(v_alias, '^@', '');
  if v_alias = '' then
    raise exception 'Ingresá el alias de quien se suma';
  end if;

  select * into v_meta from public.metas_comunes where id = p_meta_id;
  if v_meta.estado = 'desembolsada' then
    raise exception 'Esa meta ya se desembolsó';
  end if;

  select * into v_destino
  from public.cuentas
  where lower(alias) = v_alias and activa = true and moneda = 'ARS';
  if not found then
    raise exception 'Ese alias no es de una cuenta Monix. Pasale el código de invitación';
  end if;
  if v_destino.persona_id = auth.uid() then
    raise exception 'Ese alias es el tuyo';
  end if;

  if exists (
    select 1 from public.metas_miembros
    where meta_id = p_meta_id and persona_id = v_destino.persona_id
  ) then
    raise exception 'Esa persona ya está en la meta';
  end if;

  select count(*)::integer into v_n
  from public.metas_miembros
  where meta_id = p_meta_id and estado = 'activo';
  if v_n >= 20 then
    raise exception 'Esta meta ya tiene el máximo de personas';
  end if;

  insert into public.metas_miembros (meta_id, persona_id, cuenta_id, rol)
  values (p_meta_id, v_destino.persona_id, v_destino.id, 'miembro');

  return private.meta_detalle(p_meta_id);
end;
$$;

create or replace function private.listar_metas_comunes()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  perform private.enforce_rate('listar_metas_comunes', 80, interval '5 minutes');

  for v_id in
    select m.meta_id
    from public.metas_miembros m
    where m.persona_id = v_uid and m.estado = 'activo'
  loop
    perform private.meta_devengar(v_id);
  end loop;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id,
      'titulo', c.titulo,
      'proposito', c.proposito,
      'objetivo', c.objetivo_monto,
      'saldo', c.saldo,
      'tasaAnual', c.tasa_anual,
      'rendimientoAcumulado', c.rendimiento_acumulado,
      'estado', c.estado,
      'codigo', c.codigo_invitacion,
      'miembros', (
        select count(*)::integer from public.metas_miembros x
        where x.meta_id = c.id and x.estado = 'activo'
      ),
      'miAporte', m.aporte_total
    ) order by c.created_at desc)
    from public.metas_miembros m
    join public.metas_comunes c on c.id = m.meta_id
    where m.persona_id = v_uid and m.estado = 'activo'
  ), '[]'::jsonb);
end;
$$;

create or replace function private.detalle_meta_comun(p_meta_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.meta_requiere_miembro(p_meta_id);
  perform private.meta_devengar(p_meta_id);
  return private.meta_detalle(p_meta_id);
end;
$$;

create or replace function private.aportar_meta_comun(
  p_meta_id uuid,
  p_cuenta_id uuid,
  p_monto numeric,
  p_operacion_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_miembro public.metas_miembros;
  v_cuenta public.cuentas;
  v_meta public.metas_comunes;
  v_monto numeric(14,2);
  v_ya boolean;
begin
  v_miembro := private.meta_requiere_miembro(p_meta_id);
  if p_operacion_id is null then
    raise exception 'Operación inválida';
  end if;
  if p_monto is null or p_monto < 1 or p_monto > 5000000 then
    raise exception 'El aporte tiene que ser entre $1 y $5.000.000';
  end if;
  v_monto := round(p_monto, 2);
  perform private.enforce_rate('aportar_meta_comun', 30, interval '5 minutes');

  select exists(
    select 1 from public.movimientos where operacion_id = p_operacion_id
  ) into v_ya;
  if v_ya then
    perform private.meta_devengar(p_meta_id);
    return private.meta_detalle(p_meta_id);
  end if;

  v_cuenta := private.cuenta_propia(p_cuenta_id);
  if v_cuenta.moneda is distinct from 'ARS' then
    raise exception 'Las metas comunes operan en pesos';
  end if;

  v_meta := private.meta_devengar(p_meta_id);
  if v_meta.estado = 'desembolsada' then
    raise exception 'Esa meta ya se desembolsó';
  end if;

  perform 1 from public.cuentas where id = v_cuenta.id for update;
  select * into v_cuenta from public.cuentas where id = v_cuenta.id;
  if v_cuenta.saldo < v_monto then
    raise exception 'No tenés saldo suficiente en tu caja de pesos';
  end if;

  update public.cuentas
    set saldo = round(saldo - v_monto, 2)
    where id = v_cuenta.id;

  insert into public.movimientos (
    operacion_id, cuenta_id, tipo, monto, saldo_resultante, descripcion
  ) values (
    p_operacion_id, v_cuenta.id, 'extraccion', v_monto,
    round(v_cuenta.saldo - v_monto, 2),
    'Meta común|Aporte a ' || v_meta.titulo
  );

  update public.metas_comunes
    set saldo = round(saldo + v_monto, 2)
    where id = v_meta.id;

  update public.metas_miembros
    set aporte_total = round(aporte_total + v_monto, 2),
        cuenta_id = v_cuenta.id
    where id = v_miembro.id;

  insert into public.metas_aportes (meta_id, persona_id, monto, tipo)
  values (v_meta.id, v_miembro.persona_id, v_monto, 'aporte');

  return private.meta_detalle(p_meta_id);
end;
$$;

create or replace function private.proponer_desembolso_meta(
  p_meta_id uuid,
  p_tipo text,
  p_destino text,
  p_concepto text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_meta public.metas_comunes;
  v_tipo text := lower(btrim(coalesce(p_tipo, '')));
  v_destino text := btrim(coalesce(p_destino, ''));
  v_concepto text := nullif(left(btrim(coalesce(p_concepto, '')), 80), '');
  v_cuenta public.cuentas;
  v_persona public.personas;
  v_cbu text;
  v_alias text;
  v_nombre text;
  v_votacion public.metas_votaciones;
  v_n integer;
  v_a_favor integer;
  v_necesarios integer;
begin
  perform private.meta_requiere_miembro(p_meta_id);
  perform private.enforce_rate('proponer_desembolso_meta', 16, interval '5 minutes');
  v_meta := private.meta_devengar(p_meta_id);
  if v_meta.estado = 'desembolsada' then
    raise exception 'Esa meta ya se desembolsó';
  end if;
  if v_meta.estado = 'votacion' then
    raise exception 'Ya hay una votación abierta';
  end if;
  if v_meta.saldo <= 0 then
    raise exception 'Todavía no hay plata para desembolsar';
  end if;
  if v_tipo not in ('pagar', 'devolver') then
    raise exception 'Elegí si pagan un servicio o devuelven lo juntado';
  end if;

  if v_tipo = 'pagar' then
    v_destino := regexp_replace(lower(v_destino), '^@', '');
    if v_destino = '' then
      raise exception 'Ingresá el alias o CBU de quien cobra';
    end if;
    if v_destino ~ '^\d{22}$' then
      v_cbu := v_destino;
      select * into v_cuenta from public.cuentas
      where cbu = v_cbu and activa = true and moneda = 'ARS';
    else
      v_alias := v_destino;
      select * into v_cuenta from public.cuentas
      where lower(alias) = v_alias and activa = true and moneda = 'ARS';
    end if;
    if not found then
      raise exception 'El pago de la meta sale a una cuenta Monix. Si es otro banco, devolvé entre ustedes y transferí';
    end if;
    select * into v_persona from public.personas where id = v_cuenta.persona_id;
    v_cbu := v_cuenta.cbu;
    v_alias := v_cuenta.alias;
    v_nombre := v_persona.nombre || ' ' || v_persona.apellido;
  end if;

  insert into public.metas_votaciones (
    meta_id, propuesta_por, tipo, destino_cbu, destino_alias, destino_nombre, concepto
  ) values (
    p_meta_id, v_uid, v_tipo, v_cbu, v_alias, v_nombre, v_concepto
  )
  returning * into v_votacion;

  insert into public.metas_votos (votacion_id, persona_id, a_favor)
  values (v_votacion.id, v_uid, true);

  update public.metas_comunes set estado = 'votacion' where id = p_meta_id;

  select count(*)::integer into v_n
  from public.metas_miembros
  where meta_id = p_meta_id and estado = 'activo';
  v_necesarios := (v_n / 2) + 1;
  select count(*)::integer into v_a_favor
  from public.metas_votos
  where votacion_id = v_votacion.id and a_favor = true;
  if v_a_favor >= v_necesarios then
    perform private.meta_ejecutar_votacion(v_votacion.id);
  end if;

  return private.meta_detalle(p_meta_id);
end;
$$;

create or replace function private.votar_meta_comun(p_votacion_id uuid, p_a_favor boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_votacion public.metas_votaciones;
  v_n integer;
  v_a_favor integer;
  v_en_contra integer;
  v_necesarios integer;
begin
  if p_a_favor is null then
    raise exception 'Elegí a favor o en contra';
  end if;
  select * into v_votacion
  from public.metas_votaciones
  where id = p_votacion_id;
  if not found then
    raise exception 'No encontramos esa votación';
  end if;
  perform private.meta_requiere_miembro(v_votacion.meta_id);
  perform private.enforce_rate('votar_meta_comun', 40, interval '5 minutes');
  perform private.meta_devengar(v_votacion.meta_id);

  if v_votacion.estado is distinct from 'abierta' then
    raise exception 'Esa votación ya cerró';
  end if;

  insert into public.metas_votos (votacion_id, persona_id, a_favor)
  values (p_votacion_id, v_uid, p_a_favor)
  on conflict (votacion_id, persona_id) do update
    set a_favor = excluded.a_favor;

  select count(*)::integer into v_n
  from public.metas_miembros
  where meta_id = v_votacion.meta_id and estado = 'activo';
  v_necesarios := (v_n / 2) + 1;

  select
    coalesce(sum(case when a_favor then 1 else 0 end), 0)::integer,
    coalesce(sum(case when not a_favor then 1 else 0 end), 0)::integer
  into v_a_favor, v_en_contra
  from public.metas_votos
  where votacion_id = p_votacion_id;

  if v_a_favor >= v_necesarios then
    perform private.meta_ejecutar_votacion(p_votacion_id);
  elsif v_en_contra >= v_necesarios then
    update public.metas_votaciones set estado = 'rechazada' where id = p_votacion_id;
    update public.metas_comunes set estado = 'abierta' where id = v_votacion.meta_id;
  end if;

  return private.meta_detalle(v_votacion.meta_id);
end;
$$;

create or replace function public.crear_meta_comun(p_titulo text, p_proposito text, p_objetivo numeric)
returns jsonb language sql security definer set search_path = ''
as $$ select private.crear_meta_comun(p_titulo, p_proposito, p_objetivo); $$;

create or replace function public.unirse_meta_comun(p_codigo text)
returns jsonb language sql security definer set search_path = ''
as $$ select private.unirse_meta_comun(p_codigo); $$;

create or replace function public.invitar_meta_comun(p_meta_id uuid, p_alias text)
returns jsonb language sql security definer set search_path = ''
as $$ select private.invitar_meta_comun(p_meta_id, p_alias); $$;

create or replace function public.listar_metas_comunes()
returns jsonb language sql security definer set search_path = ''
as $$ select private.listar_metas_comunes(); $$;

create or replace function public.detalle_meta_comun(p_meta_id uuid)
returns jsonb language sql security definer set search_path = ''
as $$ select private.detalle_meta_comun(p_meta_id); $$;

create or replace function public.aportar_meta_comun(
  p_meta_id uuid, p_cuenta_id uuid, p_monto numeric, p_operacion_id uuid
)
returns jsonb language sql security definer set search_path = ''
as $$ select private.aportar_meta_comun(p_meta_id, p_cuenta_id, p_monto, p_operacion_id); $$;

create or replace function public.proponer_desembolso_meta(
  p_meta_id uuid, p_tipo text, p_destino text, p_concepto text
)
returns jsonb language sql security definer set search_path = ''
as $$ select private.proponer_desembolso_meta(p_meta_id, p_tipo, p_destino, p_concepto); $$;

create or replace function public.votar_meta_comun(p_votacion_id uuid, p_a_favor boolean)
returns jsonb language sql security definer set search_path = ''
as $$ select private.votar_meta_comun(p_votacion_id, p_a_favor); $$;

do $$
declare
  r record;
begin
  for r in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in (
        'meta_codigo_nuevo','meta_devengar','meta_requiere_miembro','meta_detalle',
        'meta_ejecutar_votacion','crear_meta_comun','unirse_meta_comun','invitar_meta_comun',
        'listar_metas_comunes','detalle_meta_comun','aportar_meta_comun',
        'proponer_desembolso_meta','votar_meta_comun'
      )
  loop
    execute format('revoke all on function %I.%I(%s) from public, anon, authenticated', r.nspname, r.proname, r.args);
  end loop;

  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'crear_meta_comun','unirse_meta_comun','invitar_meta_comun','listar_metas_comunes',
        'detalle_meta_comun','aportar_meta_comun','proponer_desembolso_meta','votar_meta_comun','usuario_en_meta'
      )
  loop
    execute format('revoke all on function public.%I(%s) from public, anon', r.proname, r.args);
    execute format('grant execute on function public.%I(%s) to authenticated, service_role', r.proname, r.args);
  end loop;
end $$;

notify pgrst, 'reload schema';
