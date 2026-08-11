-- Reserva / ahorro con interés diario (estilo Mercado Pago)
create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  saldo numeric(14,2) not null default 0 check (saldo >= 0),
  tasa_anual numeric(6,2) not null default 32.00 check (tasa_anual >= 0),
  ultima_interes_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint reservas_cuenta_id_key unique (cuenta_id)
);

alter table public.reservas enable row level security;

create policy "usuarios pueden ver su reserva"
  on public.reservas for select
  using (
    cuenta_id in (
      select id from public.cuentas where persona_id = auth.uid()
    )
  );

create policy "usuarios pueden crear su reserva"
  on public.reservas for insert
  with check (
    cuenta_id in (
      select id from public.cuentas where persona_id = auth.uid()
    )
  );

create policy "usuarios pueden actualizar su reserva"
  on public.reservas for update
  using (
    cuenta_id in (
      select id from public.cuentas where persona_id = auth.uid()
    )
  )
  with check (
    cuenta_id in (
      select id from public.cuentas where persona_id = auth.uid()
    )
  );
