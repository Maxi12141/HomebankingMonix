Leé CONSTRAINTS.md antes de escribir código. No lo aflojes para que un cambio pase.

## Componentes de React Bits (registro `@react-bits` vía shadcn)

Antes de instalar o usar cualquiera, sin excepción:

- Instalá siempre la variante `-TS-TW` (TypeScript + Tailwind). Nunca `-JS-*` ni `-*-CSS`.
- Mirá sus `dependencies` con `npx shadcn@latest view @react-bits/<Nombre>-TS-TW` antes del `add`. La mayoría trae `gsap`, `ogl`, `three` o `motion`.
- Cargalo diferido (`React.lazy` + `Suspense`, o `import()` al montarse o al entrar en pantalla), nunca en el bundle inicial. El JS inicial tiene tope de 185 kB gzip en `size-limit` y queda poco margen.
- Fondos WebGL/canvas en la Landing: no pueden ser el elemento LCP ni retrasarlo (CLS ≤ 0.1, FCP ≤ 2600 ms, LCP ≤ 6200 ms). Montalos después del primer render y respetá `prefers-reduced-motion`.
- Después de agregarlo corré `npm run build && npx size-limit` y, si toca la Landing, `npm run check:perf`. Si alguno pasa el límite, no se sube el número: se cambia la carga o el componente.
