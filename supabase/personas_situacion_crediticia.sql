-- Situación crediticia que Monix informa de cada cliente al Banco Central
-- (POST /central-deudores) al registrarse — ficticia/simulada, no refleja
-- comportamiento real de pago (ver supabase/prestamos.sql: la mora de
-- préstamos locales sigue sin reportarse a la Central real, es un entorno
-- compartido entre bancos del curso).
--
-- Se cachea acá para tener registro de qué le informamos al Banco Central y
-- cuándo, pero la fuente de verdad para aprobar préstamos sigue siendo la
-- consulta en vivo (GET /central-deudores/{dni} en bancoCentral.ts), porque
-- agrega lo informado por TODOS los bancos, no sólo Monix — una misma persona
-- puede tener cuentas en varios bancos del curso.
alter table public.personas
  add column if not exists situacion_crediticia_monix smallint
    check (situacion_crediticia_monix between 1 and 5),
  add column if not exists situacion_informada_at timestamptz;
