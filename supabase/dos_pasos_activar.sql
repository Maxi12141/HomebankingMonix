-- Enciende el control de dos pasos en el servidor. Requiere dos_pasos.sql.
-- Corre en CADA pedido a la API, de todas las cuentas: aplicar con la app sin uso y
-- probar enseguida una cuenta sin 2FA y otra con 2FA.
--
-- Para apagarlo en segundos si algo sale mal:
--   alter role authenticator reset pgrst.db_pre_request;
--   notify pgrst, 'reload config';

-- Las tablas con avisos en tiempo real no pasan por PostgREST: las cubre RLS.
drop policy if exists "dos pasos para leer" on public.cuentas;
create policy "dos pasos para leer" on public.cuentas
  as restrictive for select to authenticated
  using ((select public.sesion_verificada()));

drop policy if exists "dos pasos para leer" on public.cobros_qr;
create policy "dos pasos para leer" on public.cobros_qr
  as restrictive for select to authenticated
  using ((select public.sesion_verificada()));

drop policy if exists "dos pasos para leer" on public.qr_lecturas;
create policy "dos pasos para leer" on public.qr_lecturas
  as restrictive for select to authenticated
  using ((select public.sesion_verificada()));

alter role authenticator set pgrst.db_pre_request = 'public.exigir_2fa';
notify pgrst, 'reload config';
