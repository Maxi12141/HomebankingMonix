import { chromium } from 'playwright'
import fs from 'fs'
const S = 'C:/Users/Admin/AppData/Local/Temp/claude/c--Users-Admin-Desktop-HomebankingMonix/9c214aab-b033-41f2-8676-3406c448fa84/scratchpad'
const svg = fs.readFileSync('src/assets/logos/logo-blanco.svg').toString('base64')
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 500 } })
await p.setContent(`<body style="margin:0;background:transparent"><img id="l" src="data:image/svg+xml;base64,${svg}" style="display:block;width:1440px;height:auto">`)
await p.waitForTimeout(300)
await p.locator('#l').screenshot({ path: `${S}/deck-assets/logo-blanco.png`, omitBackground: true })
const box = await p.locator('#l').boundingBox(); console.log('tamaño', Math.round(box.width), Math.round(box.height))
await b.close()
