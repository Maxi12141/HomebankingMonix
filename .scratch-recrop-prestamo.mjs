import { chromium } from 'playwright'
import fs from 'fs'
const S = 'C:/Users/Admin/AppData/Local/Temp/claude/c--Users-Admin-Desktop-HomebankingMonix/9c214aab-b033-41f2-8676-3406c448fa84/scratchpad'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 780, height: 1688 } })
await p.setContent(`<body style="margin:0"><img src="data:image/png;base64,${fs.readFileSync(`${S}/capturas/pantalla-prestamos-simulador-normal.png`).toString('base64')}" style="display:block">`)
await p.screenshot({ path: `${S}/deck-assets/crop-prestamo-normal.png`, clip: { x: 0, y: 396, width: 780, height: 1212 } })
await b.close(); console.log('ok')
