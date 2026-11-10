// Saca las capturas de la app que usa /presentacion, desde la cuenta de prueba y en modo
// oscuro, a 3x para que se vean nítidas en el proyector. Esconde lo que sólo existe en la
// prueba (el sello "Prueba", el aviso del banco de prueba y "Simular un mes").
//
// Uso: con la app corriendo (npm run dev), `node scripts/capturas-presentacion.cjs [url]`.
// Por defecto usa http://localhost:5173. Guarda en public/presentacion/.

const path = require('path')
const fs = require('fs')
const { chromium } = require('playwright')

const BASE = process.argv[2] || 'http://localhost:5173'
const DESTINO = path.join(__dirname, '..', 'public', 'presentacion')

function limpiar(page) {
  return page.evaluate(() => {
    window.scrollTo(0, 0)
    const todos = [...document.querySelectorAll('body *')]
    for (const el of todos) {
      const t = el.textContent.trim()
      if (el.children.length === 0 && t.toLowerCase() === 'prueba') el.style.display = 'none'
      if (el.children.length === 0 && t.startsWith('Estás en el banco de prueba')) el.style.display = 'none'
    }
    // La tarjeta de "Simular un mes": el elemento más chico que tiene el texto y el botón.
    const sim = todos
      .filter((el) => el.textContent.includes('Mirá cómo se acreditan') && el.textContent.includes('Simular un mes'))
      .sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length)[0]
    if (sim) sim.style.display = 'none'
  })
}

;(async () => {
  fs.mkdirSync(DESTINO, { recursive: true })
  const navegador = await chromium.launch()
  const opciones = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
  const tema = () => localStorage.setItem('monix-theme', JSON.stringify({ state: { theme: 'dark' }, version: 0 }))

  const guardar = (page, nombre) => page.screenshot({ path: path.join(DESTINO, `${nombre}.jpg`), type: 'jpeg', quality: 88 })

  // Registro: sin sesión.
  const publico = await (await navegador.newContext(opciones)).newPage()
  await publico.addInitScript(tema)
  await publico.goto(`${BASE}/register`)
  await publico.waitForTimeout(3500)
  await guardar(publico, 'registro')

  // Cuenta de prueba: se cierra la bienvenida y el tour antes de sacar nada.
  const page = await (await navegador.newContext(opciones)).newPage()
  await page.addInitScript(tema)
  await page.goto(`${BASE}/prueba`)
  await page.waitForTimeout(5000)
  await page.getByText('Ver cómo funciona').click().catch(() => {})
  await page.waitForTimeout(1500)
  const omitir = page.getByRole('button', { name: 'Omitir' })
  if (await omitir.count()) await omitir.first().click()
  await page.waitForTimeout(3000)
  await limpiar(page)
  await page.waitForTimeout(300)
  await guardar(page, 'inicio')

  const pantallas = [
    { ruta: 'reservas', espera: 5000 },
    { ruta: 'dolares', espera: 9000, antes: async () => { await page.locator('input').first().fill('100') } },
    { ruta: 'prestamos', espera: 6000, antes: async () => { await page.locator('input').first().fill('500000') } },
    { ruta: 'gastos', espera: 5000 },
  ]
  for (const { ruta, espera, antes } of pantallas) {
    await page.goto(`${BASE}/${ruta}`)
    await page.waitForTimeout(espera)
    if (antes) { await antes(); await page.waitForTimeout(1500) }
    await limpiar(page)
    await page.waitForTimeout(300)
    await guardar(page, ruta)
  }

  await navegador.close()
  console.log('Capturas en', DESTINO)
})()
