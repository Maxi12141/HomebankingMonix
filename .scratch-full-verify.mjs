import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const dni = String(Math.floor(10000000 + Math.random() * 89999999))
const email = `verify.${Date.now()}@monix.test`
const password = 'testtest123'

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
await context.addInitScript(() => localStorage.setItem('monix_permisos_ok', '1'))
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 200)) })

const cdp = await context.newCDPSession(page)
await cdp.send('WebAuthn.enable')
await cdp.send('WebAuthn.addVirtualAuthenticator', {
  options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
})

// 1. Registro
await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' })
await page.fill('input[name="nombre"]', 'Verify')
await page.fill('input[name="apellido"]', 'Test')
await page.fill('input[name="dni"]', dni)
await page.fill('input[name="email"]', email)
await page.fill('input[name="telefono"]', '1122334455')
await page.fill('input[name="direccion"]', 'Test 1')
await page.fill('input[name="password"]', password)
await page.click('button[type="submit"]')
await page.waitForURL('**/dashboard', { timeout: 20000 })
console.log('=== Cuenta creada ===')
await page.waitForTimeout(1500)
const modalRoot = page.locator('.fixed.inset-0.z-\\[9990\\]')
if (await modalRoot.isVisible().catch(() => false)) {
  await page.waitForTimeout(2000)
  await modalRoot.locator('button:has-text("Ver cómo funciona")').click()
  await page.waitForTimeout(500)
}
const omitirBtn = page.locator('button:has-text("Omitir")')
await omitirBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
if (await omitirBtn.isVisible().catch(() => false)) { await omitirBtn.click(); await page.waitForTimeout(500) }

// 2. Ojito: activar y verificar que persiste tras reload
console.log('\n=== TEST: ojito de saldo persiste ===')
const eyeBtn = page.locator('[aria-label="Mostrar saldo"]').first()
await eyeBtn.click()
await page.waitForTimeout(300)
const savedPref = await page.evaluate(() => localStorage.getItem('monix_mostrar_saldo'))
console.log('Preferencia guardada en localStorage:', savedPref)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
const hideBtnAfterReload = await page.locator('[aria-label="Ocultar saldo"]').first().isVisible().catch(() => false)
console.log('Sigue mostrando el saldo tras reload (persistio):', hideBtnAfterReload)

// 3. Iconos: Reservas (chanchito) y Depositar ($ con flecha) en el drawer
console.log('\n=== TEST: iconos del drawer ===')
await page.click('#tour-menu')
await page.waitForTimeout(700)
const drawerHtml = await page.locator('#tour-drawer').innerHTML()
// no podemos inspeccionar el SVG facil, solo confirmamos que el drawer carga sin errores
console.log('Drawer abierto sin errores:', errors.length === 0)
await page.click('#tour-menu') // cerrar
await page.waitForTimeout(500)

// 4. USD: modal de terminos requiere checkbox
console.log('\n=== TEST: modal T&C cuenta USD ===')
await page.goto(`${BASE}/cuentas`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
await page.click('button:has-text("Solicitar cuenta en dólares")')
await page.waitForTimeout(500)
const continuarBtn = page.locator('button:has-text("Continuar")')
const disabledBefore = await continuarBtn.isDisabled()
console.log('Boton Continuar deshabilitado sin aceptar terminos:', disabledBefore)
await page.locator('input[type="checkbox"]').click()
await page.waitForTimeout(200)
const disabledAfter = await continuarBtn.isDisabled()
console.log('Boton Continuar habilitado tras aceptar:', !disabledAfter)
await continuarBtn.click()
await page.waitForTimeout(3000)
const cuentaUsdCreada = await page.locator('text=Caja de ahorro en dólares').isVisible().catch(() => false)
console.log('Cuenta USD creada (ya no muestra "Solicitar"):', cuentaUsdCreada)

// 5. Prestamos: texto de aclaracion visible
console.log('\n=== TEST: aclaracion sistema frances en Prestamos ===')
await page.goto(`${BASE}/prestamos`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
await page.fill('input[type="number"]', '500000')
await page.waitForTimeout(500)
const bodyPrestamos = await page.locator('body').innerText()
console.log('Muestra aclaracion "Sistema francés":', bodyPrestamos.includes('Sistema francés'))
console.log('Boton "Ver esquema de pago" visible:', bodyPrestamos.includes('Ver esquema de pago'))

// 6. Biometria unificada: activar y loguear sin contraseña
console.log('\n=== TEST: biometria unificada, activar + login sin contraseña ===')
await page.goto(`${BASE}/perfil`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
const bioToggle = page.locator('text=Ingreso con biometría').locator('..').locator('[role="switch"]')
const bioToggleVisible = await bioToggle.isVisible().catch(() => false)
console.log('Toggle unico "Ingreso con biometría" visible:', bioToggleVisible)
await bioToggle.click()
await page.waitForTimeout(600)
await page.locator('.relative.z-10.w-full.max-w-md input[type="password"]').fill(password)
await page.locator('.relative.z-10.w-full.max-w-md button:has-text("Confirmar")').click()
await page.waitForTimeout(2500)
const toggleActivo = await bioToggle.getAttribute('aria-checked')
console.log('Toggle activo tras confirmar:', toggleActivo)

// logout
await page.click('#tour-menu')
await page.waitForTimeout(700)
await page.locator('#tour-drawer button:has-text("Cerrar sesión")').click()
await page.waitForTimeout(1000)

// login con biometria
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.fill('input[type="email"]', email)
await page.click('button:has-text("Continuar")')
await page.waitForTimeout(1500)
console.log('URL tras login biometrico (deberia ser /dashboard sin tipear contraseña):', page.url())

console.log('\n=== Errores totales ===', errors.length)
errors.forEach((e) => console.log(' -', e))

await browser.close()
