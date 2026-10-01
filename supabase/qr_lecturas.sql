-- Aviso de lectura de QR interbancario (docs/qr-interbancario-jwt.md, sección 12).
-- Una fila por cada vez que un banco (Monix u otro de la cátedra) nos avisa que
-- leyó un QR emitido por Monix. La escribe sólo la Edge Function `qr-lectura`
-- (service role); el dueño del QR la recibe por Realtime.

create table if not exists public.qr_lecturas (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.personas(id) on delete cascade,
  cuenta_id uuid not null references public.cuentas(id) on delete cascade,
  jti text,
  cid uuid,
  banco_lector integer not null,
  nombre_lector text,
  created_at timestamptz not null default now()
);

create index if not exists qr_lecturas_persona_idx on public.qr_lecturas (persona_id, created_at desc);

alter table public.qr_lecturas enable row level security;

drop policy if exists "qr_lecturas: ver las propias" on public.qr_lecturas;
create policy "qr_lecturas: ver las propias"
  on public.qr_lecturas for select
  to authenticated
  using (persona_id = (select auth.uid()));

-- Sin policies de insert/update/delete: sólo service role escribe.
revoke insert, update, delete on public.qr_lecturas from anon, authenticated;

alter publication supabase_realtime add table public.qr_lecturas;
