# Auditoría completa — HomebankingMonix

**Fecha:** 2026-09-21
**Alcance:** toda la app (auth/biometría, cuentas/transferencias/Banco Central, préstamos/reservas/tarjeta/mercado, QR/NFC/Cerca/nativo, shell/dashboard/UI/config). ~90 archivos, ~15.600 líneas de TS/TSX + el plugin nativo Android en Kotlin.
**Método:** 5 revisiones independientes, cada una leyendo completos (no en fragmentos) los archivos de su área. Total: 35 bugs, más hallazgos de texto/coherencia, features simples y mejoras de código.

---

## Resumen ejecutivo — lo más urgente

Estos 6 son los que más impacto real tienen (plata simulada que se pierde o se duplica, o una feature nativa que deja de andar sin avisar). Todo lo demás está detallado más abajo por área.

1. **Transferencias Monix→Monix no se acreditan bien.** El código intenta escribir directo la cuenta del destinatario, pero la política RLS lo bloquea en silencio (0 filas, sin error). Hoy "funciona" de rebote porque el sync de transferencias entrantes lo termina tratando como si viniera de otro banco — con hasta 2 minutos de demora. → [Cuentas/Transferencias #1](#1-crítico--crédito-local-al-destinatario-bloqueado-por-rls-en-silencio)
2. **Reintentar una transferencia fallida puede duplicar el envío.** Si el Banco Central ya aceptó la transferencia pero el guardado local falla después, no hay ningún control de idempotencia — un segundo click reenvía la plata de verdad. → [Cuentas/Transferencias #2](#2-crítico--fallo-a-mitad-de-camino-sin-idempotencia)
3. **Un registro que falla a mitad de camino deja al usuario logueado con una cuenta rota**, sin ver el mensaje de error (redirect automático a `/dashboard` antes de que se vea el error). → [Auth #1](#1-crítico--registro-a-medio-terminar-sin-que-el-usuario-vea-el-error)
4. **"Visible aunque cierre la app" (Cerca) deja de funcionar solo, sin avisar, a los ~4 minutos.** El advertising BLE nativo se rompe silenciosamente cada vez que rota el token. → [Nativo #1](#1-muy-alto--el-advertising-de-ble-se-rompe-silenciosamente-cada-4-minutos)
5. **Buscar gente cerca sin estar "Visible" nunca encuentra a nadie en la app instalada (APK).** `startScan`/`stopScan` del lado nativo son no-ops — el escaneo real sólo pasa como efecto colateral de que la OTRA persona esté advirtiendo. → [Nativo #2](#2-muy-alto--startscanstopscan-son-no-ops)
6. **El simulador de préstamos puede ofrecer las mejores condiciones a alguien con la peor situación crediticia** mientras la consulta al Banco Central está cargando, o si falla por cualquier motivo (no sólo 404). → [Préstamos #1](#1-alto--el-chequeo-de-situación-crediticia-falla-abierto-hacia-el-mejor-nivel)

---

## 1. Auth, sesión y biometría

### Bugs

**1. CRÍTICO — registro a medio terminar sin que el usuario vea el error**
`RegisterPage.tsx:42-144`. `auth.signUp()` (línea 52) deja la sesión activa casi de inmediato. Si cualquier paso posterior falla (`registrarPersona`, insert en `personas`, insert en `cuentas`), cae al `catch` que sólo hace `setError(...)` — pero el `finally` baja `provisioning` a `false` sin importar el resultado. En cuanto eso pasa con `user` ya truthy, `PublicOnly` en `App.tsx:46` redirige a `/dashboard` de inmediato y el mensaje de error nunca se llega a ver. Caso concreto: DNI duplicado en el Banco Central (409) — el usuario termina "logueado" con auth real de Supabase pero sin fila en `personas` ni `cuentas` (sin plata, sin CBU).
*Fix:* en el `catch`, si `authData?.user` se llegó a crear, hacer `signOut()` antes de mostrar el error, o no bajar `provisioning` en el camino de error.

**2. ALTO — la contraseña guardada para huella queda obsoleta al cambiar la contraseña, y el error sale en inglés**
`ProfilePage.tsx` (`handleChangePassword`) actualiza la contraseña en Supabase pero nunca toca `guardarCredencialBio`/`borrarCredencialBio` (`biometria.ts:119-133`). Si el usuario cambia su contraseña y después entra con huella, el WebAuthn funciona pero `login()` falla con la contraseña vieja — y `pedirBiometria` (`LoginPage.tsx:107`) muestra el `err.message` crudo de Supabase, en inglés ("Invalid login credentials"), en una app en español.
*Fix:* en `handleChangePassword`, si hay biometría activa, actualizar `guardarCredencialBio` con la nueva contraseña; y no propagar `err.message` crudo en `pedirBiometria`.

**3. ALTO — el botón "Instalar Monix" casi nadie lo ve**
`LoginPage.tsx:259-268`. Está anidado dentro de `step === 'bio'`, que sólo se activa si el dispositivo YA tiene biometría configurada. Eso excluye a todo usuario nuevo, a todo el que no activó huella, y a cualquiera en desktop — justo la gente que más necesita el recordatorio de instalar la PWA.
*Fix:* sacar el bloque de instalación del `step === 'bio'` y mostrarlo también en `email`/`password`.

**4. MEDIO — el comentario que justifica guardar la contraseña en texto plano compara con algo falso**
`biometria.ts:103-107` dice "mismo nivel de seguridad que Recordarme (texto plano)", pero `rememberMe.ts` nunca guardó la contraseña, sólo el email. El nuevo esquema es estrictamente peor, no "igual". Vale corregir el comentario y evaluar cifrar esa contraseña con algo derivado del propio resultado de WebAuthn.

**5. MEDIO — `verificarHuella` no tiene timeout, a diferencia de `asegurarCredencial`**
`biometria.ts:242-265`. La creación de credencial (una sola vez) sí tiene `Promise.race` con timeout de 12s (líneas 210-222) por un bug real ya visto en producción. El login/desbloqueo con huella (que corre en CADA intento, mucho más frecuente) no tiene ese timeout — si el prompt nativo se cuelga, el spinner de "Ingresar" queda girando para siempre.
*Fix:* aplicar el mismo patrón de timeout a `verificarHuella`.

**6. MEDIO — el email se actualiza en `personas` y en pantalla antes de confirmarse en Supabase Auth**
`ProfilePage.tsx` (`handleSaveProfile:89-120`). `auth.updateUser({email})` sólo manda un mail de confirmación — el email de la sesión no cambia hasta confirmarlo. Pero el código ya actualiza `personas.email` y el store con el email nuevo de inmediato, desincronizando `user.email` (real) de `persona.email` (mostrado y usado como clave para biometría). Si se activa biometría en esa ventana, queda guardada bajo un email que el login todavía no reconoce.
*Fix:* no actualizar `personas.email` hasta confirmar el cambio (o usar un campo `email_pendiente`).

**7. BAJO — "‹ Cambiar cuenta" no limpia el campo de email**
`LoginPage.tsx:138-144`. Resetea todo menos `email` — el usuario vuelve al paso de email pero con el email de la cuenta anterior todavía cargado.

**8. BAJO — el formulario de registro no hace `trim()` de ningún campo**
A diferencia de `LoginPage` (que sí hace `.trim()`), `RegisterPage.tsx` manda `email`/`dni`/`nombre`/etc. tal cual — un espacio final por autocompletado de teclado puede generar inconsistencias contra un login posterior que sí normaliza.

### Texto / coherencia

- Tres verbos distintos para "loguearse" sin criterio: "Iniciar sesión" (paso password), "Ingresar" (paso bio), "Entrar" (HuellaLockScreen). Unificar en uno solo.
- Mensaje de fallback de biometría distinto entre `LoginPage` ("Usá la contraseña.") y `HuellaLockScreen` ("Usá la contraseña **de Monix**.") para el mismo escenario — el segundo es más preciso, debería usarse en los dos lados.
- `biometria.ts:218` le habla al usuario de "instalá la APK nueva" — jerga técnica en un mensaje de cara al usuario final.

### Features simples

- Falta el toggle "mostrar contraseña" (ya agregado en RegisterPage) en: `LoginPage` (paso password y sub-form de bio), `HuellaLockScreen`, y los dos campos de "Cambiar contraseña" en `ProfilePage`. Conviene extraerlo a un componente `PasswordInput` reutilizable.
- ~~No existe ningún flujo de "olvidé mi contraseña"~~ — **✅ implementado (21 sep)**: `ForgotPasswordPage.tsx` (pide el mail, `resetPasswordForEmail`), `ResetPasswordPage.tsx` (procesa el link y pide la contraseña nueva dos veces), link "¿Olvidaste tu contraseña?" en `LoginPage.tsx`, rutas `/recuperar-contrasena` y `/restablecer-contrasena` en `App.tsx`. Falta pegar la plantilla de mail con marca Monix en el Dashboard de Supabase (`docs/email-recuperar-contrasena.html`, con instrucciones) y agregar la Redirect URL al allowlist — ninguna de las dos se puede hacer por API/MCP.
- "Cambiar contraseña" en `ProfilePage` no pide confirmación de la contraseña nueva (un solo campo) — un typo deja al usuario sin saber cuál quedó.

### Mejoras de código

- `useAuth()` se invoca por separado en varios puntos de `App.tsx` (`AppShell`, `AppRoutes`, cada `RequireAuth`/`PublicOnly`), cada uno con su propio `getSession()`, `onAuthStateChange` y timeout de 8s — trabajo de red redundante en cada navegación interna. Conviene un `AuthProvider` único que corra el efecto una sola vez.
- `esCelular()` se lee una sola vez con `useState(() => esCelular())` en `ProfilePage` sin escuchar resize — caso de borde menor.
- `HuellaLockScreen.cerrarSesion` no tiene loading state ni deshabilita el botón mientras espera `signOut()`.

---

## 2. Cuentas, transferencias y Banco Central

*(la parte que más importa: acá es donde se mueve la plata)*

### Bugs

**1. CRÍTICO — crédito local al destinatario bloqueado por RLS, en silencio**
`TransferPage.tsx:284-300` intenta, para transferencias Monix→Monix, hacer `UPDATE` directo sobre la cuenta del destinatario y luego `INSERT` en `movimientos`. La política RLS de `cuentas` (`policies.sql:27-29`) sólo permite `UPDATE` donde `persona_id = auth.uid()` — el que transfiere nunca es dueño de la cuenta ajena. Supabase no tira error en un `UPDATE` filtrado a 0 filas por RLS, y el `INSERT` en `movimientos` (que sí viola su propio `with check`) tampoco se chequea (`.insert(...)` sin desestructurar `error`). Resultado: el saldo del destinatario nunca se acredita ahí, pero la app muestra "¡Transferencia realizada con éxito!" igual.

Por la misma RLS, la búsqueda local de `TransferPage.tsx:179-184` tampoco puede encontrar la cuenta de otro usuario — esa rama de código, en la práctica, nunca corre para una transferencia real entre dos personas. Lo que "salva" la plata hoy es un efecto secundario no intencional: `useSyncTransferenciasEntrantes.ts` tampoco puede ver la cuenta del emisor por la misma RLS, así que trata la transferencia interna como si fuera externa y sí la acredita — pero recién en el próximo polling (hasta 2 minutos después), no al instante.

El propio repo ya tiene el patrón correcto para copiar: `cerca_nfc.sql` (`pagar_qr_cuenta`), una función `SECURITY DEFINER` con `FOR UPDATE` sobre ambas cuentas que hace el débito/crédito atómico en el servidor.
*Fix:* crear una función RPC `SECURITY DEFINER` para transferencias Monix↔Monix, igual patrón que `pagar_qr_cuenta`, en vez de que el cliente escriba la cuenta ajena directamente.

**2. CRÍTICO — falla a mitad de camino sin idempotencia**
`TransferPage.tsx:271-326`. Orden real: primero se llama a `transferir()` (Banco Central — la plata ya "salió"), después se actualiza el saldo local. Si el Banco Central acepta pero el `UPDATE` local falla (red, timeout), cae a un catch genérico que muestra "Ocurrió un error" y vuelve al resumen con el saldo viejo — con el botón "Confirmar" disponible de nuevo. Un segundo click dispara **otra** llamada real a `transferir()`, duplicando el envío. No hay ningún id de operación ni chequeo de "esto ya se mandó".
*Fix:* mover el registro a una función atómica en el servidor, o como mínimo generar un id de operación idempotente antes de llamar al Banco Central y bloquear el reintento si ya se usó.

**3. ALTO — inserts de `movimientos` sin chequear error en 3 lugares**
`TransferPage.tsx:287-299,302-314` y `CompraVentaDolaresPage.tsx:86-101` hacen `.insert(...)` sin mirar `{error}`. Si falla, el saldo cambia igual pero no queda rastro en el historial — el usuario ve "éxito" y el historial queda incompleto sin ningún indicio.

**4. ALTO — lecturas/escrituras de saldo sin atomicidad (lost update) en casi todo salvo depósito**
`depositar.sql` sí lo hace bien (`UPDATE saldo = round(saldo + monto,2) ... RETURNING saldo`, atómico). En cambio: `TransferPage.tsx:277,280-281` calcula el nuevo saldo a partir del valor cacheado en el store (no una lectura fresca); `CompraVentaDolaresPage.tsx:76-84` hace lo mismo para dos cuentas sin transacción; `useSyncTransferenciasEntrantes.ts:47-59` hace `SELECT` + `UPDATE` calculado en el cliente (clásico lost update si hay algo concurrente); `useCuenta.ts:170-179` (interés diario) igual. Ninguna usa `FOR UPDATE` ni una función atómica como sí existe en `cerca_nfc.sql` (`pagar_qr_cuenta`). Además `cuentas.saldo` no tiene `check (saldo >= 0)` (a diferencia de `reservas.saldo`) — nada en la base impide un saldo negativo si dos escrituras concurrentes se pisan.
*Fix:* llevar transferencias y compra/venta de USD al mismo patrón atómico que `depositar_en_cuenta`/`pagar_qr_cuenta`.

**5. MEDIO — errores del Banco Central en Transferencias no usan los mensajes amigables ya construidos**
`TransferPage.tsx` no importa `BancoCentralError`/`mensajeAmigableBC` (a diferencia de `CuentasPage.tsx`). Sea cual sea la causa real (Banco Central caído, timeout, 429), siempre muestra el mismo texto genérico — tanto en `buscarDestinatario` como en `handleConfirm` y en `AgendaContactosPanel.buscarPersona`. Justo en la pantalla de mayor riesgo.

**6. MEDIO — la cotización puede cambiar sin aviso entre que se ve el resumen y se confirma**
`TransferPage.tsx:129` refresca la cotización cada 30s, y ese valor alimenta directamente el monto que se confirma. Si cambia mientras el usuario está parado en el resumen, el número se actualiza solo en pantalla sin ningún aviso explícito.

**7. BAJO — sin guard explícito contra doble submit en `handleConfirm`**
Depende solo de que `Button` se re-renderice a tiempo con `disabled`. Funciona en la práctica, pero en la pantalla que mueve plata real conviene un guard explícito (`ref` booleano).

**8. BAJO — `TransferPage`/`CompraVentaDolaresPage` no aceptan coma decimal, `DepositPage` sí**
`DepositPage.tsx:22-25` normaliza coma→punto. Las otras dos usan `<input type="number">` + `parseFloat` directo, que no acepta coma en la mayoría de los navegadores — un usuario que escribe "1500,50" no puede completar el monto ahí, pero sí en Depositar.

### Texto / coherencia

- Tres nombres para lo mismo: "Contactos" (título de página), "Agenda" (título del panel), "Agenda de contactos" (acordeón mobile en Transfer). Unificar en uno.
- Confirmado: `useCuenta.ts:191` sigue usando "Rendimiento de Reserva" para el interés de la cuenta propia — ver causa raíz exacta en la sección de Préstamos/Reservas más abajo.
- El alias que se puede editar a mano en `AgendaContactosPanel.tsx:257` es puramente cosmético (nunca se usa para transferir ni se revalida contra el Banco Central) — puede mostrar un alias inventado/desactualizado sin que se note. Aclarar en la UI que es un apodo propio, no el alias real.

### Features simples

- Límite diario / confirmación extra para montos grandes en transferencias — NFC contactless ya tiene esto (250.000 ARS / 1.500 USD por día en `cerca_nfc.sql:818`), las transferencias normales no tienen ningún tope.
- Idempotencia de transferencia (ver bug #2) — id de operación generado en el cliente antes de llamar al Banco Central.
- Indicador de "sincronización pendiente" en cuentas, dado que las transferencias entrantes (y hoy también las internas, por el bug #1) pueden tardar hasta 2 minutos en verse.
- Aceptar coma decimal en los montos de Transferir y Compra/Venta de dólares (reusar `parseMonto` de `DepositPage`).

### Mejoras de código

- Extraer un RPC único de "transferencia atómica entre dos cuentas" reusando el patrón ya escrito en `cerca_nfc.sql`, en vez de reimplementarlo mal en el cliente en dos lugares.
- `roundMoney` está duplicado idéntico en `TransferPage.tsx`, `CompraVentaDolaresPage.tsx` y `useCuenta.ts` — moverlo a `utils/cuenta.ts`.
- `useTransferenciasRecientes.ts` no maneja el caso de `error` en la consulta — un error real se ve igual que "sin recientes".
- `obtenerMiBankCode` se llama en cada búsqueda de destinatario aunque ya está cacheado — podría precalcularse una sola vez al montar la página.

---

## 3. Préstamos, Reservas, Tarjeta y Mercado

### Bugs

**1. ALTO — el chequeo de situación crediticia "falla abierto" hacia el mejor nivel**
`PrestamosPage.tsx:34,42-49`. Mientras la consulta al Banco Central está cargando (`situacion === null`), la UI ya muestra las condiciones del **mejor** nivel (hasta $8.000.000, mejor TNA) sin ningún loading gate. Y el `.catch()` pisa CUALQUIER error (timeout, 500, red caída) con situación 1 — no sólo el 404 que `consultarSituacion` ya maneja aparte. Alguien en situación 5 ("Irrecuperable") puede terminar con un préstamo aprobado en las mejores condiciones si hace clic durante la carga inicial o si la API falla.
*Fix:* no calcular la oferta hasta que `situacion !== null`, deshabilitar el simulador mientras carga, defaultear a situación 1 sólo en el 404 confirmado.

**2. ALTO — "Congelar tarjeta" no revierte el estado visual si falla el guardado en el servidor**
`TarjetaPage.tsx:61-72`. A diferencia de `toggleNfc` (que sí revierte en el catch), `toggleFreeze` actualiza el estado local y `localStorage` optimistamente y, si `setTarjetaFlags` falla, sólo muestra un toast — la tarjeta queda mostrando "Congelada" (persistido en localStorage) aunque el backend nunca lo registró.

**3. MEDIO — el estado "congelada" en localStorage nunca se puede des-sincronizar desde otro dispositivo**
`TarjetaPage.tsx:49` usa `tarjeta_congelada (server) || localStorage === '1'` — un `'1'` guardado alguna vez en ese navegador gana para siempre sobre un valor `false` real del servidor, hasta que se vuelva a tocar el switch en ese mismo dispositivo.

**4. MEDIO — "Rendimiento de Reserva" en el interés de la cuenta propia: causa raíz confirmada**
`useCuenta.ts:191`, dentro de `accrueInterest()` (que acredita interés sobre la caja de ahorro/cuenta corriente, sin relación con el producto Reservas), copia literalmente la descripción `'Rendimiento de Reserva'` de `useReserva.ts:81`. Un usuario que nunca usó Reservas ve esa leyenda en su historial por el interés de su cuenta normal. Este es el conflicto que ya estaba anotado como pendiente de preguntar — ahora con la causa exacta.
*Fix:* usar `'Rendimiento de cuenta'` en `useCuenta.ts:191`, dejar `'Rendimiento de Reserva'` sólo en `useReserva.ts`.

**5. MEDIO — sin compensación entre los 3 writes secuenciales de `solicitar()` (préstamos)**
`PrestamosPage.tsx:102-123`. Si el insert del préstamo tiene éxito pero falla el update de `cuentas`, queda un préstamo activo cobrando cuotas sin que el dinero haya entrado nunca al saldo. El insert de `movimientos` tampoco chequea error.

**6. BAJO — desajuste de redondeo entre el resumen del simulador y la tabla de amortización**
`PrestamosPage.tsx:69` multiplica cuota fija × cantidad de cuotas, pero `calcularTablaAmortizacion` ajusta la última cuota como "plug" de redondeo — pueden diferir en centavos.

**7. BAJO — `cuentaStore.updateSaldo` no actualiza el array `cuentas`, a diferencia de `updateSaldoCuenta`**
Dos funciones de distinta completitud para lo mismo — entre el update optimista y el refresh, cualquier componente que lea `cuentas` puede mostrar saldo desactualizado por un instante.

### Texto / coherencia

- El resumen "Ofertas Monix" del dashboard (`AdBanner.tsx:22,29`) inventa condiciones que no están en la pantalla de detalle real ("todos los martes" no aparece en `PromosPage`; "fines de semana" no aparece en `CashbackPage`).
- `LandingPage.tsx:289-303` describe la "Tarjeta Monix" como tarjeta de **crédito** (cashback 2% plano, límite de $800.000), pero el producto real es débito, sin límite de crédito, con cashback variable 3-8%. Marketing y producto describen cosas distintas.

### Features simples

- Vencimiento de tarjeta hardcodeado ("12/29") en vez de derivarlo de la fecha de alta.
- `Prestamo.situacion_bcra` existe en la base pero nunca se muestra en la UI.
- Pago adelantado / cancelación anticipada de cuotas — la lógica de amortización francesa ya está armada, sería una extensión natural.
- "Límites diarios" de la tarjeta son estáticos — podría mostrarse el consumo real del día contra el tope.
- Persistir el estado de "ofertas activadas"/"cashback acumulado" (hoy sólo en `useState`, se pierde al refrescar).

### Mejoras de código

- Unificar `updateSaldo`/`updateSaldoCuenta` en `cuentaStore.ts`.
- Los valores de "Límites diarios" están duplicados como strings literales en `TarjetaPage.tsx` y en `asistenteConocimiento.ts` (para el chatbot) — sin fuente única.
- `PrestamosPage.solicitar()` y el loop de cobro de `usePrestamos.ts` hacen varios writes secuenciales sin transacción — mismo riesgo que en cuentas/transferencias.

---

## 4. QR, NFC, Cerca y plugin nativo

### Bugs

**1. MUY ALTO — el advertising de BLE se rompe silenciosamente cada ~4 minutos**
`CercaService.kt:47-75`. Cada heartbeat (`useCerca.tsx`, cada 4 min) relanza `startBle()` con un token rotado, pero reusa el mismo `AdvertiseCallback` sin llamar `stopAdvertising()` antes. Por contrato de la API de Android, esto devuelve `ADVERTISE_FAILED_ALREADY_STARTED`, que sólo se logea y se ignora — el token viejo sigue siendo el que se emite por BLE, mientras que en la base ya se guardó el nuevo. Resultado: a los ~4 minutos de activar "Visible aunque cierre la app", cualquiera que te escanee recibe un token que ya no matchea nada en la base.
*Fix:* llamar `stopAdvertising()` antes de relanzar, o no relanzar si ya está advirtiendo.

**2. MUY ALTO — `startScan`/`stopScan` nativos son no-ops**
`MonixRadioPlugin.kt:419-427`. El escaneo BLE real sólo ocurre como efecto colateral del advertising de la OTRA persona. Si alguien busca sin estar "Visible" (botón "Buscar ahora", o el auto-arranque silencioso), el spinner "Buscando..." gira indefinidamente sin resultado en la APK real.

**3. ALTO — el modo lector NFC nunca se desactiva (leak de radio NFC)**
No existe ningún llamado desde JS a `stopNfcListen()` — sólo se llama `stopScan()` (que además es un no-op, bug #2). El reader-mode queda activo indefinidamente mientras vive la Activity, pudiendo interferir con el propio HCE de pago contactless del mismo dispositivo (compiten por el mismo radio NFC).

**4. ALTO — la cámara queda "colgada" tras cualquier error de escaneo que no sea un abort**
`NfcPayPanels.tsx:347-369`. En el catch de `escanearQr()`, sólo la rama de abort resetea `scanning`; cualquier otro error (QR de tarjeta escaneado por error, cámara ocupada) deja el video congelado en pantalla con el mensaje de error encima, sin forma de reintentar en vivo.

**5. MEDIO — `buscando` puede quedar trabado en `true` para siempre**
`useCerca.tsx:150-166`. Si `startScan()` es abortado, el `if (isAbortError(err)) return` sale ANTES de `setBuscando(false)` — como `CercaProvider` vive en el árbol global (no se desmonta), el ícono de "Buscando..." puede quedar animando indefinidamente.

**6. MEDIO — activar "Visible" en Cerca pide permisos de Cámara y Micrófono sin relación aparente**
`useCerca.tsx:62-69` llama al `requestPermissions()` genérico de Capacitor, que al no tener override por alias pide TODOS los permisos declarados del plugin de una — cámara y micrófono incluidos, sin relación con Bluetooth. Confuso para el usuario.

**7. BAJO-MEDIO — un QR que no es de Monix muestra un error técnico feo**
`NfcPayPanels.tsx:38-52`. Si no matchea ningún formato conocido, termina llamando a la RPC con un string que no es UUID, y el error crudo de Postgres ("invalid input syntax for type uuid") se le muestra tal cual al usuario.

**8. BAJO — `soportaBiometria()` nativo siempre devuelve `{ok: true}`**, sin chequear hardware real (aunque `verificarBiometria()` sí valida al momento de usarla).

### Texto / coherencia

- `asistenteConocimiento.ts:268` también usa "Rendimiento de Reserva" — mismo conflicto ya identificado, no es un hallazgo nuevo, sólo confirma que aparece en más de un lugar.
- `tokens.ts:27-29`: `MONIX_QR_PREFIX` en realidad se usa para **cobros**, y `MONIX_CUENTA_QR_PREFIX` es el que de verdad tiene "QR" en el nombre — nombres cruzados que confunden aunque el código funcione bien.

### Features simples

- Botón "Reintentar" o reinicio automático del loop de escaneo en el estado de error de `QrScannerFullscreen` (además taparía el síntoma del bug #4).
- Indicar en `CercaPage` que "Visible" expira/rota cada 30 min — sobre todo relevante dado el bug #1.
- Usar `BiometricManager.canAuthenticate()` en Kotlin para distinguir huella/Face ID real de "sólo PIN".

### Mejoras de código

- El `useEffect` de `QrScannerFullscreen` depende de `onClose`, que en `NfcPayPanels` es una función inline sin `useCallback` — se recrea en cada re-render, disparando llamadas repetidas al plugin nativo de status bar.
- `CercaService.kt` usa `BluetoothAdapter.getDefaultAdapter()`, deprecado desde API 31.
- Ni `onStartFailure` del advertising ni `onScanFailed` del scanner exponen la falla hacia arriba — todo queda en un `Log.w` silencioso (esto es lo que permite que el bug #1 pase desapercibido).
- `MonixRadio.startScan()`/`startNfcListen()` registran el listener nativo ANTES de confirmar que el plugin arrancó bien.

---

## 5. Shell, dashboard, layout y configuración

### Bugs

**1. Modal genérico y la barra de navegación inferior comparten el mismo z-index**
`Modal.tsx` y `Navbar.tsx` (mobile) usan ambos `z-50`. Como el Navbar se renderiza después en el DOM, gana él — al abrir el detalle de una transacción en mobile, la barra inferior queda pintada encima del modal y sigue siendo clickeable.

**2. Tres overlays de "primer uso" se pueden apilar sin coordinarse**
`PermisosPrimeraVez` (permisos), `WelcomeBonusModal` (bono de bienvenida) y `OnboardingTour` (tour guiado) son tres efectos independientes que no se consultan entre sí — un usuario nuevo en celular puede recibir los tres casi simultáneos en su primer login.

**3. Descargar el comprobante falla en silencio**
`TransactionDetailModal.tsx:41-44`. El `try/finally` de `handleDownload` no tiene `catch` — si `downloadComprobante` rechaza, el spinner desaparece sin ningún aviso de error.

**4. Botones ícono-only del `DatePicker` sin `aria-label`**
Limpiar fecha, abrir calendario, mes anterior/siguiente — los cuatro son botones sin texto ni `aria-label`, invisibles para un lector de pantalla.

### Texto / coherencia

- "Compra y Venta USD" (menú) vs "Compra y Venta de dólares" (título real de la página, que además aparece duplicado dos veces en el mismo archivo).
- `Sidebar.tsx` y `MobileDrawer.tsx` mantienen dos listas de navegación casi idénticas que ya divergieron en los íconos (Depositar y Reservas usan íconos distintos en cada lista) — evidencia de que mantener dos configs a mano ya generó drift real.

### Features simples

- Historial sin paginar más allá de los últimos 100 movimientos, sin aviso ni "cargar más".
- Tocar una notificación sólo navega a `/historial`, sin abrir el detalle de esa transacción puntual.
- El drawer/sidebar no muestra nombre ni avatar del usuario, aunque ya existen en el store.

### Mejoras de código

- **La duplicación de carpetas `src/store/` y `src/stores/` es real**, no solo un nombre parecido: `authStore`/`cuentaStore` en una, `themeStore`/`avatarStore`/`notificacionesStore`/`qrScanStore` en la otra — mezcladas en los mismos archivos (`ProfilePage.tsx` importa de las dos). Vale la pena unificarlas.
- Escala de z-index totalmente ad-hoc, sin sistema: valores van de `z-10` a `z-[10000]` sin ningún criterio documentado — el bug #1 de arriba es el síntoma directo.
- `Button.tsx` no tiene `type="button"` por default (41 de 75 usos no pasan `type` explícito) — funciona hoy porque están bien ubicados fuera de forms, pero es un patrón frágil.
- **`Sidebar.tsx` es código muerto** — no se importa en ningún lado; la navegación desktop real la resuelve `PageWrapper` con el mismo drawer mobile.
- El script `"apk:web"` en `package.json` es un alias idéntico a `apk:debug`, con nombre confuso.

---

## Decisión: Cerca queda afuera de esta ronda de fixes

Todo lo que tiene que ver con la función **Monix Cerca** (BLE/proximidad) — hallazgos #1, #2, #3, #5, #6 de la sección 4, y sus archivos (`CercaPage.tsx`, `useCerca.tsx`, `cerca.ts`, `CercaService.kt`, `MonixHceService.kt`) — se deja deliberadamente de lado en esta ronda. Se aborda aparte más adelante, no por falta de importancia sino porque son bugs nativos de Android (BLE) que conviene resolver y probar juntos, en un dispositivo real, sin mezclarlos con el resto de los fixes de esta pasada. El resto de la sección 4 (QR/NFC de pago, que no depende de Cerca) sí entra en esta ronda.

## Progreso de esta ronda de fixes

_(se va actualizando a medida que se arregla cada cosa — ver commits para el detalle de cada cambio)_

- [x] Auth #1 — registro deja cuenta rota sin mostrar el error (CRÍTICO) — signOut() si falla después de signUp()
- [x] Cuentas #1 — transferencias Monix→Monix bloqueadas por RLS (CRÍTICO) — código + migración `transferencia_atomica` aplicada a la base real (21 sep, vía Supabase MCP)
- [x] Cuentas #2 — transferencias sin idempotencia (CRÍTICO) — misma migración aplicada
- [x] Préstamos #1 — falla abierto hacia el mejor nivel crediticio (ALTO) — gate de loading/error, ya no defaultea a situación 1 en cualquier catch
- [x] Auth #2 — contraseña de huella obsoleta tras cambiar contraseña (ALTO) — se actualiza al cambiar la contraseña en Perfil, y si igual queda desactualizada, mensaje en español + borra la credencial vieja
- [x] Auth #3 — botón instalar PWA casi invisible (ALTO) — movido fuera del paso "bio", visible en los 3 pasos
- [x] Cuentas #3 — inserts de movimientos sin chequear error (ALTO) — resuelto de raíz al mover transferencias y compra/venta USD a las funciones atómicas
- [x] Cuentas #4 — saldo no atómico / lost update (ALTO) — resuelto para transferencias y compra/venta de USD. **Quedan sin atomicidad**: `useSyncTransferenciasEntrantes.ts` (crédito de transferencias entrantes) y `useCuenta.ts` `accrueInterest` (interés diario) — no entraron en esta ronda
- [x] Cuentas #5 — TransferPage sin mensajes amigables de Banco Central (MEDIO) — usa mensajeAmigableBC salvo el 404 (mensaje específico "no se encontró")
- [x] Tarjeta #2 — "Congelar" no revierte si falla el servidor (ALTO) — revierte estado y localStorage en el catch
- [x] QR/NFC #4 — cámara colgada tras error de escaneo (ALTO, no es de Cerca) — setScanning(false) también en la rama de error no-abort
- [x] QR/NFC #7 — QR ajeno muestra error técnico feo (BAJO-MEDIO, no es de Cerca) — mensaje amigable si parseRadioPayload no reconoce el formato
- [x] Shell #3 — descarga de comprobante falla en silencio (medio) — catch + toast de error
- [x] Shell #1 — z-index de Modal vs Navbar en mobile (medio) — Modal subido a z-[300]
- [x] Auth #4 — comentario de seguridad incorrecto en `biometria.ts` (comparaba con Recordarme, que nunca guardó contraseña) — corregido
- [x] Auth #5 — `verificarHuella` sin timeout — mismo patrón `Promise.race` que `asegurarCredencial`
- [x] Auth #6 — email desincronizado al cambiarlo en Perfil — biometría ahora se guarda con `user.email` (identidad confirmada), no `persona.email` (puede ir adelantado)
- [x] Auth #7 — "‹ Cambiar cuenta" no limpiaba el email — ahora sí
- [x] Auth #8 — registro sin `trim()` — nombre/apellido/dni/email/teléfono/dirección se recortan antes de usarse
- [x] **Bug nuevo encontrado y arreglado al revisar el resto de la lista** — `useSyncTransferenciasEntrantes.ts` podía acreditar una transferencia Monix→Monix DOS VECES (una al instante por la RPC nueva, otra ~2 min después por el sync) porque su propio chequeo "¿es transferencia interna?" también estaba roto por RLS, igual que el bug #1 original. Se agregó `bc_transaccion_id` real a `transferir_entre_cuentas` (el sync ya deduplica por ese campo) + un RPC `es_cuenta_interna` para que ese chequeo funcione de verdad como defensa extra. Migraciones `transferencia_atomica_bc_transaccion_id` y `es_cuenta_interna_rpc` ya aplicadas.

## ✅ Migraciones aplicadas (21 sep 2026, vía Supabase MCP)

Apenas el MCP de Supabase volvió a estar disponible en la sesión, se aplicaron las dos migraciones que habían quedado pendientes:
- `transferencia_atomica` — las 3 funciones nuevas (`transferir_entre_cuentas`, `debitar_transferencia_externa`, `convertir_moneda_propia`).
- `personas_situacion_crediticia` — columnas `situacion_crediticia_monix`/`situacion_informada_at` en `personas` (pendiente de sesiones anteriores).

Confirmado con `list_migrations` (ambas registradas) y `get_advisors(security)` (sin alertas nuevas más allá de las mismas ya aceptadas para el resto de las funciones `SECURITY DEFINER` del proyecto). **Falta probar en vivo**: una transferencia Monix→Monix (el destinatario debe verla acreditada al instante, no en 2 minutos), una transferencia a otro banco, y una compra/venta de USD.

## Todo lo que queda por arreglar de esta auditoría

**No-Cerca, sin empezar:**
- Cuentas #4 (resto) — `useCuenta.ts` `accrueInterest` (interés diario) sigue sin atomicidad — es un lost-update de un solo usuario contra su propia cuenta (no cruza usuarios como el de transferencias), menor urgencia, pero mismo patrón a aplicar.
- Préstamos/Tarjeta/Mercado #3 al #7 — localStorage de "congelada" nunca se resincroniza desde otro dispositivo, sin compensación en los 3 writes de `solicitar()` de préstamos, desajuste de redondeo simulador/tabla, `cuentaStore.updateSaldo` incompleto.
- Todos los hallazgos de Texto/Coherencia, Features simples y Mejoras de código de las 5 secciones que todavía no se tocaron.

**Cerca (deliberadamente afuera de esta ronda, ver más arriba):** los 5 bugs nativos de BLE/NFC (#1, #2, #3, #5, #6 de la sección 4) — advertising que se rompe cada 4 min, startScan/stopScan no-ops, reader-mode NFC que nunca se apaga, `buscando` que puede quedar trabado, permisos de cámara/mic pedidos sin necesidad.

## Nota sobre lo ya conocido

No se repiten acá (ya estaban anotados antes de esta auditoría): el fix del timeout de `writeNfc` en Kotlin pendiente de probar en dispositivo real, y la duplicación deliberada de `FinanciacionPage` vs `PrestamosPage` (decisión ya tomada, no un bug).
