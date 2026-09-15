-- Préstamos personales en pesos, otorgados según la situación crediticia real
-- del usuario en la Central de Deudores del Banco Central (GET /central-deudores/{dni}).
-- El desembolso acredita `monto` en la cuenta y las cuotas (sistema francés) se
-- van cobrando automáticamente con el tiempo — mismo patrón que el interés
-- diario de `reservas`/`cuentas`: se calculan al vuelo en el cliente cada vez
-- que el usuario entra a la pantalla (ver `usePrestamos.ts`), no hay cron real.
create table if not exists public.prestamos (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  monto numeric(14,2) not null check (monto > 0),
  cuotas_totales integer not null check (cuotas_totales > 0),
  cuotas_pagadas integer not null default 0 check (cuotas_pagadas >= 0),
  cuota_monto numeric(14,2) not null check (cuota_monto > 0),
  tna numeric(6,2) not null check (tna >= 0),
  -- Foto histórica al momento de aprobarse (no se recalculan después).
  situacion_bcra integer not null check (situacion_bcra between 1 and 5),
  sueldo_acreditado boolean not null default false,
  estado text not null default 'activo' check (estado in ('activo','pagado')),
  proxima_cuota_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.prestamos enable row level security;

create policy "usuarios pueden ver sus prestamos"
  on public.prestamos for select
  using (cuenta_id in (select id from public.cuentas where persona_id = auth.uid()));

create policy "usuarios pueden crear sus prestamos"
  on public.prestamos for insert
  with check (cuenta_id in (select id from public.cuentas where persona_id = auth.uid()));

create policy "usuarios pueden actualizar sus prestamos"
  on public.prestamos for update
  using (cuenta_id in (select id from public.cuentas where persona_id = auth.uid()))
  with check (cuenta_id in (select id from public.cuentas where persona_id = auth.uid()));
