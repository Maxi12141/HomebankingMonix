// Arma una hoja de contacto con varias capturas para revisarlas de un vistazo
import { chromium } from 'playwright'
import fs from 'fs'
const DIR = process.argv[2], OUTF = process.argv[3], names = process.argv.slice(4)
const imgs = names.map(n => `<figure><img src="data:image/png;base64,${fs.readFileSync(DIR + '/' + n + '.png').toString('base64')}"><figcaption>${n}</figcaption></figure>`).join('')
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 900 } })
await p.setContent(`<style>body{margin:0;background:#222;display:flex;gap:8px;padding:8px}figure{margin:0;flex:1}img{width:100%}figcaption{color:#fff;font:14px sans-serif}</style>${imgs}`)
await p.screenshot({ path: OUTF, fullPage: true }); await b.close()
