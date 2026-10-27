import { chromium } from 'playwright'
const BASE = 'http://localhost:5173'
const OUT = 'C:/Users/Admin/AppData/Local/Temp/claude/c--Users-Admin-Desktop-HomebankingMonix/9c214aab-b033-41f2-8676-3406c448fa84/scratchpad/capturas'
const email = 'demo.1793049681664@monix.test', password = 'Demo-monix-2026'
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await context.addInitScript(() => {
  localStorage.setItem('monix_permisos_ok', '1')
  localStorage.setItem('monix-theme', JSON.stringify({ state: { theme: 'dark' }, version: 0 }))
})
const page = await context.newPage()
const log = (m) => console.log(m)
const shot = async (name) => { await page.waitForTimeout(900); await page.screenshot({ path: `${OUT}/${name}.png` }); log('OK ' + name) }
const dismiss = async () => {
  for (const t of ['Ahora no', 'Omitir', 'Saltar']) {
    const b = page.locator(`button:has-text("${t}")`).first()
    if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await page.waitForTimeout(500) }
  }
}
const botones = async () => (await page.locator('button:visible').allInnerTexts()).map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean)

await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
await page.waitForSelector('input[type="email"]', { timeout: 25000 })
await page.waitForTimeout(800); await shot('02-login')
await page.fill('input[type="email"]', email)
await page.locator('button[type="submit"]').first().click()
await page.waitForSelector('input[type="password"]', { timeout: 15000 })
await page.waitForTimeout(500); await shot('02b-login-password')
await page.fill('input[type="password"]', password)
await page.locator('button[type="submit"]').first().click()
await page.waitForURL('**/dashboard', { timeout: 30000 }).catch(() => log('no llegó a dashboard'))
await page.waitForTimeout(2500)
await dismiss(); await page.waitForTimeout(800); await dismiss()
await shot('06-dashboard')
log('dashboard botones: ' + JSON.stringify(await botones()))

// Préstamos con oferta cargada
await page.goto(BASE + '/prestamos', { waitUntil: 'networkidle' })
await page.waitForFunction(() => !document.body.innerText.includes('Consultando tu situación'), null, { timeout: 30000 }).catch(() => log('préstamos sigue consultando'))
await page.waitForTimeout(1000)
await shot('pantalla-prestamos')
const monto = page.locator('main input').first()
await monto.click().catch(() => {}); await monto.fill('500000').catch(e => log('monto: ' + e.message.slice(0, 80)))
await page.waitForTimeout(500)
log('prestamos botones: ' + JSON.stringify(await botones()))
const plazo = page.locator('button').filter({ hasText: /\b(12|6)\b/ }).first()
if (await plazo.isVisible().catch(() => false)) await plazo.click()
await page.waitForTimeout(800)
await shot('pantalla-prestamos-simulador')
await page.evaluate(() => window.scrollTo(0, 600)); await shot('pantalla-prestamos-simulador-abajo')

// QR
await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500); await dismiss()
await page.locator('[aria-label="Escanear QR para pagar"]').first().click({ timeout: 10000 }).catch(e => log('fab: ' + e.message.slice(0, 100)))
await page.waitForTimeout(1500)
await shot('qr-overlay')
log('qr botones: ' + JSON.stringify(await botones()))
await browser.close()
