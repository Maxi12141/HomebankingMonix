-- Datos declarados/ficticios usados por Préstamos para calcular tasa, monto
-- máximo y relación cuota/ingreso. Ambos son editables por el usuario en Perfil.
alter table public.personas
  add column if not exists sueldo_acreditado boolean not null default false,
  add column if not exists ingreso_mensual numeric(14,2) check (ingreso_mensual is null or ingreso_mensual >= 0);
