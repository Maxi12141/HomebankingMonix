// Lighthouse mobile contra un build de producción servido en local, con
// Supabase y Banco Central simulados (la Landing no necesita sesión).
// Compara contra los números de CONSTRAINTS.md. Uso: npm run check:perf
import { build, preview } from 'vite'
import lighthouse from 'lighthouse'
import { launch } from 'chrome-launcher'
import { chromium } from 'playwright'

// Línea de base 2026-10-19 (Lighthouse 12.8.2, mobile, throttling aplicado por
// DevTools). El modo simulado por defecto devuelve NO_LCP con esta versión de
// Chromium: por eso se mide con throttling real. Sólo se bajan, nunca se suben.
const PRESUPUESTO = {
  cls: 0.1, // Core Web Vitals "bueno"; hoy 0.041
  fcpMs: 4200, // hoy ~4.0 s: el splash dura 2,4 s mínimo por decisión de producto
  lcpMs: 7800, // hoy ~7.6 s en 4G lento: splash + 464 kB de JS antes de pintar
}

process.env.VITE_SUPABASE_URL = 'http://mock.supabase.local'
process.env.VITE_SUPABASE_ANON_KEY = 'anon-test-key'
process.env.VITE_BC_URL = 'http://mock.bc.local'
const outDir = '.perf/dist'

await build({ logLevel: 'error', build: { outDir, emptyOutDir: true } })
const server = await preview({ preview: { port: 4199, strictPort: true }, build: { outDir }, logLevel: 'error' })
const chrome = await launch({ chromePath: chromium.executablePath(), chromeFlags: ['--headless=new'] })

let fallas = 0
try {
  const { lhr } = await lighthouse('http://localhost:4199/', { port: chrome.port, onlyCategories: ['performance'], output: 'json', logLevel: 'error', throttlingMethod: 'devtools' })
  const a = lhr.audits
  const cls = a['cumulative-layout-shift'].numericValue
  const fcp = a['first-contentful-paint'].numericValue
  const lcp = a['largest-contentful-paint'].numericValue
  console.log(`FCP ${Math.round(fcp)} ms (≤ ${PRESUPUESTO.fcpMs}) · CLS ${cls.toFixed(3)} (≤ ${PRESUPUESTO.cls}) · LCP ${lcp ? Math.round(lcp) + ' ms' : 'no medible'} (≤ ${PRESUPUESTO.lcpMs})`)
  if (!(cls <= PRESUPUESTO.cls)) { fallas++; console.log(`✗ CLS ${cls} supera ${PRESUPUESTO.cls}`) }
  if (!(fcp <= PRESUPUESTO.fcpMs)) { fallas++; console.log(`✗ FCP ${Math.round(fcp)} ms supera ${PRESUPUESTO.fcpMs} ms`) }
  if (!(lcp <= PRESUPUESTO.lcpMs)) { fallas++; console.log(`✗ LCP ${lcp ? Math.round(lcp) + ' ms' : 'no medible'} supera ${PRESUPUESTO.lcpMs} ms`) }
} finally {
  await chrome.kill()
  await new Promise((res) => server.httpServer.close(res))
}
console.log(fallas ? `\n${fallas} presupuesto(s) superado(s)` : '\nPresupuestos de performance OK')
process.exit(fallas ? 1 : 0)
