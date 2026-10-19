# Constraints

Vara de calidad de Monix: homebanking mobile-first con uso en desktop.
Última revisión: 2026-10-18, por Diego Urenda.

Este archivo manda sobre los scripts de `package.json`, que sólo lo reflejan.
No se afloja para que un cambio pase: se arregla el código o se abre una excepción con dueño y fecha.

## Piso (siempre, bloquea)

- Sin supresiones nuevas: `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `eslint-disable`
- Sin código a medio hacer: `throw new Error("Not implemented")`, `catch {}` vacío, `TODO` en lugar de la implementación
- Sin tests salteados (`.skip`), borrados ni con aserciones quitadas
- Sin secretos en el código (claves de Supabase `service_role`, claves privadas del QR)
- Este archivo no se afloja: bajar un número o borrar una regla es una excepción, no un cambio

Lo controla `node scripts/floor-guard.mjs` sobre el diff contra `origin/main` (sale 1 si encuentra algo, 2 si no pudo correr).

## Con números

Período de aviso: hasta el 2026-11-01 estos controles avisan sin bloquear (`|| echo AVISO` en `package.json`).
Desde esa fecha se saca el `|| echo` y bloquean.

| Dimensión | Regla | Controlado por | Corre en |
|-----------|-------|----------------|----------|
| Tipos | Cero errores de tipos | `tsc --noEmit` | `check:fast`, cada cambio |
| Marca | Texto visible ≥ 11 px; montos en mint tinta (claro) o mint (oscuro); foco visible con Tab; loader con los tiempos de `motion/monix-logo.aep` | `npm run test:e2e` (Playwright) | `check:task` |
| Mobile | Sin scroll horizontal a 320 px en 9 pantallas | `npm run test:e2e` | `check:task` |
| Toques | Ningún elemento interactivo de menos de 44×44 px en 6 pantallas con sesión (era 46 el 2026-10-18) | `npm run test:e2e` | `check:task` |
| Accesibilidad | Cero violaciones axe serias o críticas (WCAG 2.1 AA) en 9 pantallas (eran 14 el 2026-10-18) | `@axe-core/playwright` en `npm run test:e2e` | `check:task` |
| Bundle | JS inicial ≤ 465 kB gzip (no puede crecer) | `size-limit` (`.size-limit.json`) | `check:task` |
| Performance | CLS ≤ 0.1, FCP ≤ 4200 ms y LCP ≤ 7800 ms en la Landing, mobile con throttling aplicado | Lighthouse 12.8.2 (`npm run check:perf`) | `check:full` |
| Dependencias | Nada alto o crítico en dependencias de producción | `npm audit --omit=dev --audit-level=high` | `check:full` |

Por qué estos números:

- **11 px:** el piso tipográfico del Manual de Marca v1.3 (etiquetas Inter Bold 11 px).
- **44 px:** el mínimo táctil de iOS (Android pide 48 dp). La app se usa sobre todo en el celular.
- **axe y Lighthouse son controles externos.** Miden contra WCAG y un navegador real, no contra nuestros propios tests.
- **Toques y axe** arrancaron como líneas de base medidas (46 y 14) y bajaron a 0 el 2026-10-19. Ahora cualquier caso nuevo hace fallar el control.
- **FCP 4200 ms y LCP 7800 ms:** hoy dan 4,0 s y 7,6 s con 4G lento, porque el splash dura como mínimo 2,4 s (decisión de producto) y antes de pintar se bajan 464 kB de JS. Los presupuestos sólo impiden que empeoren; la carga diferida de P1 los tiene que bajar.

## Medido, todavía no exigido

| Métrica | Hoy (2026-10-18) | Dirección |
|---------|------------------|-----------|
| JS inicial | 462,6 kB gzip, un solo chunk | bajar con carga diferida por ruta y de jsPDF/html2canvas |
| Vulnerabilidades en producción | 0 altas; 2 moderadas en `react-router` 6, que se arreglan recién en la v7 (versión mayor) | no puede subir; migrar a React Router 7 en un cambio aparte |
| Supresiones existentes | 5 (`@ts-ignore` / `@ts-expect-error`) | no puede subir |

## Pendiente

- **Secretos con gitleaks** (`gitleaks detect --redact --no-banner`). Hoy no está instalado: se instala en la máquina o va al CI cuando exista. Mientras tanto, el piso lo cubre sólo en revisión.
- **Lint:** el proyecto no tiene ESLint ni Biome. Recién con uno configurado se agrega como fila.

## Excepciones

| ID | Regla | Ruta | Motivo | Dueño | Vence |
|----|-------|------|--------|-------|-------|
| E1 | Performance: FCP ≤ 3800 ms pasa a ≤ 4200 ms | Landing (`scripts/lighthouse.mjs`) | Cambio de método, no regresión: el modo simulado de Lighthouse no podía medir el LCP y se pasó a throttling aplicado. El mismo código da 3,7 s en un método y 4,0 s en el otro. Aprobado el 2026-10-19 | @Diego Urenda | 2027-01-19 |
