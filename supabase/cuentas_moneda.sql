-- Soporte de cuentas multi-moneda (ARS / USD). Aditiva: no rompe filas existentes.
alter table public.cuentas
  add column if not exists moneda varchar(3) not null default 'ARS'
    check (moneda in ('ARS', 'USD'));
