-- Cierra las sesiones de más de 30 días una vez por día. Requiere dispositivos_confianza.sql.
-- Separado porque usa pg_cron, que no existe en la base de pruebas (PGlite).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'vencer-sesiones') then
    perform cron.unschedule('vencer-sesiones');
  end if;
end;
$$;

select cron.schedule('vencer-sesiones', '17 6 * * *', 'select private.vencer_sesiones()');
