-- Baja del pago contactless con la tarjeta (sticker NFC, HCE y QR de la
-- tarjeta): nunca se pudo usar. El sticker no se grababa en la APK y ninguna
-- pantalla cobraba con el secreto de la tarjeta (pagar_cobro_nfc no tenía
-- llamador). Los cobros por QR (cobros_nfc, pagar_cobro_qr, pagar_qr_cuenta)
-- no dependen de nada de esto y siguen igual.

drop function if exists public.registrar_tarjeta_nfc(uuid, text);
drop function if exists public.generar_criptograma_nfc(uuid, text);
drop function if exists public.pagar_cobro_nfc(uuid, text);

drop function if exists private.registrar_tarjeta_nfc(uuid, text);
drop function if exists private.generar_criptograma_nfc(uuid, text);
drop function if exists private.pagar_cobro_nfc(uuid, text);

drop table if exists private.nfc_tarjetas;
drop table if exists private.nfc_criptogramas;

alter table public.cuentas drop column if exists nfc_contacto_activo;
