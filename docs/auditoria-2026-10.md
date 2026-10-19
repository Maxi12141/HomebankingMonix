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
| H4 | Montos con `type="number"` y un parser que lee mal el punto de miles | 9 campos. Maneja mal la coma decimal y en desktop la rueda del mouse cambia el valor. Además, **bug de dinero**: `parseFloat(texto.replace(',', '.'))` lee "1.500" como 1,5. En Depositar, que ya era un campo de texto, escribir "1.500" acreditaba $1,50 |
| H5 | Lighthouse no puede medir el LCP (`NO_LCP`) | Se atribuyó a la entrada desde opacidad 0. **Diagnóstico corregido en P0-6:** era el modo simulado de Lighthouse |
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
| P0-2 | Áreas táctiles de 44 px sin cambiar el aspecto | H1 | Hecho: 46 pasaron a 0 |
| P0-3 | Nombres accesibles y link subrayado | H2 | Hecho: 14 pasaron a 0 |
| P0-4 | `autocomplete` en Login y Registro | H3 | Hecho |
| P0-5 | Montos con `inputMode="decimal"` y un parser único | H4 | Hecho |
| P0-6 | Medir el LCP | H5 | Hecho: el LCP se mide (7,6 s en 4G lento). El cambio de código propuesto se descartó |
| P1-7 | Cargar jsPDF y html2canvas al generar el comprobante | H7 | Hecho: JS inicial de 462,8 a 285 kB gzip |
| P1-8 | Cargar cada pantalla al visitarla | H7 | Hecho: JS inicial 181,6 kB; FCP 2,4 s; LCP 6,0 s |
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

### P0-2 · Áreas táctiles de 44 px (2026-10-19)

- **Qué se hizo:** dos utilidades en `src/index.css`. `.toque` deja el control en 44×44 y con un margen negativo calculado a partir de `--toque`, el tamaño visible, devuelve lo que agrega: el diseño no se mueve. `.toque-texto` hace lo mismo con los links de texto, usando `1lh`.
- **Dónde:** el encabezado (menú, logo, notificaciones, tema), copiar CBU y alias y ocultar saldo en el Dashboard y la Tarjeta, Ver todos, Compartir, el selector de fechas y los controles del Perfil.
- **Por estructura:** el botón "Dorso" y el switch de huella pasan a ser un área transparente de 44 px con la píldora y el riel visibles adentro, del mismo tamaño que antes.
- **Crecen un poco:** los campos de búsqueda de Historial, los filtros Todos, Entradas y Salidas, y el acordeón de la agenda en Transferir pasan a una altura mínima de 44 px. Crecen entre 2 y 6 px.
- **Ajuste del test:** un checkbox dentro de su `<label>` se mide por el label, que es el área que recibe el toque (área equivalente en WCAG).
- **Verificación:** el test de toques pasó de 46 a 0 y la línea de base de `CONSTRAINTS.md` quedó en 0. 14/14 pruebas. Las capturas del Dashboard y la Tarjeta a 390 y 320 px no muestran cambios visuales.

### P0-3 · Accesibilidad con axe (2026-10-19)

| Violación | Dónde | Arreglo |
|---|---|---|
| `link-name` | Logo del menú lateral, en 6 pantallas | `aria-label="Ir al inicio"`. El del encabezado ya lo había ganado en P0-2 |
| `button-name` | Buscar destinatario (Transferir), borrar fecha y abrir calendario (Historial), switch de biometría (Perfil) | `aria-label` en los tres primeros; `aria-labelledby` hacia el título "Ingreso con biometría" en el switch |
| `link-in-text-block` | "Registrate" (Login) e "Iniciá sesión" (Registro) | Subrayado: ya no se distinguen sólo por el color |
| `nested-interactive` | Tarjeta 3D: era un botón con los botones de copiar adentro | La tarjeta deja de ser un botón: se sigue dando vuelta al tocarla, y con teclado y lector de pantalla se usa "Dorso" |
| `color-contrast` | "desde tu celular." en la Landing (mint sobre blanco, 1,1:1) e iniciales del avatar en el Perfil | Azul noche en modo claro, mint en oscuro, como pide el manual. En la Landing el mint pasa a un subrayado grueso, que hace eco del arco del logo |

- **Verificación:** axe pasó de 14 a 0 en 9 pantallas y la línea de base de `CONSTRAINTS.md` quedó en 0. 14/14 pruebas. Revisé las capturas de la Landing en móvil, en desktop y en modo oscuro.
- **Ajuste del test:** ahora imprime el selector de cada violación, para poder ubicarla sin una segunda corrida.

### P0-4 · Autocompletado de credenciales (2026-10-19)

- **Qué se hizo:** `autocomplete` en los 19 campos de credenciales y datos personales.
  - **Login:** `username` y `current-password`.
  - **Registro:** `email`, `new-password`, `given-name`, `family-name`, `tel` y `street-address`.
  - **Recuperar y restablecer contraseña:** `email` y `new-password`.
  - **Desbloqueo, cambio de contraseña y confirmaciones del Perfil:** `current-password` y `new-password`.
  - **Alias del Perfil:** `off`, para que el navegador no ofrezca guardarlo como contraseña.
- **Por qué importa en un banco:** el gestor de contraseñas del celular completa usuario y clave, y propone una clave fuerte al registrarse. Cumple WCAG 2.2, autenticación accesible: no obliga a recordar ni a transcribir.
- **Verificación:** prueba nueva "Login y Registro: autocompletado y pegado habilitados". Comprueba los atributos y que ningún handler cancele el pegado en el email. 15/15 pruebas.

### P0-5 · Montos: teclado decimal y un único parser (2026-10-19)

- **Bug corregido:** el patrón `parseFloat(texto.replace(',', '.'))`, repetido en 11 lugares, interpretaba el punto como decimal. "1.500" (mil quinientos) se leía como 1,5, y "1.234,56" como 1,234. En Depositar se acreditaba un monto mil veces menor sin ningún aviso.
- **Parser único:** `src/utils/monto.ts` (`parseMonto`). Punto de miles y coma decimal ("1.500,75"). Acepta el punto como decimal sólo cuando no puede ser de miles ("1500.5", "0.75"). Devuelve `NaN` ante cualquier formato ambiguo o con más de 2 decimales, y así la pantalla muestra "Ingresá un monto válido" en vez de adivinar.
- **Dónde se usa:** reemplaza las 11 lecturas, en Depositar, Transferir, Dólares, Reservas, Préstamos, Cashback, Metas, Perfil (ingreso mensual) y los tres montos de cobro y pago con QR. No se tocó `lib/qrJwt.ts`, que lee montos de un QR firmado: son datos de máquina, no texto escrito por una persona.
- **Teclado:** los 9 campos `type="number"` pasan a `type="text" inputMode="decimal"`. En el celular sale el teclado numérico con coma, y en desktop la rueda del mouse ya no cambia el monto.
- **Verificación:**
  - **Unitarias:** `tests/unit/monto.test.mjs`, 4 grupos con formato argentino, punto decimal, `$` y espacios, y 13 entradas inválidas. Corren en `npm run check:fast`.
  - **E2E:** la prueba nueva escribe "1.500" en Depositar y comprueba que la RPC reciba `p_monto: 1500` y que la pantalla diga "$ 1.500,00". Con el código anterior falla, porque recibe 1,5.
  - **Total:** 16/16 pruebas.

### P0-6 · Medir el LCP (2026-10-19)

- **Hipótesis inicial (auditor y Claude):** Lighthouse no medía el LCP porque la app entraba desde opacidad 0 después del splash.
- **Qué se probó:** sacar el fundido del contenedor (`initial={false}`) y del título de la Landing. Con un `PerformanceObserver` en Chromium, el LCP aparecía (2644 ms sin throttling), pero Lighthouse seguía devolviendo `NO_LCP`.
- **Causa real:** el modo de throttling **simulado** de Lighthouse 12.8.2, que con este Chromium tira errores del motor de trazas (`TraceEngine`). Con throttling **aplicado** (`throttlingMethod: 'devtools'`), el LCP se mide **también con el código original**: 7650 ms antes contra 7637 ms después, lo que es ruido.
- **Decisión:** se revirtió el cambio de código, porque no mejoraba nada medible, y la app conserva su fundido. Quedó el arreglo real: `scripts/lighthouse.mjs` mide con throttling aplicado.
- **Nuevas líneas de base** (mobile, 4G lento, throttling aplicado): FCP 4,0 s, **LCP 7,6 s**, CLS 0,041.
- **Presupuestos:** LCP ≤ 7800 ms y CLS ≤ 0,1 pasan a exigirse. El FCP sube de 3800 a 4200 ms por el cambio de método: es la **excepción E1** de `CONSTRAINTS.md`, aprobada por Diego Urenda, que vence el 2027-01-19.
- **Hallazgo sobre el propio control:** `floor-guard` compara contra `origin/main`, donde `CONSTRAINTS.md` todavía no existe, y por eso no veía un umbral aflojado dentro de esta rama. `check:fast` ahora corre también `--base HEAD`, que lo detecta antes del commit.
- **Lectura:** 7,6 s hasta ver el contenido en un celular con red lenta es mucho para un banco. La mitad es el splash (decisión de producto) y la otra mitad el JS. Los pasos P1-7 y P1-8 atacan esa segunda mitad.

### Cierre de P0 (2026-10-19)

- **Ajuste del control del piso:** una excepción registrada en la tabla de `CONSTRAINTS.md` se imprime siempre como `AVISO excepción vigente`, pero ya no bloquea. Antes, la E1 aprobada dejaba `check:fast` en rojo durante toda la vida de la rama. Los demás movimientos que bajan la vara siguen bloqueando.
- **Corrida completa, `npm run check:full`, en verde:**
  - **Piso:** limpio, contra `origin/main` y contra `HEAD`.
  - **Tipos y tests:** `tsc` sin errores y 4 tests unitarios.
  - **Bundle:** JS inicial de 462,8 kB.
  - **E2E:** 16/16, con 0 violaciones de axe y 0 toques chicos.
  - **Performance:** FCP 4,0 s, LCP 7,6 s y CLS 0,041.
  - **Dependencias:** 0 altas y 2 moderadas, documentadas en V1.
- **Sigue:** S-1 (espera aprobación) y P1-7 a P2-12.

### P1-7 · jsPDF y html2canvas fuera de la carga inicial (2026-10-19)

- **Qué se hizo:** `src/utils/comprobante.ts` importa jsPDF y html2canvas adentro de `crearPdf()`, la única función que los usa. El tipo `jsPDF` queda como `import type`, que no suma bytes.
- **Gesto de compartir:** compartir con Web Share exige un toque reciente. Para que la descarga del chunk no lo consuma, `precargarComprobante()` baja las librerías en segundo plano al abrir el detalle de un movimiento y al llegar a la pantalla de transferencia exitosa. Si igual se pierde el gesto, sigue el caso que ya existía: el PDF queda listo y un segundo toque comparte al instante.
- **Resultado:** JS inicial de **462,8 kB a 285 kB gzip (−38 %)**. jsPDF (129 kB) y html2canvas (48 kB) quedan en chunks propios. El presupuesto de `size-limit` pasa de 465 a 290 kB.
- **Verificación:** prueba nueva que comprueba que el Dashboard no pide jsPDF ni html2canvas, y que al tocar Descargar en un movimiento se bajan y se genera `monix_*.pdf`. 17/17 pruebas.

### P1-8 · Cada pantalla en su propio chunk (2026-10-19)

- **Qué se hizo:** en `src/App.tsx`, 18 pantallas pasan a `React.lazy` con un `<Suspense>` que muestra un esqueleto mientras baja el chunk. La Landing y el Login quedan en la carga inicial, porque son la puerta de entrada.
- **Precarga:** con una sesión guardada en `localStorage`, el chunk del Dashboard (13,7 kB gzip) se pide **durante** el splash y no después. Sin sesión no se baja.
- **Resultados** (Lighthouse mobile, 4G lento, throttling aplicado):

| Métrica | Antes de P1 | Después de P1-7 | Después de P1-8 |
|---|---|---|---|
| JS inicial (gzip) | 462,8 kB | 285 kB | **181,6 kB (−61 %)** |
| FCP | 4,0 s | 4,0 s | **2,4 s** |
| LCP | 7,6 s | 7,6 s | **6,0 s** |

- **Presupuestos ajustados:** `size-limit` en 185 kB, FCP ≤ 2600 ms y LCP ≤ 6200 ms.
- **Excepción E1 retirada:** el FCP medido (2,4 s) quedó por debajo del 3,8 s original, así que no hace falta.
- **Sobre el control del piso:** al endurecer, el guard marcó dos hallazgos. Pasa porque el texto de justificación empezaba con los números y porque la fila "JS inicial" no tiene `≤`, así que no puede leer la dirección del cambio. Se revisó a mano que ambos son endurecimientos, y la justificación pasó a una etiqueta estable ("Presupuestos de performance").
- **Verificación:** 18/18 pruebas, con una nueva que comprueba la precarga con sesión y que la Landing sin sesión no baje el Dashboard. `tsc` sin errores. Lighthouse en verde.
