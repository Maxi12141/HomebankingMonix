// QR del cierre: abre el banco de prueba. Corrección L: menos módulos, más grandes, para leerlo de lejos; se verifica decodificándolo.
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { chromium } from 'playwright'
const URL_PRUEBA = 'https://monix-homebanking.vercel.app/prueba'
const OUT = 'C:/Users/Admin/AppData/Local/Temp/claude/c--Users-Admin-Desktop-HomebankingMonix/9c214aab-b033-41f2-8676-3406c448fa84/scratchpad/deck-assets/qr-prueba.png'
const qr = QRCode.create(URL_PRUEBA, { errorCorrectionLevel: 'L' })
console.log('versión', qr.version, 'módulos', qr.modules.size)
await QRCode.toFile(OUT, URL_PRUEBA, { errorCorrectionLevel: 'L', width: 1200, margin: 2, color: { dark: '#001A3D', light: '#FFFFFF' } })
const b = await chromium.launch(); const p = await b.newPage()
await p.goto(`file:///${OUT}`)
const px = await p.evaluate(() => { const i = document.images[0]; const c = document.createElement('canvas'); c.width = 300; c.height = 300; const x = c.getContext('2d'); x.drawImage(i, 0, 0, 300, 300); return [...x.getImageData(0, 0, 300, 300).data] })
await b.close()
console.log('lee (achicado a 300px):', jsQR(Uint8ClampedArray.from(px), 300, 300)?.data)
