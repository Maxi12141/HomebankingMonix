-- S-1 · Paso 3 de 3: el navegador deja de poder escribir saldos.
--
-- Aplicar SÓLO después de:
--   1. s1_rpc_saldos.sql aplicado, y
--   2. el front que usa esas RPC (y la Edge Function sincronizar-entrantes)
--      desplegado y probado en producción.
-- Antes de eso, la app vieja todavía escribe estas tablas directo y se rompe.
--
-- Las RPC SECURITY DEFINER no se ven afectadas: corren con los permisos de su
-- dueño, no con los del usuario.
--
-- Rollback: volver a correr policies.sql y
--   grant insert, update on public.cuentas, public.personas, public.movimientos,
--     public.reservas, public.prestamos to authenticated;

-- ─── cuentas: sólo alias y congelar la tarjeta ──────────────────────────────
revoke insert, update, delete on public.cuentas from anon, authenticated;
grant update (alias, tarjeta_congelada) on public.cuentas to authenticated;
drop policy if exists "usuarios pueden insertar su propia cuenta" on public.cuentas;
-- "usuarios pueden actualizar sus propias cuentas" sigue: limita las filas,
-- y el grant de arriba limita las columnas.

-- ─── personas: sólo datos de contacto y los datos financieros declarados ────
-- situacion_crediticia_monix deja de ser editable: Préstamos la usa como piso.
revoke insert, update, delete on public.personas from anon, authenticated;
grant update (email, telefono, direccion, ingreso_mensual, sueldo_acreditado) on public.personas to authenticated;
drop policy if exists "usuarios pueden insertar su propio perfil" on public.personas;

-- ─── movimientos, reservas y préstamos: sólo lectura ────────────────────────
revoke insert, update, delete on public.movimientos from anon, authenticated;
revoke insert, update, delete on public.reservas from anon, authenticated;
revoke insert, update, delete on public.prestamos from anon, authenticated;
drop policy if exists "usuarios pueden insertar movimientos de sus cuentas" on public.movimientos;
drop policy if exists "usuarios pueden crear su reserva" on public.reservas;
drop policy if exists "usuarios pueden actualizar su reserva" on public.reservas;
drop policy if exists "usuarios pueden crear sus prestamos" on public.prestamos;
drop policy if exists "usuarios pueden actualizar sus prestamos" on public.prestamos;

-- Verificación (debería devolver sólo políticas de SELECT, más el UPDATE de
-- cuentas y personas):
--   select tablename, policyname, cmd from pg_policies
--   where tablename in ('cuentas','personas','movimientos','reservas','prestamos')
--   order by tablename, cmd;
