import { chromium } from 'playwright'
const BASE = 'http://localhost:5173'
const OUT = 'C:/Users/Admin/AppData/Local/Temp/claude/c--Users-Admin-Desktop-HomebankingMonix/9c214aab-b033-41f2-8676-3406c448fa84/scratchpad/capturas'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await ctx.addInitScript(() => { localStorage.setItem('monix_permisos_ok', '1'); localStorage.setItem('monix-theme', JSON.stringify({ state: { theme: 'dark' }, version: 0 })) })
const page = await ctx.newPage()
const log = (m) => console.log(m)
const shot = async (n) => { await page.waitForTimeout(900); await page.screenshot({ path: `${OUT}/${n}.png` }); log('OK ' + n) }
const click = async (t, ms = 800) => { const b = page.locator(`button:has-text("${t}")`).first(); if (await b.isVisible().catch(() => false)) { await b.click(); await page.waitForTimeout(ms); return true } return false }
await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
await page.waitForSelector('input[type="email"]', { timeout: 25000 })
await page.fill('input[type="email"]', 'demo.1793049681664@monix.test'); await page.locator('button[type="submit"]').first().click()
await page.waitForSelector('input[type="password"]', { timeout: 15000 })
await page.fill('input[type="password"]', 'Demo-monix-2026'); await page.locator('button[type="submit"]').first().click()
await page.waitForTimeout(4000); await click('Ahora no')
await page.goto(BASE + '/cuentas', { waitUntil: 'networkidle' }); await page.waitForTimeout(1200)
await click('Solicitar cuenta en dólares', 1000); await shot('cuentas-usd-confirmar')
await click('Continuar', 6000)
await page.goto(BASE + '/cuentas', { waitUntil: 'networkidle' }); await page.waitForTimeout(2000); await shot('pantalla-cuentas')
await page.goto(BASE + '/dolares', { waitUntil: 'networkidle' }); await page.waitForTimeout(3000); await shot('pantalla-dolares')
const m = page.locator('main input:visible').first()
if (await m.isVisible().catch(() => false)) { await m.fill('100'); await page.waitForTimeout(1200); await shot('pantalla-dolares-monto') }
log((await page.locator('button:visible').allInnerTexts()).join(' | ').replace(/\s+/g, ' '))
await browser.close()
