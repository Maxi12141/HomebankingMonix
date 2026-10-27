import { chromium } from 'playwright'
import fs from 'fs'
const [dir, out, cols, ...names] = process.argv.slice(2)
const imgs = names.map(n => `<figure><img src="data:image/png;base64,${fs.readFileSync(`${dir}/${n}.png`).toString('base64')}"><figcaption>${n}</figcaption></figure>`).join('')
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1800, height: 900 } })
await p.setContent(`<style>body{margin:0;background:#333;display:grid;grid-template-columns:repeat(${cols},1fr);gap:10px;padding:10px}figure{margin:0}img{width:100%;display:block}figcaption{color:#fff;font:16px sans-serif}</style>${imgs}`)
await p.screenshot({ path: out, fullPage: true }); await b.close()
