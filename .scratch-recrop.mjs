import { chromium } from 'playwright'
import fs from 'fs'
const S = 'C:/Users/Admin/AppData/Local/Temp/claude/c--Users-Admin-Desktop-HomebankingMonix/9c214aab-b033-41f2-8676-3406c448fa84/scratchpad'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 780, height: 1688 } })
for (const [out, src, y0, y1] of [['prestamo', 'pantalla-prestamos-simulador', 150, 1362], ['registro', '04-registro-paso2', 300, 1420]]) {
  await p.setContent(`<body style="margin:0"><img src="data:image/png;base64,${fs.readFileSync(`${S}/capturas/${src}.png`).toString('base64')}" style="display:block">`)
  await p.screenshot({ path: `${S}/deck-assets/crop-${out}.png`, clip: { x: 0, y: y0, width: 780, height: y1 - y0 } })
}
await b.close(); console.log('ok')
