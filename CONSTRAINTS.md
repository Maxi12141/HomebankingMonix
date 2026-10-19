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
| Toques | Elementos interactivos de menos de 44×44 px: como máximo 46 (no puede subir) | `npm run test:e2e` | `check:task` |
| Accesibilidad | Violaciones axe serias o críticas (WCAG 2.1 AA) en 9 pantallas: como máximo 14 (no puede subir) | `@axe-core/playwright` en `npm run test:e2e` | `check:task` |
| Bundle | JS inicial ≤ 465 kB gzip (no puede crecer) | `size-limit` (`.size-limit.json`) | `check:task` |
| Performance | CLS ≤ 0.1 y FCP mobile ≤ 3800 ms en la Landing | Lighthouse 12.8.2 (`npm run check:perf`) | `check:full` |
| Dependencias | Nada alto o crítico en dependencias de producción | `npm audit --omit=dev --audit-level=high` | `check:full` |

Por qué estos números:

- **11 px:** el piso tipográfico del Manual de Marca v1.3 (etiquetas Inter Bold 11 px).
- **44 px:** el mínimo táctil de iOS (Android pide 48 dp). La app se usa sobre todo en el celular.
- **axe y Lighthouse son controles externos.** Miden contra WCAG y un navegador real, no contra nuestros propios tests.
- **Los máximos de toques y axe** son los valores medidos hoy. Cada arreglo baja el número acá, y nunca se sube.
- **FCP 3800 ms:** hoy da 3,7 s porque el splash dura como mínimo 2,4 s por decisión de producto. El presupuesto sólo impide que empeore.

## Medido, todavía no exigido

| Métrica | Hoy (2026-10-18) | Dirección |
|---------|------------------|-----------|
| LCP mobile | no medible: el splash de 2,4 s (decisión de producto) y la entrada en opacidad 0 lo ocultan | medirlo apenas el shell deje de entrar desde opacidad 0 |
| JS inicial | 462,6 kB gzip, un solo chunk | bajar con carga diferida por ruta y de jsPDF/html2canvas |
| Vulnerabilidades en producción | 1 alta (`ws`), 5 moderadas, con arreglo vía `npm audit fix` | llegar a 0 altas antes del 2026-11-01 |
| Supresiones existentes | 5 (`@ts-ignore` / `@ts-expect-error`) | no puede subir |

## Pendiente

- **Secretos con gitleaks** (`gitleaks detect --redact --no-banner`). Hoy no está instalado: se instala en la máquina o va al CI cuando exista. Mientras tanto, el piso lo cubre sólo en revisión.
- **Lint:** el proyecto no tiene ESLint ni Biome. Recién con uno configurado se agrega como fila.

## Excepciones

| ID | Regla | Ruta | Motivo | Dueño | Vence |
|----|-------|------|--------|-------|-------|
