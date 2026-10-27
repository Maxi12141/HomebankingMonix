import { chromium } from 'playwright'
import fs from 'fs'
const S = 'C:/Users/Admin/AppData/Local/Temp/claude/c--Users-Admin-Desktop-HomebankingMonix/9c214aab-b033-41f2-8676-3406c448fa84/scratchpad'
let html = fs.readFileSync(`${S}/manual-usuario/plantilla.html`, 'utf8')
const names = [...new Set([...html.matchAll(/\{\{img:([\w-]+)\}\}/g)].map(m => m[1]))]
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 520, height: 1125 } })
let total = 0
for (const n of names) {
  // Bajamos a 520 px de ancho en JPEG: nítido en la columna de 230 px a 2x y liviano
  await p.setContent(`<body style="margin:0"><img src="data:image/png;base64,${fs.readFileSync(`${S}/capturas/${n}.png`).toString('base64')}" style="display:block;width:520px">`)
  const buf = await p.screenshot({ type: 'jpeg', quality: 82, clip: { x: 0, y: 0, width: 520, height: 1125 } })
  total += buf.length
  html = html.replaceAll(`{{img:${n}}}`, 'data:image/jpeg;base64,' + buf.toString('base64'))
}
await b.close()
html = html.replace('{{logo}}', 'data:image/svg+xml;base64,' + fs.readFileSync('src/assets/logos/logo-blanco.svg').toString('base64'))
fs.writeFileSync(`${S}/manual-usuario/manual-usuario-monix.html`, html)
console.log(names.length, 'imágenes,', Math.round(total / 1024), 'KB; html', Math.round(html.length / 1024), 'KB; sin reemplazar:', (html.match(/\{\{/g) || []).length)
