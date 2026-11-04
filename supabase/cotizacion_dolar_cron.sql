-- Mantiene private.cotizacion_dolar con el dólar oficial, cada 10 minutos.
-- Va después de cotizacion_dolar.sql. Queda fuera de npm run test:sql porque
-- PGlite no tiene las extensiones http ni pg_cron.

create extension if not exists http with schema extensions;
create extension if not exists pg_cron;

create or replace function private.actualizar_cotizacion_dolar()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_respuesta extensions.http_response;
  v_datos jsonb;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '8');
  v_respuesta := extensions.http_get('https://dolarapi.com/v1/dolares/oficial');

  -- Si la fuente falla se conserva el último precio: validar_cambio lo acepta hasta 7 días.
  if v_respuesta.status <> 200 then
    raise warning 'dolarapi respondió %', v_respuesta.status;
    return;
  end if;

  v_datos := v_respuesta.content::jsonb;
  insert into private.cotizacion_dolar (casa, compra, venta, actualizada_en)
  values ('oficial', (v_datos->>'compra')::numeric, (v_datos->>'venta')::numeric, now())
  on conflict (casa) do update
    set compra = excluded.compra, venta = excluded.venta, actualizada_en = excluded.actualizada_en;
end;
$$;

revoke all on function private.actualizar_cotizacion_dolar() from public, anon, authenticated;

select private.actualizar_cotizacion_dolar();

select cron.schedule(
  'actualizar-cotizacion-dolar',
  '*/10 * * * *',
  'select private.actualizar_cotizacion_dolar()'
);
