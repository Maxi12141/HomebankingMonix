// Renderiza la tarjeta 3D del hero en reposo como PNG sin fondo para el deck
import { chromium } from 'playwright'
const D = 'C:/Users/Admin/AppData/Local/Temp/claude/c--Users-Admin-Desktop-HomebankingMonix/adf21a23-d695-4cbc-b041-fdc8f7f75fb3/scratchpad/tarjeta'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 732, height: 505 }, deviceScaleFactor: 2 })
await p.goto(`file:///${D}/tarjeta.html`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500)
await p.locator('#e').screenshot({ path: `${D}/tarjeta-3d.png`, omitBackground: true })
await b.close(); console.log('ok')
