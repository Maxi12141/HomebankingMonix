// Prueba visual del re-plan de marca con Playwright, sin tocar Supabase ni el
// Banco Central reales: los dos se simulan con page.route y la sesión se
// inyecta en localStorage. Uso: npm run test:e2e  (capturas en tests/e2e/screens)
import { createServer } from 'vite'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SUPABASE = 'http://mock.supabase.local'
const BC = 'http://mock.bc.local'
process.env.VITE_SUPABASE_URL = SUPABASE
process.env.VITE_SUPABASE_ANON_KEY = 'anon-test-key'
process.env.VITE_BC_URL = BC
process.env.VITE_BC_API_KEY = 'test'

const SCREENS = fileURLToPath(new URL('./screens/', import.meta.url))
mkdirSync(SCREENS, { recursive: true })

// ── Datos de ejemplo ────────────────────────────────────────────────────────
const UID = '11111111-1111-4111-8111-111111111111'
const ahora = new Date().toISOString()
const persona = {
  id: UID, nombre: 'Sol', apellido: 'Río', dni: '30111222', direccion: null, email: 'sol@monix.test',
  telefono: null, fecha_nac: null, sueldo_acreditado: false, ingreso_mensual: 900000,
  situacion_crediticia_monix: 1, situacion_informada_at: null, created_at: ahora,
}
const cuenta = {
  id: 'c-ars', persona_id: UID, numero_cuenta: '0004-1187', tipo: 'caja_ahorro', moneda: 'ARS',
  saldo: 150000, activa: true, tarjeta_congelada: false, cbu: '0000003100047711870012',
  alias: 'sol.rio.monix', tasa_anual: 32, ultima_interes_at: ahora, created_at: ahora,
}
const mov = (id, tipo, monto, desc) => ({
  id, cuenta_id: 'c-ars', tipo, moneda: 'ARS', monto, saldo_resultante: null, descripcion: desc,
  cuenta_destino_id: null, destinatario_nombre: 'Juan', destinatario_apellido: 'Pérez', destinatario_dni: null,
  destino_cbu: null, destino_alias: null, bc_transaccion_id: null, banco_codigo_origen: null, created_at: ahora,
})
const tablas = {
  personas: [persona],
  cuentas: [cuenta],
  movimientos: [
    mov('m1', 'deposito', 25000, 'Depósito en efectivo'),
    mov('m2', 'transferencia_salida', 8000, 'Alquiler'),
    mov('m3', 'transferencia_entrada', 12500, 'Varios'),
  ],
}

function fakeJwt() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const exp = Math.floor(Date.now() / 1000) + 3600
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, exp, role: 'authenticated', email: persona.email })}.firma`
}
const user = { id: UID, email: persona.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: ahora }
const session = {
  access_token: fakeJwt(), token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'refresh-test', user,
}

// ── Mocks de red ────────────────────────────────────────────────────────────
async function mockear(page, { demoraCuentasMs = 0, rpcFalla = false } = {}) {
  await page.route(`${BC}/**`, (r) => r.fulfill({ json: [] }))
  await page.route(`${SUPABASE}/auth/v1/**`, (r) =>
    r.fulfill({ json: r.request().url().includes('/user') ? user : session }))
  await page.route(`${SUPABASE}/rest/v1/**`, async (r) => {
    const url = new URL(r.request().url())
    const [, , , recurso, fn] = url.pathname.split('/')
    if (recurso === 'rpc') {
      if (fn === 'depositar_en_cuenta') {
        return rpcFalla ? r.fulfill({ status: 500, json: {} }) : r.fulfill({ json: cuenta.saldo + 5000 })
      }
      return r.fulfill({ json: null })
    }
    if (r.request().method() !== 'GET') return r.fulfill({ status: 201, json: [] })
    if (recurso === 'cuentas' && demoraCuentasMs) await new Promise((res) => setTimeout(res, demoraCuentasMs))
    let filas = tablas[recurso] ?? []
    for (const [k, v] of url.searchParams) {
      if (v.startsWith('eq.')) filas = filas.filter((f) => !(k in f) || String(f[k]) === v.slice(3))
    }
    const objeto = (r.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')
    return r.fulfill({ json: objeto ? (filas[0] ?? null) : filas, headers: { 'content-range': `0-${filas.length}/${filas.length}` } })
  })
}

async function nuevaPagina(browser, { logueado = true, oscuro = false, ancho = 390, alto = 844, reducedMotion = 'no-preference', ...mocks } = {}) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, reducedMotion })
  await ctx.addInitScript(([s, logueado, oscuro]) => {
    localStorage.setItem('monix_mostrar_saldo', '1')
    localStorage.setItem('monix-theme', JSON.stringify({ state: { theme: oscuro ? 'dark' : 'light' }, version: 0 }))
    if (logueado) localStorage.setItem('sb-mock-auth-token', JSON.stringify(s))
  }, [session, logueado, oscuro])
  const page = await ctx.newPage()
  await mockear(page, mocks)
  return page
}

const color = (loc) => loc.evaluate((el) => getComputedStyle(el).color)
async function pasarLoader(page) {
  await page.waitForSelector('[aria-label="Cargando Monix"]', { state: 'detached', timeout: 10000 })
}

// ── Pruebas ────────────────────────────────────────────────────────────────
const pruebas = []
const prueba = (nombre, fn) => pruebas.push({ nombre, fn })

prueba('Loader: anima con los tiempos de After Effects', async (b) => {
  const page = await nuevaPagina(b, { logueado: false })
  await page.goto('/')
  const barrido = page.locator('.loader-barrido')
  const anim = await barrido.evaluate((el) => {
    const s = getComputedStyle(el)
    return { name: s.animationName, dur: s.animationDuration, it: s.animationIterationCount, delay: s.animationDelay }
  })
  assert.deepEqual(anim, { name: 'loader-arco', dur: '1.8s', it: 'infinite', delay: '0.55s' })
  const piezas = await page.locator('.loader-pieza').evaluateAll((els) => els.map((e) => getComputedStyle(e).animationDelay))
  assert.deepEqual(piezas, ['0.15s', '0.23s', '0.31s'])
  for (const [i, t] of [[0, 300], [1, 1250], [2, 2050]]) {
    await page.waitForTimeout(i === 0 ? t : t - [300, 1250][i - 1])
    await page.locator('svg').first().screenshot({ path: `${SCREENS}loader-${i}.png` })
  }
  await page.context().close()
})

prueba('Loader: con "reducir movimiento" queda quieto y completo', async (b) => {
  const page = await nuevaPagina(b, { logueado: false, reducedMotion: 'reduce' })
  await page.goto('/')
  const s = await page.locator('.loader-barrido').evaluate((el) => {
    const c = getComputedStyle(el)
    return { name: c.animationName, transform: c.transform }
  })
  assert.equal(s.name, 'none')
  assert.match(s.transform, /matrix\(1, 0, 0, 1, 320, 0\)/)
  await page.context().close()
})

prueba('Button: foco visible al navegar con Tab', async (b) => {
  const page = await nuevaPagina(b, { logueado: false })
  await page.goto('/login')
  await pasarLoader(page)
  const boton = page.getByRole('button', { name: 'Continuar' })
  await boton.waitFor()
  await page.locator('input').first().focus()
  for (let i = 0; i < 12 && !(await boton.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab')
  const o = await boton.evaluate((el) => ({ s: getComputedStyle(el).outlineStyle, w: getComputedStyle(el).outlineWidth, f: el.matches(':focus-visible') }))
  assert.deepEqual(o, { s: 'solid', w: '2px', f: true })
  await boton.screenshot({ path: `${SCREENS}boton-foco.png` })
  await page.context().close()
})

prueba('Dashboard: esqueleto mientras carga el saldo', async (b) => {
  const page = await nuevaPagina(b, { demoraCuentasMs: 5000 })
  await page.goto('/dashboard')
  await pasarLoader(page)
  const esqueleto = page.getByRole('status', { name: 'Cargando tu saldo' })
  await esqueleto.waitFor({ timeout: 5000 })
  await page.screenshot({ path: `${SCREENS}dashboard-cargando.png` })
  await esqueleto.waitFor({ state: 'detached', timeout: 10000 })
  await page.context().close()
})

prueba('Dashboard (claro): montos en mint tinta, negativos en rojo legible', async (b) => {
  const page = await nuevaPagina(b)
  await page.goto('/dashboard')
  await pasarLoader(page)
  const saldo = page.locator('#tour-saldo p.font-display').first()
  await saldo.waitFor()
  assert.equal(await color(saldo), 'rgb(0, 168, 122)')
  const entrada = page.getByText(/^\+\$\s?25\.000/).first()
  const salida = page.getByText(/^-\$\s?8\.000/).first()
  assert.equal(await color(entrada), 'rgb(0, 122, 90)')
  assert.equal(await color(salida), 'rgb(220, 38, 38)')
  await page.waitForTimeout(1300) // que termine de contar el saldo
  await page.screenshot({ path: `${SCREENS}dashboard-claro.png`, fullPage: true })
  await page.context().close()
})

prueba('Dashboard (oscuro): montos en mint', async (b) => {
  const page = await nuevaPagina(b, { oscuro: true })
  await page.goto('/dashboard')
  await pasarLoader(page)
  const saldo = page.locator('#tour-saldo p.font-display').first()
  await saldo.waitFor()
  assert.equal(await color(saldo), 'rgb(38, 255, 193)')
  await page.waitForTimeout(1300)
  await page.screenshot({ path: `${SCREENS}dashboard-oscuro.png`, fullPage: true })
  await page.context().close()
})

prueba('Card de movimiento: se abre con Tab + Enter', async (b) => {
  const page = await nuevaPagina(b)
  await page.goto('/dashboard')
  await pasarLoader(page)
  const fila = page.locator('[role="button"][tabindex="0"]').filter({ hasText: 'Alquiler' })
  await fila.focus()
  assert.equal(await fila.evaluate((el) => getComputedStyle(el).outlineStyle), 'solid')
  await page.keyboard.press('Enter')
  const montoModal = page.locator('p.text-3xl').filter({ hasText: '8.000' })
  await montoModal.waitFor({ timeout: 4000 })
  assert.equal(await color(montoModal), 'rgb(220, 38, 38)')
  await page.screenshot({ path: `${SCREENS}detalle-movimiento.png` })
  await page.context().close()
})

prueba('Depositar: éxito con check mint sobre azul noche', async (b) => {
  const page = await nuevaPagina(b)
  await page.goto('/depositar')
  await pasarLoader(page)
  await page.getByPlaceholder('0.00').fill('5000')
  await page.getByRole('button', { name: /depositar/i }).last().click()
  await page.getByText('¡Depósito exitoso!').waitFor({ timeout: 5000 })
  const icono = page.locator('span.bg-navy.rounded-full').first()
  assert.equal(await icono.evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(0, 26, 61)')
  assert.equal(await icono.locator('svg').evaluate((el) => getComputedStyle(el).color), 'rgb(38, 255, 193)')
  await page.screenshot({ path: `${SCREENS}deposito-exito.png` })
  await page.context().close()
})

prueba('Depositar: error con el tono del manual', async (b) => {
  const page = await nuevaPagina(b, { rpcFalla: true })
  await page.goto('/depositar')
  await pasarLoader(page)
  await page.getByPlaceholder('0.00').fill('5000')
  await page.getByRole('button', { name: /depositar/i }).last().click()
  await page.getByText(/^No pudimos acreditar el depósito. Tu plata no se movió/).first().waitFor({ timeout: 5000 })
  await page.screenshot({ path: `${SCREENS}deposito-error.png` })
  await page.context().close()
})

const pantallas = ['/dashboard', '/historial', '/tarjeta', '/depositar', '/transferir', '/cuentas', '/prestamos', '/reservas', '/mercado-monix']

prueba('Ningún texto visible por debajo de 11 px', async (b) => {
  const page = await nuevaPagina(b)
  const chicos = []
  for (const ruta of pantallas) {
    await page.goto(ruta)
    await pasarLoader(page)
    await page.waitForTimeout(600)
    const encontrados = await page.evaluate(() => {
      const out = []
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      while (walker.nextNode()) {
        const n = walker.currentNode
        if (!n.textContent.trim() || !n.parentElement) continue
        const el = n.parentElement
        if (el.closest('svg,[aria-hidden="true"]')) continue
        const r = el.getBoundingClientRect()
        if (!r.width || !r.height) continue
        const fs = parseFloat(getComputedStyle(el).fontSize)
        if (fs < 11) out.push(`${fs}px "${n.textContent.trim().slice(0, 30)}"`)
      }
      return out
    })
    chicos.push(...encontrados.map((e) => `${ruta}: ${e}`))
  }
  assert.deepEqual(chicos, [])
  await page.context().close()
})

prueba('Sin scroll horizontal a 320 px', async (b) => {
  const page = await nuevaPagina(b, { ancho: 320, alto: 640 })
  const desbordes = []
  for (const ruta of pantallas) {
    await page.goto(ruta)
    await pasarLoader(page)
    await page.waitForTimeout(600)
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
    if (sw > cw) desbordes.push(`${ruta}: ${sw} > ${cw}`)
    await page.screenshot({ path: `${SCREENS}320${ruta.replace(/\//g, '-')}.png` })
  }
  assert.deepEqual(desbordes, [])
  await page.context().close()
})

// ── Runner ──────────────────────────────────────────────────────────────────
const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' })
await server.listen()
const browser = await chromium.launch()
const base = 'http://localhost:5199'
const origNewContext = browser.newContext.bind(browser)
browser.newContext = (opts = {}) => origNewContext({ baseURL: base, ...opts })

let fallas = 0
for (const { nombre, fn } of pruebas) {
  const t0 = Date.now()
  try {
    await fn(browser)
    console.log(`✓ ${nombre} (${Date.now() - t0} ms)`)
  } catch (e) {
    fallas++
    console.log(`✗ ${nombre}\n  ${String(e.message ?? e).split('\n').join('\n  ')}`)
  }
}
await browser.close()
await server.close()
console.log(`\n${pruebas.length - fallas}/${pruebas.length} pruebas pasaron. Capturas en tests/e2e/screens/`)
process.exit(fallas ? 1 : 0)
