import { chromium } from 'playwright'
import fs from 'fs'
// Captura el simulador de préstamos como lo ve un cliente en situación 1 (normal) para la diapo de venta.
const BASE = 'https://monix-homebanking.vercel.app'
const S = 'C:/Users/Admin/AppData/Local/Temp/claude/c--Users-Admin-Desktop-HomebankingMonix/9c214aab-b033-41f2-8676-3406c448fa84/scratchpad'
const email = 'demo.1793049681664@monix.test', password = 'Demo-monix-2026'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await ctx.addInitScript(() => {
  localStorage.setItem('monix_permisos_ok', '1')
  localStorage.setItem('monix-theme', JSON.stringify({ state: { theme: 'dark' }, version: 0 }))
})
await ctx.route('**/central-deudores/**', async (route) => {
  if (route.request().method() !== 'GET') return route.continue()
  const dni = route.request().url().split('/').pop()
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ dni, situacion: 1, deudas: [] }) })
})
const page = await ctx.newPage()
const click = async (t, ms = 800) => { const b = page.locator(`button:has-text("${t}")`).first(); if (await b.isVisible().catch(() => false)) { await b.click(); await page.waitForTimeout(ms); return true } return false }
const dismiss = async () => { for (const t of ['Ahora no', 'Omitir', 'Entendido']) await click(t, 500) }
await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
await page.waitForSelector('input[type="email"]', { timeout: 25000 })
await page.fill('input[type="email"]', email); await page.locator('button[type="submit"]').first().click()
await page.waitForSelector('input[type="password"]', { timeout: 15000 })
await page.fill('input[type="password"]', password); await page.locator('button[type="submit"]').first().click()
await page.waitForTimeout(5000); await dismiss()
await page.goto(BASE + '/prestamos', { waitUntil: 'networkidle' })
await page.waitForFunction(() => !document.body.innerText.includes('Consultando tu situación'), null, { timeout: 30000 }).catch(() => {})
await page.waitForTimeout(1000); await dismiss()
await page.locator('main input').first().fill('500000'); await click('6 cuotas', 1200)
await page.evaluate(() => { for (const e of document.querySelectorAll('body *')) if (getComputedStyle(e).position === 'fixed') e.style.visibility = 'hidden' }); await page.waitForTimeout(300)
const src = `${S}/capturas/pantalla-prestamos-simulador-normal.png`
await page.screenshot({ path: src })
console.log((await page.locator('main').innerText()).slice(0, 700))
const p = await browser.newPage({ viewport: { width: 780, height: 1688 } })
await p.setContent(`<body style="margin:0"><img src="data:image/png;base64,${fs.readFileSync(src).toString('base64')}" style="display:block">`)
await p.screenshot({ path: `${S}/deck-assets/crop-prestamo-normal.png`, clip: { x: 0, y: 396, width: 780, height: 1212 } })
await browser.close(); console.log('ok')
