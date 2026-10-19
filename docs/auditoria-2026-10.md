# Auditoría de UX, performance y seguridad · octubre 2026

Registro de lo que encontramos al revisar Monix el 18 y 19 de octubre de 2026, y de cómo lo resolvimos.
Cada solución indica en qué commit quedó y qué la prueba.
La vara de calidad que surgió de esta revisión está en [`CONSTRAINTS.md`](../CONSTRAINTS.md).

## Cómo se midió

| Herramienta | Qué midió |
|---|---|
| `npm audit --omit=dev` | Vulnerabilidades conocidas en las dependencias que llegan a producción |
| Lighthouse 12.8.2, emulación mobile y desktop | Build de producción servido con `vite preview`, con Supabase simulado. Landing y Login |
| axe-core (`@axe-core/playwright`), WCAG 2.1 AA | 9 pantallas: 3 públicas y 6 con sesión |
| Playwright, viewport 390 px | Tamaño de los elementos táctiles y contraste de los montos |
| Skill `ui-ux-pro-max` (nextlevelbuilder, commit `56ea9cf`) | Reglas de UX mobile. Su paleta sugerida no se usó porque el Manual de Marca manda |
| Skill `webperf` (auditor de performance) | Lectura de los informes de Lighthouse y del código |

Las pantallas con sesión se probaron con Supabase y el Banco Central simulados, así que ningún dato real se tocó.

## Vulnerabilidades

### V1 · Dependencias de producción con vulnerabilidades conocidas

Medición del 2026-10-18: **1 alta y 5 moderadas**, todas transitivas salvo `react-router-dom`.

| Paquete | Severidad | Llega por | Problema | Impacto real en Monix |
|---|---|---|---|---|
| `ws` 8.20.0 | **Alta** | `@supabase/realtime-js` | Lectura de memoria sin inicializar ([GHSA-58qx-3vcg-4xpx](https://github.com/advisories/GHSA-58qx-3vcg-4xpx)) y agotamiento de memoria ([GHSA-96hv-2xvq-fx4p](https://github.com/advisories/GHSA-96hv-2xvq-fx4p)) | Bajo: `ws` es la implementación de WebSocket para Node. En el navegador, Realtime usa el WebSocket nativo |
| `react-router-dom` / `react-router` / `@remix-run/router` 6.x | Moderada | dependencia directa | Redirección abierta con `//` o `\` en `<Link>` y `navigate()` ([GHSA-jjmj-jmhj-qwj2](https://github.com/advisories/GHSA-jjmj-jmhj-qwj2), [GHSA-wrjc-x8rr-h8h6](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6), [GHSA-2j2x-hqr9-3h42](https://github.com/advisories/GHSA-2j2x-hqr9-3h42)) | Hoy no explotable: todos los `navigate()` y `<Link>` usan rutas fijas (revisado `QrPanels.irA`, `AsistenteBubble.go` y los `href` de `services/asistente.ts`). Si alguna vez una ruta sale del contenido de un QR, pasa a ser grave en un banco |
| `dompurify` 3.4.2 | Moderada (11 avisos) | `jspdf` | Saltos del sanitizado en modo `IN_PLACE` y con hooks | Bajo: Monix arma el comprobante con `html2canvas` y una imagen, y no usa `jsPDF.html()`, que es lo que pasa por DOMPurify |
| `fflate` 0.8.2 | Moderada | `jspdf` | Bucle infinito al descomprimir ZIP64 malformado ([GHSA-px8p-9vwx-vf98](https://github.com/advisories/GHSA-px8p-9vwx-vf98)) | Nulo: Monix no descomprime archivos |

**Solución aplicada (P0-1):** `npm audit fix`, sin `--force`. Quedaron `ws` 8.22.0, `dompurify` 3.4.17, `fflate` 0.8.3 y `react-router-dom` 6.30.6. Resultado: **0 altas y 2 moderadas**.

Las 2 que quedan son `react-router` y `react-router-dom`. Se arreglan recién en React Router 7, una versión mayor con cambios que rompen, así que no se forzó. Hoy no son explotables, porque todas las rutas son fijas. **Recomendación:** migrar a React Router 7 en un cambio aparte, y no armar nunca una ruta a partir del contenido de un QR o de un parámetro de la URL.

### V2 · Crítica: el usuario puede escribir su propio saldo desde el navegador

Las operaciones centrales (transferir, pagar con QR, depositar y comprar o vender dólares) pasan por RPC del servidor. Pero las políticas RLS dejan que cualquier usuario logueado modifique, con la clave pública y su propia sesión, datos que deberían cambiar sólo en el servidor.

| Política (archivo) | Qué permite hoy | Abuso posible desde la consola del navegador |
|---|---|---|
| `cuentas for update using (auth.uid() = persona_id)` (`supabase/policies.sql:27`) | Actualizar **cualquier columna** de sus cuentas | `supabase.from('cuentas').update({ saldo: 99999999 }).eq('id', miCuenta)` |
| `cuentas for insert with check (auth.uid() = persona_id)` (`policies.sql:19`) | Crear cuentas propias con cualquier valor | Abrir una cuenta con saldo inicial inventado |
| `personas for update using (auth.uid() = id)` (`policies.sql:12`) | Actualizar cualquier columna de su perfil | Cambiar `situacion_crediticia_monix`, que Préstamos usa para la tasa y el monto máximo |
| `prestamos for insert/update` (`supabase/prestamos.sql:29-36`) | Crear préstamos y editarlos | Crear un préstamo con cualquier monto, o marcar cuotas como pagadas |
| `movimientos for insert` (`policies.sql:34`) | Insertar movimientos en sus cuentas | Fabricar historial y comprobantes |
| `reservas for update` (`policies.sql:69`) | Actualizar su reserva | Escribir el saldo de la reserva |

Estas escrituras existen porque la app las necesita hoy desde el navegador: el interés diario (`useCuenta.ts`), Reservas, MercadoMonix, Préstamos (`usePrestamos.ts`, `PrestamosPage.tsx`) y la sincronización de transferencias entrantes (`useSyncTransferenciasEntrantes.ts:65`).

**Alcance de la verificación:** se revisaron los archivos SQL del repo, y ninguna migración posterior reemplaza estas políticas. **No se verificó contra la base de producción**, porque el MCP de Supabase no estaba autorizado en esta sesión. Antes de cualquier cambio hay que confirmarlo en el SQL Editor con `select * from pg_policies where tablename in ('cuentas','personas','prestamos','movimientos','reservas');`.

**Solución propuesta, sin implementar todavía porque requiere una migración en la base de producción:**

1. **Privilegios por columna:** `revoke update on public.cuentas from authenticated;` y después `grant update (alias, tarjeta_congelada) on public.cuentas to authenticated;`. Igual en `personas`, dejando editables sólo los datos de contacto, `ingreso_mensual` y `sueldo_acreditado`.
2. **Mover al servidor** cada escritura de saldo, como RPC `SECURITY DEFINER` que valida y registra el movimiento en la misma transacción, siguiendo el patrón de `transferencia_atomica.sql`. Las RPC a crear: interés diario, mover fondos a la reserva y desde ella, compra en MercadoMonix, alta y cobro de préstamos, y acreditación de transferencias entrantes (idempotente por `bc_transaccion_id`).
3. **Insert de cuentas y movimientos:** sacarle al cliente el insert directo en `cuentas` y `movimientos`; los hacen las RPC.
4. **Orden seguro:** primero las RPC, después cambiar el front para que las use y recién al final revocar los privilegios. En orden inverso, la app se rompe en producción.

**Agravante de performance:** las 15 pantallas montan cada una su propio `PageWrapper`, y con él la sincronización de transferencias. Cada navegación repite la consulta al Banco Central. Eso se resuelve en P1-9, aparte del arreglo de seguridad.

### V3 · Secretos sin control automático

No hay ninguna herramienta que impida commitear claves (`service_role` de Supabase, la clave privada del QR). Queda registrado como pendiente en `CONSTRAINTS.md`: instalar gitleaks (`gitleaks detect --redact`) o correrlo en un CI.

## Hallazgos de UX, accesibilidad y performance

| ID | Hallazgo | Medición del 2026-10-18 |
|---|---|---|
| H1 | Elementos táctiles de menos de 44×44 px | 46 en 6 pantallas: copiar CBU y alias de 13 px, ocultar saldo de 16 px, menú de 24 px, notificaciones y tema de 34 px |
| H2 | Violaciones de axe serias o críticas | 14: links e íconos sin nombre accesible, el link "Registrate" que se distingue sólo por color (1,8:1), un control interactivo anidado en Tarjeta |
| H3 | Login y Registro sin `autocomplete` | Los gestores de contraseñas y el autocompletado del celular funcionan peor (WCAG 2.2, autenticación accesible) |
| H4 | Montos con `type="number"` | 8 campos. Maneja mal la coma decimal y en desktop la rueda del mouse cambia el valor |
| H5 | La app entra desde opacidad 0 después del splash | Lighthouse no puede medir el LCP (`NO_LCP`) |
| H6 | Splash de 2,4 s mínimos en cada carga | FCP mobile de 3,7 s. **Se mantiene por decisión de producto (2026-10-18)** |
| H7 | Un solo bundle de JS sin carga diferida | 462,6 kB gzip. jsPDF y html2canvas, que sólo se usan para comprobantes, son unos 150 kB |
| H8 | Polling y sincronización innecesarios | QR consulta cada 5 s con la pestaña oculta. Sincronización con el Banco Central en cada navegación (ver V2) |
| H9 | Google Fonts bloquea el render | 2 orígenes externos en el camino crítico |
| H10 | Detalles menores | `backdrop-blur` en barras fijas, cinta de cotizaciones animada fuera de pantalla, `meta no-store` sin efecto en `index.html` |

## Plan y estado

| Paso | Qué | Resuelve | Estado |
|---|---|---|---|
| S-1 | RPC de servidor para cada escritura de saldo, y privilegios por columna | V2 | **Espera aprobación**: migración en la base de producción |
| P0-1 | `npm audit fix` | V1 | Hecho: 1 alta y 5 moderadas pasaron a 0 altas y 2 moderadas |
| P0-2 | Áreas táctiles de 44 px sin cambiar el aspecto | H1 | Pendiente |
| P0-3 | Nombres accesibles y link subrayado | H2 | Pendiente |
| P0-4 | `autocomplete` en Login y Registro | H3 | Pendiente |
| P0-5 | Montos con `inputMode="decimal"` y un parser único | H4 | Pendiente |
| P0-6 | Sacar la entrada desde opacidad 0 del contenedor | H5 | Pendiente |
| P1-7 | Cargar jsPDF y html2canvas al generar el comprobante | H7 | Pendiente |
| P1-8 | Cargar cada pantalla al visitarla | H7 | Pendiente |
| P1-9 | Una sola sincronización con el Banco Central, pausada en segundo plano | H8, V2 (parte de performance) | Pendiente |
| P1-10 | Fuentes servidas desde la app | H9 | Pendiente |
| P2-11 | Blur, cinta de cotizaciones y `meta no-store` | H10 | Pendiente |
| P2-12 | Controles de desktop a 1024 y 1440 px en Playwright | Cobertura desktop | Pendiente |

## Registro de cambios

Cada paso agrega acá qué se hizo, cómo se verificó y en qué commit quedó.

### P0-1 · Dependencias (2026-10-19)

- **Comando:** `npm audit fix` sin `--force`. Sólo cambió `package-lock.json` (21 líneas).
- **Verificación:** `npm audit --omit=dev --audit-level=high` sale 0. `npm run check:task` en verde: floor-guard limpio, `tsc` sin errores, build OK, JS inicial de 462,48 kB y 14/14 pruebas de Playwright.
- **Trampa encontrada:** `npm audit fix --omit=dev` borra de `node_modules` las dependencias de desarrollo, TypeScript incluido. Hay que correr `npm install` después, o no usar `--omit=dev` en el fix.
