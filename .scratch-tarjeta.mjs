import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const email = 'diag.1789738565873@monix.test'
const password = 'testtest123'

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
await context.addInitScript(() => localStorage.setItem('monix_permisos_ok', '1'))
const page = await context.newPage()
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.fill('input[type="email"]', email)
await page.click('button:has-text("Continuar")')
await page.waitForTimeout(500)
await page.fill('input[type="password"]', password)
await page.click('button:has-text("Iniciar sesión")')
await page.waitForURL('**/dashboard', { timeout: 15000 })
await page.waitForTimeout(1000)

await page.goto(`${BASE}/tarjeta`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
await page.screenshot({ path: '.scratch-tarjeta-mobile.png', clip: { x: 0, y: 0, width: 375, height: 500 } })

const box = await page.locator('button:has-text("Dorso"), button:has-text("Frente")').boundingBox()
console.log('boton flip box:', box)
const title = await page.locator('text=Tu tarjeta débito').boundingBox()
console.log('titulo box:', title)
const subtitle = await page.locator('text=/Mové el cursor/').boundingBox()
console.log('subtitulo box:', subtitle)

await browser.close()
