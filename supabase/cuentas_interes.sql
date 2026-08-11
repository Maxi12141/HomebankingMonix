-- Interés diario sobre saldo disponible (misma TNA que reservas)
alter table public.cuentas
  add column if not exists tasa_anual numeric(6,2) not null default 32.00 check (tasa_anual >= 0),
  add column if not exists ultima_interes_at timestamptz not null default now();

update public.cuentas
set tasa_anual = 32.00
where tasa_anual is distinct from 32.00;
