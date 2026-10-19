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
async function mockear(page, { demoraCuentasMs = 0, rpcFalla = false, cuentasExtra = [] } = {}) {
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
    let filas = recurso === 'cuentas' ? [...tablas.cuentas, ...cuentasExtra] : tablas[recurso] ?? []
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

prueba('Saldo: cuenta desde 0 una sola vez por sesión', async (b) => {
  const page = await nuevaPagina(b)
  const saldo = page.locator('#tour-saldo p.font-display').first()
  const FINAL = /150\.000,00/
  await page.goto('/dashboard')
  await pasarLoader(page)
  await saldo.waitFor()
  assert.doesNotMatch(await saldo.innerText(), FINAL, 'la primera vez debería estar contando')
  await page.waitForTimeout(1300)
  assert.match(await saldo.innerText(), FINAL)
  // Volver al Dashboard (y recargar) no repite la animación.
  for (const ruta of ['/historial', '/dashboard']) await page.goto(ruta)
  await pasarLoader(page)
  await saldo.waitFor()
  assert.match(await saldo.innerText(), FINAL, 'al volver debería aparecer directo')
  // Cerrar sesión borra la marca.
  await page.evaluate(async () => {
    const { useAuthStore } = await import('/src/store/authStore.ts')
    useAuthStore.getState().clear()
  })
  assert.equal(await page.evaluate(() => sessionStorage.getItem('monix_saldo_animado')), null)
  await page.context().close()
})

prueba('Saldo: no vuelve a contar al ocultarlo y mostrarlo ni al cambiar de cuenta', async (b) => {
  const usd = { ...cuenta, id: 'c-usd', moneda: 'USD', saldo: 1200, cbu: '0000003100047711870099', alias: 'sol.rio.usd' }
  const page = await nuevaPagina(b, { cuentasExtra: [usd] })
  const saldo = page.locator('#tour-saldo p.font-display').first()
  await page.goto('/dashboard')
  await pasarLoader(page)
  await saldo.waitFor()
  await page.waitForTimeout(1300) // termina la única animación de la sesión
  const sinContar = async (prefijo, esperado, paso) => {
    // La card que sale se ve 0,22 s: se espera a que aparezca la nueva (por su moneda).
    await page.waitForFunction((p) => document.querySelector('#tour-saldo p.font-display')?.textContent?.startsWith(p), prefijo)
    // Apenas aparece ya muestra el valor final y se queda ahí: no cuenta desde 0.
    for (let i = 0; i < 5; i++) {
      assert.equal(await saldo.innerText(), esperado, `${paso}: volvió a contar`)
      await page.waitForTimeout(60)
    }
  }
  await page.getByRole('button', { name: 'Ocultar saldo' }).click()
  await page.getByRole('button', { name: 'Mostrar saldo' }).click()
  await sinContar('$ ', '$ 150.000,00', 'ojito')
  await page.getByRole('button', { name: 'Ver la otra cuenta' }).first().click()
  await sinContar('US$', 'US$1,200.00', 'cambio a dólares')
  await page.getByRole('button', { name: 'Ver la otra cuenta' }).first().click()
  await sinContar('$ ', '$ 150.000,00', 'vuelta a pesos')
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

prueba('Pantallas diferidas: el Dashboard se baja durante el splash sólo si hay sesión', async (b) => {
  const pidioDashboard = (u) => /DashboardPage/.test(u)
  // Con sesión: el pedido sale mientras el splash sigue en pantalla.
  const conSesion = await nuevaPagina(b)
  let pedidoDuranteSplash = false
  conSesion.on('request', async (r) => {
    if (pidioDashboard(r.url())) pedidoDuranteSplash ||= (await conSesion.locator('[aria-label="Cargando Monix"]').count()) > 0
  })
  await conSesion.goto('/dashboard')
  await pasarLoader(conSesion)
  assert.ok(pedidoDuranteSplash, 'el Dashboard debería bajarse durante el splash')
  await conSesion.context().close()
  // Sin sesión: la Landing no lo baja.
  const sinSesion = await nuevaPagina(b, { logueado: false })
  const pedidos = []
  sinSesion.on('request', (r) => pedidos.push(r.url()))
  await sinSesion.goto('/')
  await pasarLoader(sinSesion)
  await sinSesion.waitForTimeout(800)
  assert.equal(pedidos.filter(pidioDashboard).length, 0, 'la Landing no debería bajar el Dashboard')
  await sinSesion.context().close()
})

prueba('Fuentes propias: nada de Google Fonts y la negrita de Inter es real', async (b) => {
  const page = await nuevaPagina(b)
  const externos = []
  page.on('request', (r) => { if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) externos.push(r.url()) })
  await page.goto('/dashboard')
  await pasarLoader(page)
  await page.evaluate(() => document.fonts.ready)
  assert.deepEqual(externos, [])
  const cargadas = await page.evaluate(async () => {
    const pedir = ['400 16px Inter', '600 16px Inter', '700 16px Inter', '600 16px "Plus Jakarta Sans"', '700 16px "Plus Jakarta Sans"']
    await Promise.all(pedir.map((f) => document.fonts.load(f)))
    return pedir.filter((f) => !document.fonts.check(f))
  })
  assert.deepEqual(cargadas, [], 'faltan pesos de fuente')
  await page.context().close()
})

prueba('Banco Central: una sola sincronización al navegar entre pantallas', async (b) => {
  const page = await nuevaPagina(b)
  const consultasBC = []
  page.on('request', (r) => { if (r.url().startsWith(BC)) consultasBC.push(r.url()) })
  await page.goto('/dashboard')
  await pasarLoader(page)
  await page.waitForTimeout(1000)
  const alEntrar = consultasBC.length
  assert.ok(alEntrar >= 1, 'al entrar debería sincronizar')
  // Navegación dentro de la app (sin recargar), con la barra inferior.
  const nav = page.locator('nav').last()
  for (const destino of ['Transferir', 'Cuentas', 'Reservas', 'Inicio']) {
    await nav.getByText(destino, { exact: true }).click()
    await page.waitForTimeout(700)
  }
  assert.equal(consultasBC.length, alEntrar, `cada navegación volvía a consultar (${consultasBC.length} consultas)`)
  await page.context().close()
})

prueba('Comprobante PDF: las librerías se bajan recién al abrir un movimiento y el PDF se descarga', async (b) => {
  const page = await nuevaPagina(b)
  const pedidos = []
  page.on('request', (r) => pedidos.push(r.url()))
  const libreriaPdf = (u) => /jspdf|html2canvas/i.test(u)
  await page.goto('/dashboard')
  await pasarLoader(page)
  await page.locator('[role="button"][tabindex="0"]').filter({ hasText: 'Alquiler' }).waitFor()
  assert.equal(pedidos.filter(libreriaPdf).length, 0, 'el Dashboard no debería bajar jsPDF ni html2canvas')
  await page.locator('[role="button"][tabindex="0"]').filter({ hasText: 'Alquiler' }).click()
  const [descarga] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.getByRole('button', { name: /descargar/i }).click(),
  ])
  assert.match(descarga.suggestedFilename(), /^monix_.*\.pdf$/)
  assert.ok(pedidos.some(libreriaPdf), 'al pedir el comprobante se bajan las librerías')
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

prueba('Depositar: "1.500" son mil quinientos (punto de miles) con teclado decimal', async (b) => {
  const page = await nuevaPagina(b)
  let montoEnviado = null
  page.on('request', (req) => {
    if (req.url().includes('/rpc/depositar_en_cuenta')) montoEnviado = JSON.parse(req.postData() ?? '{}').p_monto
  })
  await page.goto('/depositar')
  await pasarLoader(page)
  const campo = page.getByPlaceholder('0.00')
  assert.equal(await campo.getAttribute('inputmode'), 'decimal')
  await campo.fill('1.500')
  await page.getByRole('button', { name: /depositar/i }).last().click()
  await page.getByText('¡Depósito exitoso!').waitFor({ timeout: 5000 })
  assert.equal(montoEnviado, 1500, 'antes del arreglo se depositaba 1,5')
  await page.getByText(/Depositaste \$\s?1\.500,00/).waitFor()
  await page.context().close()
})

prueba('Login y Registro: autocompletado y pegado habilitados', async (b) => {
  const page = await nuevaPagina(b, { logueado: false })
  await page.goto('/login')
  await pasarLoader(page)
  const email = page.locator('input[type="email"]')
  assert.equal(await email.getAttribute('autocomplete'), 'username')
  // Pegar no se bloquea (WCAG 2.2, autenticación accesible: gestores de contraseñas).
  await email.focus()
  // dispatchEvent devuelve false si algún handler hizo preventDefault().
  const pegadoPermitido = await page.evaluate(() => {
    const dt = new DataTransfer()
    dt.setData('text/plain', 'sol@monix.test')
    return document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  })
  assert.equal(pegadoPermitido, true, 'el campo de email bloquea el pegado')
  await page.goto('/register')
  await pasarLoader(page)
  assert.equal(await page.locator('input[name="email"]').getAttribute('autocomplete'), 'email')
  assert.equal(await page.locator('input[name="password"]').getAttribute('autocomplete'), 'new-password')
  await page.context().close()
})

// ── Controles con números (CONSTRAINTS.md): miden y no dejan empeorar ────────
// Línea de base medida el 2026-10-18. Si un número mejora, bajalo acá; nunca subirlo.
const BASE_AXE_SERIAS = 0
const BASE_TOQUES_CHICOS = 0
const publicas = ['/', '/login', '/register']
const privadas = ['/dashboard', '/transferir', '/depositar', '/historial', '/tarjeta', '/perfil']

prueba('Accesibilidad (axe, WCAG 2.1 AA): violaciones serias o críticas', async (b) => {
  const { AxeBuilder } = await import('@axe-core/playwright')
  const encontradas = []
  for (const [logueado, rutas] of [[false, publicas], [true, privadas]]) {
    // reducedMotion: axe mide el estado final, no un fundido a medias.
    const page = await nuevaPagina(b, { logueado, reducedMotion: 'reduce' })
    for (const ruta of rutas) {
      await page.goto(ruta)
      await pasarLoader(page)
      await page.waitForTimeout(800)
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      for (const v of r.violations) {
        if (v.impact === 'serious' || v.impact === 'critical') encontradas.push(`${ruta} ${v.id} → ${v.nodes.map((n) => n.target.join(' ')).join(' | ').slice(0, 140)}`)
      }
    }
    await page.context().close()
  }
  console.log(`  axe: ${encontradas.length} violaciones serias/críticas\n    ${encontradas.join('\n    ')}`)
  assert.ok(encontradas.length <= BASE_AXE_SERIAS, `subieron de ${BASE_AXE_SERIAS} a ${encontradas.length}`)
})

prueba('Toques: elementos interactivos de menos de 44×44 px en mobile', async (b) => {
  const page = await nuevaPagina(b)
  const chicos = new Set()
  for (const ruta of privadas) {
    await page.goto(ruta)
    await pasarLoader(page)
    await page.waitForTimeout(700)
    const lista = await page.evaluate(() => {
      const out = []
      for (const el of document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,[role=button]')) {
        // Un checkbox dentro de su <label> se toca en todo el label (área equivalente en WCAG).
        const label = el.matches('input[type=checkbox],input[type=radio]') && el.closest('label')
        const r = (label || el).getBoundingClientRect()
        // Sólo lo que está en pantalla (el menú lateral cerrado queda afuera).
        if (!r.width || !r.height || r.right <= 0 || r.left >= innerWidth) continue
        if (r.width < 44 || r.height < 44) {
          const nombre = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 30)
          out.push(`${nombre} ${Math.round(r.width)}×${Math.round(r.height)}`)
        }
      }
      return out
    })
    for (const x of lista) chicos.add(`${ruta}: ${x}`)
  }
  console.log(`  toques chicos: ${chicos.size}\n    ${[...chicos].join('\n    ')}`)
  assert.ok(chicos.size <= BASE_TOQUES_CHICOS, `subieron de ${BASE_TOQUES_CHICOS} a ${chicos.size}`)
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
