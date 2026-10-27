import { chromium } from 'playwright'
import fs from 'fs'
import QRCode from 'qrcode'
const S = 'C:/Users/Admin/AppData/Local/Temp/claude/c--Users-Admin-Desktop-HomebankingMonix/9c214aab-b033-41f2-8676-3406c448fa84/scratchpad'
const CAP = S + '/capturas', OUT = S + '/deck-assets'
fs.mkdirSync(OUT, { recursive: true })
const b64 = (n) => 'data:image/png;base64,' + fs.readFileSync(`${CAP}/${n}.png`).toString('base64')
const browser = await chromium.launch()

// 1. Recortes de pantallas (coordenadas en px de la captura 780 de ancho)
const crops = [
  ['qr', 'qr-generar-monto', 300, 1330],
  ['prestamo', 'pantalla-prestamos-simulador', 150, 1545],
  ['transferir', 'pantalla-transferir', 140, 840],
  ['registro', '04-registro-paso2', 230, 1420],
  ['huella', '06-dashboard-huella', 0, 0],
]
const cp = await browser.newPage({ viewport: { width: 780, height: 1688 } })
for (const [out, src, y0, y1] of crops) {
  if (!fs.existsSync(`${CAP}/${src}.png`) || y1 === 0) continue
  await cp.setContent(`<body style="margin:0"><img src="${b64(src)}" style="display:block">`)
  await cp.screenshot({ path: `${OUT}/crop-${out}.png`, clip: { x: 0, y: y0, width: 780, height: y1 - y0 } })
  console.log('crop', out)
}

// 2. Fondos de diapositiva: azul noche + líneas a 35° + cards difuminadas + barras mint
const lines = `<svg width="1920" height="1080" style="position:absolute;inset:0"><defs><pattern id="l" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="26" stroke="rgba(255,255,255,0.05)" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#l)"/></svg>`
const card = (n, x, y, w, rot, blur, op) => `<img src="${b64(n)}" style="position:absolute;left:${x}px;top:${y}px;width:${w}px;transform:rotate(${rot}deg);filter:blur(${blur}px);opacity:${op};border-radius:28px">`
const bg = async (name, cards, { bars = false, glow = 'right', veil = 0.55 } = {}) => {
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  const glowCss = glow === 'right' ? 'radial-gradient(900px 700px at 78% 50%, rgba(38,255,193,0.10), transparent 70%)'
    : glow === 'center' ? 'radial-gradient(1000px 650px at 50% 48%, rgba(38,255,193,0.10), transparent 70%)'
    : 'radial-gradient(900px 700px at 22% 50%, rgba(38,255,193,0.10), transparent 70%)'
  const veilCss = glow === 'center'
    ? `radial-gradient(1100px 620px at 50% 50%, rgba(0,26,61,${veil + 0.3}), rgba(0,26,61,${veil}))`
    : `linear-gradient(90deg, rgba(0,26,61,0.97) 0%, rgba(0,26,61,0.92) 42%, rgba(0,26,61,${veil}) 70%, rgba(0,26,61,${veil}) 100%)`
  await p.setContent(`<body style="margin:0;width:1920px;height:1080px;position:relative;overflow:hidden;background:#001A3D">
    ${cards.join('')}
    <div style="position:absolute;inset:0;background:${veilCss}"></div>
    <div style="position:absolute;inset:0;background:${glowCss}"></div>
    ${lines}
    ${bars ? '<div style="position:absolute;left:0;right:0;top:0;height:10px;background:#26FFC1"></div><div style="position:absolute;left:0;right:0;bottom:0;height:10px;background:#26FFC1"></div>' : ''}
  </body>`)
  await p.waitForTimeout(300)
  await p.screenshot({ path: `${OUT}/bg-${name}.png` }); await p.close(); console.log('bg', name)
}
await bg('cover', [
  card('card-tarjeta', -60, 40, 640, -12, 7, 0.75), card('card-saldo', 1340, -30, 640, 10, 7, 0.7),
  card('card-reservas', 1300, 640, 600, -8, 8, 0.6), card('qr-generar-monto', 80, 560, 420, 9, 9, 0.55),
  card('pantalla-prestamos-simulador', 760, 700, 420, -4, 10, 0.4),
], { bars: true, glow: 'center', veil: 0.35 })
await bg('cierre', [
  card('card-saldo', -80, 620, 620, 10, 8, 0.6), card('card-tarjeta', 1380, 30, 600, -10, 8, 0.65),
  card('card-reservas', 1420, 700, 560, 7, 9, 0.5), card('pantalla-prestamos-esquema', 60, -200, 420, -8, 10, 0.4),
], { bars: true, glow: 'center', veil: 0.4 })
await bg('derecha-saldo', [card('card-saldo', 1050, 120, 980, -6, 14, 0.55), card('card-reservas', 1150, 640, 820, 5, 16, 0.4)])
await bg('derecha-qr', [card('qr-generar-monto', 1120, -120, 800, 8, 16, 0.5), card('card-saldo', 1000, 700, 820, -6, 16, 0.35)])
await bg('derecha-prestamo', [card('pantalla-prestamos-esquema', 1100, -150, 820, -7, 16, 0.5), card('card-saldo', 1050, 760, 800, 6, 16, 0.3)])
await bg('derecha-tarjeta', [card('card-tarjeta', 1000, 80, 1000, 8, 14, 0.55), card('pantalla-mercado-monix', 1250, 560, 600, -6, 16, 0.4)])
await bg('derecha-transferir', [card('pantalla-historial', 1150, -100, 760, 7, 16, 0.45), card('card-saldo', 980, 720, 820, -5, 16, 0.35)])
await bg('derecha-registro', [card('05-registro-terminos', 1150, -80, 760, -7, 16, 0.45), card('card-tarjeta', 1000, 720, 820, 6, 16, 0.35)])
await bg('izquierda-metas', [card('card-reservas', -140, 80, 900, -7, 14, 0.5), card('card-saldo', -100, 650, 820, 6, 16, 0.35)], { glow: 'left' })
await bg('centro-moni', [card('card-saldo', -120, 60, 760, -9, 12, 0.45), card('card-tarjeta', 1300, 640, 720, 8, 12, 0.45), card('card-reservas', 1350, 20, 600, -6, 14, 0.35)], { glow: 'center', veil: 0.45 })

// 3. QR al sitio para el cierre (mint sobre azul noche)
await QRCode.toFile(`${OUT}/qr-sitio.png`, 'https://monix-homebanking.vercel.app', { width: 720, margin: 2, color: { dark: '#001A3D', light: '#FFFFFF' } })
console.log('qr sitio')
await browser.close()
