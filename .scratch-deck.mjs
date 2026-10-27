// Genera las diapositivas del deck de venta (formato Slides) y una vista previa local para revisarlas.
import fs from 'fs'
import { chromium } from 'playwright'

const S = 'C:/Users/Admin/AppData/Local/Temp/claude/c--Users-Admin-Desktop-HomebankingMonix/9c214aab-b033-41f2-8676-3406c448fa84/scratchpad'
const SLIDES = `${S}/deck-venta/project/slides`
const PREV = `${S}/deck-preview`
fs.mkdirSync(SLIDES, { recursive: true }); fs.mkdirSync(PREV, { recursive: true })

// Paleta Monix
const NAVY = '#001A3D', CARD = '#0D2B52', LINE = '#1B3B63', MINT = '#26FFC1'
const TXT = '#F5F7FA', SOFT = '#C3D2E3', ROW = '#E2EAF3', MUTED = '#8FAFC9', FOOT = '#6F8BA5'
const DISPLAY = "'Plus Jakarta Sans', sans-serif"

// Ícono Lucide como SVG inline (el formato no acepta x-icon con estos nombres)
function icon(name, color, size, label) {
  const src = fs.readFileSync(`node_modules/lucide-react/dist/esm/icons/${name}.js`, 'utf8')
  const arr = src.slice(src.indexOf('[', src.indexOf('createLucideIcon(')), src.lastIndexOf(']') + 1)
  const node = Function(`return ${arr}`)()
  const inner = node.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('')
  return `<svg aria-label="${label}" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:${size}px; height:${size}px">${inner}</svg>`
}

const BLOB = {
  bgCover: 'cba4479984b9dfae8f2d41e66707eefd', bgCierre: '5ef9ba58bddebe87763f8c7fee6cb45a',
  bgSaldo: '05dc49721366eff3ce87d8430e6e2cc6', bgQr: '7e028f8e8c4d6877304fb4d95af86474',
  bgPrestamo: '9c2c69d449178626778e6fe7fbc70b32', bgTarjeta: '68b27af455135b5e2419ce5c80a381de',
  bgTransferir: '65ab98cae9db4c7a0bee594c79e2c55b', bgRegistro: 'a8bd655b31726b26627d68bfcfb28547',
  bgMetas: '8bc1ef5d833f74fe6ea0d936b4db980f', bgMoni: '9c9938a54bfac0e3c961ad6785579cd3',
  qr: '4f6289ee613580b3f4f386ae170ed4b3', prestamo: '1da1ac7a879fc06a4ae9ddb658f9f67b',
  registro: 'f51468b58a29da21c12b8de10194b136', transferir: 'c9d3e141d9e985c39cf4e69ec945237d',
  qrSitio: '89cb6d3a9077fbc8cd0f3225d5e6f614', saldo: 'd8fe3d34fa4c44ffdb111ef41c253e40',
  reservas: 'a9b2aa9e67a6686ab21e8d21d01df3d3', tarjeta: '7aaafd011d5a5beccbe766c45a96af0a',
  logo: 'c3ba5810fc8ecc9b0fecc700b1d810e9',
}
// Para la vista previa: de qué archivo local sale cada blob
const LOCAL = {
  bgCover: 'deck-assets/bg-cover.png', bgCierre: 'deck-assets/bg-cierre.png', bgSaldo: 'deck-assets/bg-derecha-saldo.png',
  bgQr: 'deck-assets/bg-derecha-qr.png', bgPrestamo: 'deck-assets/bg-derecha-prestamo.png', bgTarjeta: 'deck-assets/bg-derecha-tarjeta.png',
  bgTransferir: 'deck-assets/bg-derecha-transferir.png', bgRegistro: 'deck-assets/bg-derecha-registro.png', bgMetas: 'deck-assets/bg-izquierda-metas.png',
  bgMoni: 'deck-assets/bg-centro-moni.png', qr: 'deck-assets/crop-qr.png', prestamo: 'deck-assets/crop-prestamo.png',
  registro: 'deck-assets/crop-registro.png', transferir: 'deck-assets/crop-transferir.png', qrSitio: 'deck-assets/qr-sitio.png',
  saldo: 'capturas/card-saldo.png', reservas: 'capturas/card-reservas.png', tarjeta: 'capturas/card-tarjeta.png',
}
const img = (k) => `/_blob/${BLOB[k]}`

const SECTION = `background:${NAVY}; color:${TXT}; font-family:'Inter', sans-serif; padding:128px 128px 160px; display:flex; flex-direction:column`
const backdrop = (k, alt) => `<img src="${img(k)}" alt="${alt}" style="position:absolute; left:0px; top:0px; width:1920px; height:1080px; object-fit:cover">`
const footer = (n) => `<p style="position:absolute; left:128px; bottom:64px; width:600px; font-size:24px; color:${FOOT}">Monix · ${n}</p>`
const kicker = (t) => `<p style="font-family:${DISPLAY}; font-size:30px; font-weight:700; line-height:1.3; letter-spacing:3px; text-transform:uppercase; color:${MINT}">${t}</p>`
const title = (t) => `<h2 style="font-family:${DISPLAY}; font-size:80px; font-weight:800; line-height:1.1; letter-spacing:-1px; color:#FFFFFF">${t}</h2>`
const lead = (t) => `<p style="font-size:36px; line-height:1.4; color:${SOFT}">${t}</p>`
const benefit = (ic, t) => `<div style="display:flex; align-items:center; gap:28px"><div style="width:88px; height:88px; border-radius:24px; background:${CARD}; border:1px solid ${LINE}; display:flex; align-items:center; justify-content:center">${icon(ic, MINT, 44, '')}</div><p style="flex:1; font-size:34px; line-height:1.3; color:${ROW}">${t}</p></div>`
const benefits = (rows) => `<div style="display:flex; flex-direction:column; gap:28px">${rows.map(([i, t]) => benefit(i, t)).join('')}</div>`
const column = (w, inner) => `<div style="width:${w}px; display:flex; flex-direction:column; gap:32px">${inner}</div>`
const shot = (k, alt, l, t, w, h, order, frame = true) => `<img src="${img(k)}" alt="${alt}" data-build-in="pop ${order}" style="position:absolute; left:${l}px; top:${t}px; width:${w}px; height:${h}px; object-fit:contain; border-radius:36px;${frame ? ` border:2px solid ${LINE};` : ''} box-shadow:0 40px 90px rgba(0,0,0,0.55)">`

const slides = {}

slides.cover = `<section id="cover" data-transition="fade" style="${SECTION.replace('padding:128px 128px 160px', 'padding:128px 128px 160px; align-items:center; justify-content:center; gap:56px')}">
${backdrop('bgCover', 'Cards de la app Monix difuminadas de fondo')}
<img src="${img('logo')}" alt="Logo de Monix" style="width:720px; height:180px; object-fit:contain">
<h1 style="width:1664px; font-family:${DISPLAY}; font-size:92px; font-weight:800; line-height:1.1; letter-spacing:-1px; color:#FFFFFF; text-align:center">Banca de verdad, <span style="color:${MINT}">desde tu celular.</span></h1>
<p style="width:1500px; font-size:42px; line-height:1.4; color:${SOFT}; text-align:center">Cuenta, QR, préstamos y ahorro en una sola app.</p>
<p style="position:absolute; left:128px; bottom:64px; width:1664px; font-size:24px; font-weight:600; color:${MUTED}; text-align:center">Práctica Profesionalizante I · Maximiliano Turaglio · Diego Urenda</p>
<aside>Abrir con la promesa: todo lo que hace un banco, en el celular y sin sucursal. Las cards del fondo son pantallas reales de la app.</aside>
</section>`

slides.s01 = `<section id="s01" data-transition="fade" style="${SECTION}">
${backdrop('bgRegistro', 'Fondo azul noche con pantallas del registro difuminadas')}
${column(900,kicker('Abrir la cuenta') + title('Tu cuenta, lista en minutos') + lead('Sin sucursal ni papeles: tres pasos desde el celular.') + benefits([
  ['landmark', 'Al terminar ya tenés CBU y alias propios'],
  ['gift', 'Bono de bienvenida al instante'],
  ['fingerprint', 'Seguridad biométrica: entrás con tu huella'],
]))}
${shot('registro', 'Paso 2 de 3 del registro: nombre, apellido, DNI, teléfono y domicilio', 1240, 128, 552, 792, 1)}
<div style="position:absolute; left:1060px; top:724px; width:440px; display:flex; flex-direction:column; gap:6px; background:${MINT}; border-radius:28px; padding:28px 36px; box-shadow:0 24px 60px rgba(0,0,0,0.45)" data-build-in="pop 2">
<p style="font-family:${DISPLAY}; font-size:72px; font-weight:800; line-height:1.1; color:${NAVY}">$ 150.000</p>
<p style="font-size:32px; font-weight:600; line-height:1.3; color:${NAVY}">de regalo al abrirla</p>
</div>
${footer('01')}
<aside>Primero email y contraseña, después los datos personales, y por último confirmar y aceptar los términos. Si el DNI o el email ya existen, la app avisa en el momento. Al terminar, el bono ya está en la cuenta y la app ofrece activar la huella.</aside>
</section>`

slides.s02 = `<section id="s02" data-transition="fade" style="${SECTION}">
${backdrop('bgSaldo', 'Fondo azul noche con la card de saldo difuminada')}
${column(900,kicker('Tu dinero') + title('Tu plata rinde todos los días') + `<div style="display:flex; align-items:center; gap:32px"><p style="font-family:${DISPLAY}; font-size:150px; font-weight:800; line-height:1; letter-spacing:-2px; color:${MINT}">32%</p><p style="width:480px; font-size:34px; line-height:1.3; color:${SOFT}">de interés anual en tu cuenta y en Reservas</p></div>` + benefits([
  ['trending-up', 'En el inicio ves cuánto ganaste hoy'],
  ['piggy-bank', 'Reservas: un bolsillo para ahorrar aparte'],
  ['coins', 'Con $ 150.000 ganás unos $ 131 por día'],
]))}
${shot('saldo', 'Card de saldo disponible: $150.000,00 con TNA del 32%', 1172, 128, 620, 488, 1, false)}
${shot('reservas', 'Card de Reservas con TNA del 32% y el botón Empezar a ahorrar', 1060, 512, 520, 407, 2, false)}
${footer('02')}
<aside>La cuenta ya es remunerada: no hay que hacer nada para que rinda. Reservas separa la plata que no querés gastar y rinde igual. Quien ahorra en dólares puede abrir la caja en USD desde Cuentas.</aside>
</section>`

slides.s03 = `<section id="s03" data-transition="fade" style="${SECTION}">
${backdrop('bgQr', 'Fondo azul noche con un QR difuminado')}
${column(900,kicker('QR interbancario') + title('Cobrá con QR, de banco a banco') + lead('Te pagan desde Monix o desde cualquier otro banco de la red.') + benefits([
  ['qr-code', 'Con monto fijo o libre, como prefieras'],
  ['bell-ring', 'Te avisa apenas te pagan'],
  ['shield-check', 'Cada QR sirve para un solo cobro'],
]))}
${shot('qr', 'Pantalla Mostrá tu código para cobrar, con el QR, el alias pan.alba.isla y $12.500,00', 1192, 128, 600, 792, 1)}
${footer('03')}
<aside>El momento fuerte de la demo. En vivo: tocar el botón QR, Generar QR, poner un monto y que alguien lo escanee desde otro banco del curso. Cuando paga, aparece "Cobro acreditado" sin recargar nada. Cada código sirve para un solo cobro.</aside>
</section>`

slides.s04 = `<section id="s04" data-transition="fade" style="${SECTION}">
${backdrop('bgTransferir', 'Fondo azul noche con el historial difuminado')}
${column(900,kicker('Transferencias') + title('Transferí en segundos, las 24 horas') + lead('Por CBU o alias, a Monix o a otros bancos.') + benefits([
  ['contact', 'Tus contactos, al alcance de la mano'],
  ['wifi-off', 'Si se corta internet, la plata no se pierde'],
  ['search', 'Historial con buscador y filtros'],
]))}
${shot('transferir', 'Pantalla Transferir con la agenda de contactos y el campo CBU o alias destino', 1132, 128, 660, 592, 1)}
<div style="position:absolute; left:1132px; top:704px; width:660px; display:flex; align-items:center; gap:28px; background:${CARD}; border:1px solid ${LINE}; border-radius:28px; padding:30px 36px; box-shadow:0 24px 60px rgba(0,0,0,0.5)" data-build-in="pop 2">
${icon('circle-check', MINT, 68, 'Listo')}
<div style="flex:1; display:flex; flex-direction:column; gap:6px">
<p style="font-family:${DISPLAY}; font-size:40px; font-weight:700; line-height:1.2; color:#FFFFFF">Transferencia enviada</p>
<p style="font-size:30px; line-height:1.3; color:#B0C0D6">Acreditada en el momento</p>
</div>
</div>
${footer('04')}
<aside>Se escribe el CBU o el alias y la app muestra a quién le vas a mandar antes de confirmar. Al terminar se comparte el comprobante por WhatsApp o se descarga. Si se corta la conexión a mitad de camino, la plata no se duplica ni se pierde.</aside>
</section>`

slides.s05 = `<section id="s05" data-transition="fade" style="${SECTION}">
${backdrop('bgPrestamo', 'Fondo azul noche con el esquema de pago difuminado')}
${column(900,kicker('Préstamos') + title('Conocé la cuota antes de pedirlo') + lead('La tasa se ajusta a tu perfil, no al revés.') + benefits([
  ['calculator', 'Cuota fija y el detalle mes a mes'],
  ['briefcase', 'Con tu sueldo en Monix, mejor tasa'],
  ['wallet', 'La plata cae directo en tu cuenta'],
]))}
${shot('prestamo', 'Simulador de préstamos: $500.000 en 6 cuotas de $110.079', 1282, 128, 510, 792, 1)}
<div style="position:absolute; left:1070px; top:676px; width:480px; display:flex; flex-direction:column; gap:6px; background:${MINT}; border-radius:28px; padding:28px 36px; box-shadow:0 24px 60px rgba(0,0,0,0.45)" data-build-in="pop 2">
<p style="font-size:32px; font-weight:600; line-height:1.3; color:${NAVY}">$ 500.000 en 6 cuotas</p>
<p style="font-family:${DISPLAY}; font-size:80px; font-weight:800; line-height:1.1; color:${NAVY}">$ 110.079</p>
<p style="font-size:32px; font-weight:600; line-height:1.3; color:${NAVY}">por mes</p>
</div>
${footer('05')}
<aside>Monix consulta la situación del cliente en la central de deudores que comparten los bancos del curso, y con eso arma la oferta: tasa, monto máximo y cantidad de cuotas. Se pone el monto, se elige el plazo y aparece la cuota. Con "Ver esquema de pago" se ve cuánto es interés y cuánto capital cada mes.</aside>
</section>`

const metaCard = (ic, h, t) => `<div style="display:flex; flex-direction:column; gap:20px; background:${CARD}; border:1px solid ${LINE}; border-top:6px solid ${MINT}; border-radius:24px; padding:36px 30px">${icon(ic, MINT, 60, '')}<h3 style="font-family:${DISPLAY}; font-size:38px; font-weight:700; line-height:1.2; color:#FFFFFF">${h}</h3><p style="font-size:32px; line-height:1.4; color:#B0C0D6">${t}</p></div>`
slides.s06 = `<section id="s06" data-transition="fade" style="${SECTION}; gap:32px">
${backdrop('bgMetas', 'Fondo azul noche con la card de Reservas difuminada')}
${kicker('Metas comunes')}
${title('Ahorrar en grupo, sin planillas')}
${lead('Para un viaje, un regalo o el alquiler.')}
<div style="flex:1"></div>
<div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:32px">
${metaCard('users', 'Armá la meta', 'Compartís un código y los demás se suman.')}
${metaCard('hand-coins', 'Cada uno aporta', 'Todos ven quién puso cuánto.')}
${metaCard('trending-up', 'La plata rinde', 'Mientras está juntada, gana interés.')}
${metaCard('vote', 'Sale con mayoría', 'Para usarla, el grupo lo aprueba.')}
</div>
${footer('06')}
<aside>Una meta común es una bolsa compartida. Uno la crea y pasa el código; cada integrante pone desde su cuenta en pesos. Para sacar la plata alguien propone pagar o devolver, y tiene que aprobarlo la mayoría. Si se devuelve, cada uno recibe lo que puso más el interés.</aside>
</section>`

const tile = (n, t, f = 1) => `<div style="flex:${f}; display:flex; flex-direction:column; gap:8px; background:${CARD}; border:1px solid ${LINE}; border-radius:24px; padding:24px 20px"><p style="font-family:${DISPLAY}; font-size:68px; font-weight:800; line-height:1; color:${MINT}">${n}</p><p style="font-size:27px; line-height:1.3; color:#B0C0D6">${t}</p></div>`
slides.s07 = `<section id="s07" data-transition="fade" style="${SECTION}">
${backdrop('bgTarjeta', 'Fondo azul noche con la tarjeta Monix difuminada')}
${column(900,kicker('Tarjeta y beneficios') + title('Tu débito, con promos y cashback') + lead('Pagás con la tarjeta y parte vuelve a tu cuenta.') + benefits([
  ['snowflake', 'Si la perdés, la congelás con un toque'],
  ['shopping-bag', 'Precios exclusivos en nuestra tienda'],
  ['tag', 'Promos en súper, cines y viajes'],
]))}
${shot('tarjeta', 'Tarjeta de débito Monix a nombre de Lucía Demo', 1060, 128, 732, 505, 1, false)}
<div style="position:absolute; left:1060px; top:664px; width:732px; display:flex; gap:20px" data-build-in="rise 2">
${tile('8%', 'tienda oficial', 1.2)}
${tile('5%', 'combustible')}
${tile('3%', 'restaurantes')}
</div>
<p style="position:absolute; left:1060px; top:858px; width:732px; font-size:30px; line-height:1.3; color:${MUTED}">Cashback según el comercio</p>
${footer('07')}
<aside>La tarjeta se ve en la app y se puede dar vuelta para ver el dorso. Congelar la deja sin uso al instante y se descongela igual de rápido. El cashback depende del comercio: 8% en el marketplace propio, 5% en estaciones de servicio, 4% en shoppings y 3% en restaurantes adheridos.</aside>
</section>`

slides.s08 = `<section id="s08" data-transition="fade" style="${SECTION}">
${backdrop('bgMoni', 'Fondo azul noche con cards de la app difuminadas')}
${column(740, kicker('Asistente') + title('Moni te responde al toque') + lead('Le escribís o le hablás como a una persona, y te lleva a la pantalla justa.'))}
<div style="position:absolute; left:920px; top:128px; width:872px; height:792px; background:${CARD}; border:1px solid ${LINE}; border-radius:40px; box-shadow:0 40px 90px rgba(0,0,0,0.5)"></div>
<div style="position:absolute; left:968px; top:168px; width:776px; display:flex; align-items:center; gap:20px">
<div style="width:72px; height:72px; border-radius:36px; background:${MINT}; display:flex; align-items:center; justify-content:center">${icon('bot', NAVY, 40, 'Moni')}</div>
<div style="flex:1; display:flex; flex-direction:column; gap:2px">
<p style="font-family:${DISPLAY}; font-size:38px; font-weight:700; line-height:1.2; color:#FFFFFF">Moni</p>
<p style="font-size:28px; line-height:1.3; color:${MINT}">En línea</p>
</div>
</div>
<hr style="position:absolute; left:968px; top:280px; width:776px; border:none; border-top:1px solid ${LINE}">
<div style="position:absolute; left:1284px; top:320px; width:460px; background:${MINT}; border-radius:36px 36px 8px 36px; padding:24px 36px" data-build-in="pop 1">
<p style="font-family:${DISPLAY}; font-size:48px; font-weight:600; line-height:1.3; color:${NAVY}">¿Cuánto tengo?</p>
</div>
<div style="position:absolute; left:968px; top:470px; width:170px; background:#16365F; border-radius:36px 36px 36px 8px; padding:20px 32px" data-build-in="fade 2">
<p style="font-size:48px; font-weight:700; line-height:1; letter-spacing:6px; color:${MUTED}">•••</p>
</div>
<div style="position:absolute; left:968px; top:470px; width:740px; display:flex; flex-direction:column; gap:24px; background:#16365F; border-radius:36px 36px 36px 8px; padding:32px 36px" data-build-in="rise 3">
<p style="font-size:46px; line-height:1.3; color:#FFFFFF">Lucía, tenés <span style="color:${MINT}"><b>$ 150.000,00</b></span> disponibles en pesos.</p>
<div style="width:360px; display:flex; align-items:center; gap:12px; border:2px solid ${MINT}; border-radius:999px; padding:12px 28px">
<p style="flex:1; font-size:32px; font-weight:600; line-height:1.3; color:${MINT}">Ver en Inicio</p>
${icon('arrow-right', MINT, 34, '')}
</div>
</div>
<div style="position:absolute; left:968px; top:808px; width:776px; height:80px; display:flex; align-items:center; gap:20px; background:${NAVY}; border:1px solid ${LINE}; border-radius:999px; padding:0px 14px 0px 32px">
<p style="flex:1; font-size:32px; line-height:1.3; color:${FOOT}">Escribile a Moni…</p>
<div style="width:56px; height:56px; border-radius:28px; background:${MINT}; display:flex; align-items:center; justify-content:center">${icon('mic', NAVY, 28, 'Hablarle a Moni')}</div>
</div>
${footer('08')}
<aside>Avanzar con clic: primero aparece la pregunta, después los puntitos de "escribiendo" y por último la respuesta con el atajo. Moni usa los datos reales de la cuenta, por eso dice el saldo con el nombre. En vivo se le puede preguntar "¿cómo pido un préstamo?" o "¿qué TNA tiene Reservas?".</aside>
</section>`

slides.end = `<section id="end" data-transition="fade" style="${SECTION.replace('padding:128px 128px 160px', 'padding:128px 128px 160px; align-items:center; justify-content:center; gap:48px')}">
${backdrop('bgCierre', 'Cards de la app Monix difuminadas de fondo')}
<img src="${img('logo')}" alt="Logo de Monix" style="width:440px; height:110px; object-fit:contain">
<h1 style="font-family:${DISPLAY}; font-size:96px; font-weight:800; line-height:1.1; letter-spacing:-1px; color:#FFFFFF; text-align:center">Probalo hoy</h1>
<div style="display:flex; align-items:center; gap:56px">
<img src="${img('qrSitio')}" alt="Código QR que abre monix-homebanking.vercel.app" style="width:380px; height:380px; object-fit:contain; border-radius:28px; box-shadow:0 30px 70px rgba(0,0,0,0.5)">
<div style="width:820px; display:flex; flex-direction:column; gap:22px">
<p style="font-size:36px; line-height:1.4; color:${SOFT}">Escaneá el código y abrí tu cuenta en</p>
<p style="font-family:${DISPLAY}; font-size:48px; font-weight:700; line-height:1.2; color:${MINT}">monix-homebanking.vercel.app</p>
<p style="font-size:36px; line-height:1.4; color:${SOFT}">Se instala como app en el celular, sin pasar por ninguna tienda.</p>
</div>
</div>
<p style="position:absolute; left:128px; bottom:64px; width:1664px; font-size:24px; font-weight:600; color:${MUTED}; text-align:center">¡Gracias! · Práctica Profesionalizante I · Maximiliano Turaglio · Diego Urenda</p>
<aside>Dejar el QR en pantalla mientras se abren las preguntas: quien lo escanee entra directo y puede registrarse en el momento, con el bono de bienvenida.</aside>
</section>`

for (const [id, html] of Object.entries(slides)) fs.writeFileSync(`${SLIDES}/${id}.html`, html + '\n')

// Vista previa: mismas reglas del lienzo (sin márgenes, border-box, sin notas)
const toLocal = (h) => h.replace(/\/_blob\/([0-9a-f]{32})/g, (_, id) => {
  const k = Object.keys(BLOB).find(x => BLOB[x] === id)
  return k === 'logo' ? `file:///${S}/deck-assets/logo-blanco.png` : `file:///${S}/${LOCAL[k]}`
})
const order = ['cover', 's01', 's02', 's03', 's04', 's05', 's06', 's07', 's08', 'end']
const page = `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap">
<style>body{margin:0;background:#000} section{position:relative;width:1920px;height:1080px;overflow:hidden;box-sizing:border-box} section *{margin:0;box-sizing:border-box} aside{display:none} section > :not([style*="position:absolute"]):not(aside){position:relative}</style>
${order.map(id => toLocal(slides[id])).join('\n')}`
fs.writeFileSync(`${PREV}/preview.html`, page)
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } })
await p.goto(`file:///${PREV}/preview.html`); await p.waitForTimeout(2500)
// Detecta texto que se sale de su caja o cajas que pisan el pie
const problemas = await p.evaluate(() => {
  const out = []
  document.querySelectorAll('section').forEach(sec => {
    const sr = sec.getBoundingClientRect()
    sec.querySelectorAll('p,h1,h2,h3').forEach(el => {
      if (el.scrollWidth > el.clientWidth + 2) out.push(`${sec.id}: desborda a lo ancho "${el.textContent.slice(0, 40)}"`)
      const r = el.getBoundingClientRect()
      if (r.bottom - sr.top > 925 &&!el.textContent.startsWith('Monix ·') && !/Gracias|Práctica/.test(el.textContent)) out.push(`${sec.id}: muy abajo (${Math.round(r.bottom - sr.top)}) "${el.textContent.slice(0, 40)}"`)
    })
    sec.querySelectorAll(':scope > div, :scope > img').forEach(el => {
      const r = el.getBoundingClientRect()
      if (el.style.position === 'absolute' && el.style.width !== '1920px' && r.bottom - sr.top > 925) out.push(`${sec.id}: caja pasa la línea 920 (${Math.round(r.bottom - sr.top)})`)
    })
  })
  return out
})
console.log(problemas.length ? problemas.join('\n') : 'sin desbordes')
for (const [i, id] of order.entries()) {
  const el = p.locator(`section#${id}`)
  await el.screenshot({ path: `${PREV}/${String(i).padStart(2, '0')}-${id}.png` })
}
await b.close()
console.log('listo')
