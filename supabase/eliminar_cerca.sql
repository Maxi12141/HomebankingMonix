-- Baja de Monix Cerca (reemplazado por Monix Ahora, ver cobros_ahora.sql).
-- Borra todo lo que crearon cerca_nfc.sql (la parte de presencia),
-- cerca_lugar.sql, cerca_lugar_red.sql y cerca_listar_visibles.sql.
-- No toca nada compartido: hash_token, assert_token, enforce_rate,
-- cuenta_propia, rpc_rate, cobros_nfc y la tarjeta NFC siguen en uso.

-- Wrappers públicos primero, después las funciones privadas que llaman.
drop function if exists public.activar_presencia(uuid, text);
drop function if exists public.activar_presencia(uuid, text, double precision, double precision);
drop function if exists public.desactivar_presencia();
drop function if exists public.resolver_presencia(text);
drop function if exists public.abrir_destino_cerca(text);
drop function if exists public.abrir_destino_cerca_cuenta(uuid);
drop function if exists public.listar_presencias_visibles();
drop function if exists public.listar_presencias_visibles(double precision, double precision, integer);
drop function if exists public.activar_presencia_lugar(uuid, double precision, double precision, double precision);
drop function if exists public.listar_en_este_lugar();
drop function if exists public.transferir_en_este_lugar(uuid, numeric, text, uuid);

drop function if exists private.activar_presencia(uuid, text);
drop function if exists private.activar_presencia(uuid, text, double precision, double precision);
drop function if exists private.desactivar_presencia();
drop function if exists private.resolver_presencia(text);
drop function if exists private.abrir_destino_cerca(text);
drop function if exists private.abrir_destino_cerca_cuenta(uuid);
drop function if exists private.listar_presencias_visibles();
drop function if exists private.listar_presencias_visibles(double precision, double precision, integer);
drop function if exists private.activar_presencia_lugar(uuid, double precision, double precision, double precision);
drop function if exists private.listar_en_este_lugar();
drop function if exists private.transferir_en_este_lugar(uuid, numeric, text, uuid);
drop function if exists private.metros_entre(double precision, double precision, double precision, double precision);
drop function if exists private.ip_hash_cliente();

drop table if exists public.presencia_cerca;
drop table if exists private.cerca_auditoria;
