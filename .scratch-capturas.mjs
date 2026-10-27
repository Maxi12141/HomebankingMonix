import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const OUT = 'C:/Users/Admin/AppData/Local/Temp/claude/c--Users-Admin-Desktop-HomebankingMonix/9c214aab-b033-41f2-8676-3406c448fa84/scratchpad/capturas'
const stamp = Date.now()
const email = `demo.${stamp}@monix.test`
const password = 'Demo-monix-2026'
const dni = String(Math.floor(10000000 + Math.random() * 89999999))

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await context.addInitScript(() => {
  localStorage.setItem('monix_permisos_ok', '1')
  localStorage.setItem('monix-theme', JSON.stringify({ state: { theme: 'dark' }, version: 0 }))
})
const page = await context.newPage()
const log = (m) => console.log(m)
const shot = async (name) => { await page.waitForTimeout(900); await page.screenshot({ path: `${OUT}/${name}.png` }); log('OK ' + name) }
const closeTour = async () => {
  for (const t of ['Omitir', 'Saltar', 'Cerrar']) {
    const b = page.locator(`button:has-text("${t}")`).first()
    if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await page.waitForTimeout(400) }
  }
}

// Landing y login (sin sesión)
await page.goto(BASE + '/', { waitUntil: 'networkidle' }); await shot('01-landing')
await page.goto(BASE + '/login', { waitUntil: 'networkidle' }); await shot('02-login')

// Registro guiado
await page.goto(BASE + '/register', { waitUntil: 'networkidle' }); await shot('03-registro-paso1')
await page.fill('input[name="email"]', email)
await page.fill('input[name="password"]', password)
await page.click('button[type="submit"]')
await page.waitForTimeout(600)
await page.fill('input[name="nombre"]', 'Lucía')
await page.fill('input[name="apellido"]', 'Demo')
await page.fill('input[name="dni"]', dni)
await shot('04-registro-paso2')
await page.fill('input[name="telefono"]', '1122334455')
const fecha = page.locator('input[type="date"]').first()
if (await fecha.count()) await fecha.fill('1995-04-12').catch(() => {})
await page.fill('input[name="direccion"]', 'Av. Corrientes 1234')
await page.click('button[type="submit"]')
await page.waitForTimeout(600)
await page.locator('input[type="checkbox"]').first().check().catch(() => {})
await shot('05-registro-terminos')
await page.click('button[type="submit"]')
await page.waitForURL('**/dashboard', { timeout: 30000 }).catch(() => log('no llegó a dashboard'))
await page.waitForTimeout(2500)
await closeTour()
await page.waitForTimeout(500)
await shot('06-dashboard')

// Pantallas del menú
const rutas = [
  ['cuentas', 'cuentas'], ['dolares', 'dolares'], ['transferir', 'transferir'], ['metas', 'metas'],
  ['historial', 'historial'], ['depositar', 'depositar'], ['tarjeta', 'tarjeta'], ['reservas', 'reservas'],
  ['promos', 'promos'], ['cashback', 'cashback'], ['prestamos', 'prestamos'], ['mercado-monix', 'mercado-monix'],
  ['perfil', 'perfil'], ['contactos', 'contactos'],
]
for (const [ruta, nombre] of rutas) {
  try {
    await page.goto(BASE + '/' + ruta, { waitUntil: 'networkidle' })
    await closeTour()
    await shot('pantalla-' + nombre)
  } catch (e) { log('FALLO ' + ruta + ': ' + e.message.slice(0, 120)) }
}

// Préstamos: simulador scrolleado
try {
  await page.goto(BASE + '/prestamos', { waitUntil: 'networkidle' })
  await page.evaluate(() => window.scrollTo(0, 700))
  await shot('pantalla-prestamos-simulador')
} catch (e) { log('FALLO prestamos scroll: ' + e.message.slice(0, 120)) }

// QR: botón de escanear/cobrar del navbar
try {
  await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' })
  await closeTour()
  await page.locator('[aria-label="Escanear QR para pagar"]').first().click()
  await shot('qr-overlay-inicio')
  for (const t of ['Tu QR', 'Generar QR', 'Cobrar']) {
    const b = page.locator(`button:has-text("${t}"), [role="tab"]:has-text("${t}")`).first()
    if (await b.isVisible().catch(() => false)) { await b.click(); await page.waitForTimeout(1500); await shot('qr-tu-qr-' + t.toLowerCase().replace(/\s/g, '-')); break }
  }
} catch (e) { log('FALLO QR: ' + e.message.slice(0, 160)) }

await browser.close()
log('email de prueba: ' + email)
