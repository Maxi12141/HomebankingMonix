import { chromium } from 'playwright'
const BASE = 'http://localhost:5173'
const OUT = 'C:/Users/Admin/AppData/Local/Temp/claude/c--Users-Admin-Desktop-HomebankingMonix/9c214aab-b033-41f2-8676-3406c448fa84/scratchpad/capturas'
const email = 'demo.1793049681664@monix.test', password = 'Demo-monix-2026'
const browser = await chromium.launch()
const init = () => {
  localStorage.setItem('monix_permisos_ok', '1')
  localStorage.setItem('monix-theme', JSON.stringify({ state: { theme: 'dark' }, version: 0 }))
}
const log = (m) => console.log(m)
let page
const shot = async (name) => { await page.waitForTimeout(900); await page.screenshot({ path: `${OUT}/${name}.png` }); log('OK ' + name) }
const el = async (sel, name) => { try { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await page.waitForTimeout(500); await l.screenshot({ path: `${OUT}/card-${name}.png` }); log('OK card-' + name) } catch (e) { log('FALLO card-' + name + ': ' + e.message.slice(0, 90)) } }
const click = async (t, ms = 800) => { const b = page.locator(`button:has-text("${t}")`).first(); if (await b.isVisible().catch(() => false)) { await b.click(); await page.waitForTimeout(ms); return true } return false }
const botones = async () => (await page.locator('button:visible').allInnerTexts()).map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean)
const dismiss = async () => { for (const t of ['Ahora no', 'Omitir', 'Entendido']) await click(t, 500) }

// Sin sesión: landing (varias alturas) y registro
const anon = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await anon.addInitScript(init)
page = await anon.newPage()
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForFunction(() => document.body.innerText.length > 200, null, { timeout: 25000 }).catch(() => log('landing sin texto'))
await page.waitForTimeout(2500)
await shot('01-landing')
await page.evaluate(() => window.scrollTo(0, 844)); await shot('01b-landing')
await page.evaluate(() => window.scrollTo(0, 1700)); await shot('01c-landing')
await page.goto(BASE + '/register', { waitUntil: 'networkidle' })
await page.waitForSelector('input[name="email"]', { timeout: 25000 }); await shot('03-registro-paso1')
await anon.close()

// Con sesión
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await ctx.addInitScript(init)
page = await ctx.newPage()
await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
await page.waitForSelector('input[type="email"]', { timeout: 25000 })
await page.fill('input[type="email"]', email); await page.locator('button[type="submit"]').first().click()
await page.waitForSelector('input[type="password"]', { timeout: 15000 })
await page.fill('input[type="password"]', password); await page.locator('button[type="submit"]').first().click()
await page.waitForTimeout(4000); await dismiss()
await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' }); await page.waitForTimeout(2000); await dismiss()
const ojo = page.locator('[aria-label="Mostrar saldo"]').first()
if (await ojo.isVisible().catch(() => false)) { await ojo.click(); await page.waitForTimeout(1800) }
await shot('06-dashboard')
await el('#tour-saldo', 'saldo')
await el('#tour-reservas', 'reservas')
await page.evaluate(() => window.scrollTo(0, 900)); await shot('06b-dashboard-abajo')

// QR interbancario: generar
await page.evaluate(() => window.scrollTo(0, 0))
await page.locator('[aria-label="Escanear QR para pagar"]').first().click({ timeout: 10000 })
await page.waitForTimeout(1200)
await click('Generar QR', 2500)
await shot('qr-generar')
log('qr botones: ' + JSON.stringify(await botones()))
const montoQr = page.locator('input:visible').first()
if (await montoQr.isVisible().catch(() => false)) { await montoQr.fill('12500').catch(() => {}); await page.waitForTimeout(600); await shot('qr-generar-monto'); log('qr botones 2: ' + JSON.stringify(await botones())) }
for (const t of ['Generar', 'Crear QR', 'Listo', 'Confirmar']) { if (await click(t, 3000)) { await shot('qr-generado'); break } }
await page.keyboard.press('Escape').catch(() => {})

// Metas sin el cartel de ayuda
await page.goto(BASE + '/metas', { waitUntil: 'networkidle' }); await page.waitForTimeout(1500); await click('Entendido'); await shot('pantalla-metas')
log('metas botones: ' + JSON.stringify(await botones()))

// Dólares: abrir la cuenta
await page.goto(BASE + '/cuentas', { waitUntil: 'networkidle' }); await page.waitForTimeout(1200)
await click('Solicitar cuenta en dólares', 4000)
log('cuentas botones: ' + JSON.stringify(await botones()))
await shot('pantalla-cuentas-usd')
await page.goto(BASE + '/dolares', { waitUntil: 'networkidle' }); await page.waitForTimeout(2500); await shot('pantalla-dolares')

// Moni
await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' }); await page.waitForTimeout(1500); await dismiss()
const bot = page.locator('[aria-label*="Moni"], [aria-label*="asistente"], [aria-label*="Asistente"]').first()
if (await bot.isVisible().catch(() => false)) {
  await bot.click(); await page.waitForTimeout(1200)
  const inp = page.locator('input:visible, textarea:visible').last()
  await inp.fill('¿Cuánto saldo tengo?').catch(() => {}); await page.keyboard.press('Enter'); await page.waitForTimeout(2500)
  await shot('moni')
} else log('no encontré el botón de Moni')

// Tarjeta, préstamos y transferir como cards
await page.goto(BASE + '/tarjeta', { waitUntil: 'networkidle' }); await page.waitForTimeout(1500); await el('main .rounded-2xl', 'tarjeta')
await page.goto(BASE + '/prestamos', { waitUntil: 'networkidle' })
await page.waitForFunction(() => !document.body.innerText.includes('Consultando tu situación'), null, { timeout: 30000 }).catch(() => {})
await page.locator('main input').first().fill('500000'); await click('6 cuotas', 800)
await shot('pantalla-prestamos-simulador')
await click('Ver esquema de pago mes a mes', 1500); await shot('pantalla-prestamos-esquema')
await browser.close()
