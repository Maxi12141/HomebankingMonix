-- POLICIES PARA personas
alter table personas enable row level security;

create policy "usuarios pueden insertar su propio perfil"
  on personas for insert
  with check (auth.uid() = id);

create policy "usuarios pueden ver su propio perfil"
  on personas for select
  using (auth.uid() = id);

create policy "usuarios pueden actualizar su propio perfil"
  on personas for update
  using (auth.uid() = id);

-- POLICIES PARA cuentas
alter table cuentas enable row level security;

create policy "usuarios pueden insertar su propia cuenta"
  on cuentas for insert
  with check (auth.uid() = persona_id);

create policy "usuarios pueden ver sus propias cuentas"
  on cuentas for select
  using (auth.uid() = persona_id);

create policy "usuarios pueden actualizar sus propias cuentas"
  on cuentas for update
  using (auth.uid() = persona_id);

-- POLICIES PARA movimientos
alter table movimientos enable row level security;

create policy "usuarios pueden insertar movimientos de sus cuentas"
  on movimientos for insert
  with check (
    cuenta_id in (
      select id from cuentas where persona_id = auth.uid()
    )
  );

create policy "usuarios pueden ver movimientos de sus cuentas"
  on movimientos for select
  using (
    cuenta_id in (
      select id from cuentas where persona_id = auth.uid()
    )
  );

-- POLICIES PARA reservas
alter table reservas enable row level security;

create policy "usuarios pueden ver su reserva"
  on reservas for select
  using (
    cuenta_id in (
      select id from cuentas where persona_id = auth.uid()
    )
  );

create policy "usuarios pueden crear su reserva"
  on reservas for insert
  with check (
    cuenta_id in (
      select id from cuentas where persona_id = auth.uid()
    )
  );

create policy "usuarios pueden actualizar su reserva"
  on reservas for update
  using (
    cuenta_id in (
      select id from cuentas where persona_id = auth.uid()
    )
  )
  with check (
    cuenta_id in (
      select id from cuentas where persona_id = auth.uid()
    )
  );
