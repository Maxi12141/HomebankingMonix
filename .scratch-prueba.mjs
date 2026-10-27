// Entra a /prueba en producción sin sesión, como un celular nuevo, y recorre la bienvenida y el tour
import { chromium, devices } from 'playwright'
const D = 'C:/Users/Admin/AppData/Local/Temp/claude/c--Users-Admin-Desktop-HomebankingMonix/adf21a23-d695-4cbc-b041-fdc8f7f75fb3/scratchpad/prueba'
const b = await chromium.launch()
const p = await (await b.newContext({ ...devices['Pixel 7'] })).newPage()
const errores = []; p.on('pageerror', e => errores.push(e.message))
await p.goto('https://monix-homebanking.vercel.app/prueba', { waitUntil: 'networkidle' }); await p.waitForTimeout(2000)
await p.getByRole('button', { name: 'Ver cómo funciona' }).click(); await p.waitForTimeout(1500)
await p.screenshot({ path: `${D}/2-tour.png` })
const dlg = await p.evaluate(() => [...document.querySelectorAll('[role=dialog], [aria-modal=true]')].map(d => d.innerText.replace(/\n+/g, ' | ')).join(' ## '))
console.log('dialogo:', dlg.slice(0, 400))
console.log('errores', errores)
await b.close()
