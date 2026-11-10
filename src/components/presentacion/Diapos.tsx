import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Bell, Bot, Check, CircleAlert, Clock, CreditCard, DollarSign, Eye, FileText, Fingerprint, LayoutGrid, Mail,
  QrCode, ReceiptText, Send, ShieldAlert, ShieldCheck, Smartphone, Snowflake, Sparkles, TrendingDown,
  TrendingUp, Users, Zap, type LucideIcon,
} from 'lucide-react'
import { MonixLogoNavbar } from '../MonixLogoNavbar'
import { ArcosTarjeta, ChipTarjeta, COLOR_ARCOS, FONDO_FRENTE, IsologoTarjeta, METAL, type VarianteTarjeta } from '../TarjetaPiezas'
import { formato, SUAVE, useContador } from '../pitch/EscenasPitch'

// Diapositivas de /presentacion. Cada una recibe el paso actual: lo que tiene `en={n}`
// aparece cuando el paso llega a n. El hilo es el de Alex (el mismo nombre que ve la
// cuenta de prueba): cuatro problemas en la diapo 2, y cada pantalla después muestra cuál
// de ellos resuelve, con el mismo ícono.

export type PropsDiapo = { paso: number }

// ---------------------------------------------------------------- Piezas comunes

const PROBLEMAS = {
  quieto: { Icono: TrendingDown, titulo: 'Su dinero queda quieto', texto: 'El sueldo se queda en la cuenta y pierde valor con los días.' },
  tiempo: { Icono: Clock, titulo: 'El banco le hace perder tiempo', texto: 'Turnos, filas y horarios para trámites que deberían llevar un minuto.' },
  apps: { Icono: LayoutGrid, titulo: 'Una app para cada cosa', texto: 'Una para pagar, otra para los dólares, otra para ahorrar con amigos.' },
  frena: { Icono: ShieldAlert, titulo: 'La seguridad lo frena', texto: 'Códigos y claves en cada paso, hasta para mirar el saldo.' },
} as const
type Problema = keyof typeof PROBLEMAS

function Aparece({ en, paso, children, className, demora = 0, x = 0, y = 40 }: {
  en: number; paso: number; children: ReactNode; className?: string; demora?: number; x?: number; y?: number
}) {
  const visible = paso >= en
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, x, y }}
      animate={visible ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, x, y }}
      transition={{ duration: 0.8, delay: visible ? demora : 0, ease: SUAVE }}
    >
      {children}
    </motion.div>
  )
}

/** Etiqueta arriba del título: qué problema de Alex resuelve esta pantalla. */
function Resuelve({ problema, texto }: { problema?: Problema; texto: string }) {
  const Icono: LucideIcon = problema ? PROBLEMAS[problema].Icono : Sparkles
  return <p className="d-resuelve"><Icono aria-hidden="true" />{texto}</p>
}

function Texto({ problema, resuelve, titulo, sub, items, paso, desde = 1, ancho }: {
  problema?: Problema; resuelve: string; titulo: ReactNode; sub?: string; items?: string[]; paso: number; desde?: number; ancho?: number
}) {
  return (
    <div className="d-texto" style={ancho ? { width: ancho } : undefined}>
      <Aparece en={0} paso={paso} y={20}><Resuelve problema={problema} texto={resuelve} /></Aparece>
      <Aparece en={0} paso={paso} demora={0.1}><h2 className="d-titulo">{titulo}</h2></Aparece>
      {sub && <Aparece en={0} paso={paso} demora={0.25}><p className="d-sub">{sub}</p></Aparece>}
      {items && (
        <ul className="d-lista">
          {items.map((t, i) => (
            <Aparece key={t} en={desde + i} paso={paso} x={-30} y={0}>
              <li><Check aria-hidden="true" strokeWidth={2.6} />{t}</li>
            </Aparece>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Celular con una captura real de la app (cuenta de prueba, modo oscuro). */
/** `barra`: color de la franja de arriba, igual al borde superior de la captura. */
function Celular({ src, alt, barra = '#0c2951', children }: { src: string; alt: string; barra?: string; children?: ReactNode }) {
  return (
    <div className="d-cel">
      <div style={{ perspective: 1800 }}>
        <motion.div
          initial={{ rotateX: 26, y: 70, opacity: 0 }}
          animate={{ rotateX: 0, y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 42, damping: 14, delay: 0.15 }}
        >
          <div className="p-flota">
            <div className="p-phone d-phone"><div className="p-pantalla" style={{ background: barra }}><img src={src} alt={alt} /></div></div>
          </div>
        </motion.div>
      </div>
      {children}
    </div>
  )
}

function Contador({ fin, duracion = 1, demora = 0, decimales = 0 }: { fin: number; duracion?: number; demora?: number; decimales?: number }) {
  const v = useContador(fin, duracion, 0, demora)
  return <>{formato(v, decimales)}</>
}

// ---------------------------------------------------------------- 1. Portada

export function DiapoPortada() {
  return (
    <div className="d-portada">
      <motion.div
        className="d-portada-logo"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.4, ease: SUAVE }}
      >
        <MonixLogoNavbar variant="white" className="w-full h-auto" />
      </motion.div>
      <motion.h2 className="d-portada-frase" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.7, ease: SUAVE }}>
        Banca de verdad, <b>desde tu celular.</b>
      </motion.h2>
      <motion.p className="d-portada-nombres" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 1.5 }}>
        Práctica Profesionalizante I · Maximiliano Turaglio · Diego Urenda
      </motion.p>
    </div>
  )
}

// ---------------------------------------------------------------- 2. El problema

export function DiapoProblema({ paso }: PropsDiapo) {
  return (
    <div className="d-col">
      <Aparece en={0} paso={paso} y={20}><p className="d-resuelve d-rojo"><CircleAlert aria-hidden="true" />El problema</p></Aparece>
      <Aparece en={0} paso={paso} demora={0.1}><h2 className="d-titulo d-centro">Esto le pasa a Alex.</h2></Aparece>
      <Aparece en={0} paso={paso} demora={0.25}><p className="d-sub d-centro">Y seguro a alguno de ustedes también.</p></Aparece>
      <div className="d-dolores">
        {(Object.keys(PROBLEMAS) as Problema[]).map((k, i) => {
          const { Icono, titulo, texto } = PROBLEMAS[k]
          return (
            <Aparece key={k} en={i + 1} paso={paso} className="d-dolor">
              <span className="d-dolor-ico"><Icono aria-hidden="true" /></span>
              <b>{titulo}</b>
              <span>{texto}</span>
            </Aparece>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 3. La solución

const PILARES: { problema: Problema; Icono: LucideIcon; titulo: string; texto: string }[] = [
  { problema: 'quieto', Icono: TrendingUp, titulo: 'Rinde', texto: '32% anual desde el primer día.' },
  { problema: 'tiempo', Icono: Zap, titulo: 'Rápido', texto: 'Cuenta en minutos y operás las 24 horas.' },
  { problema: 'apps', Icono: LayoutGrid, titulo: 'Todo junto', texto: 'Pesos, dólares, QR, préstamos y ahorro.' },
  { problema: 'frena', Icono: ShieldCheck, titulo: 'Seguro', texto: 'Te cuida sin frenarte.' },
]

export function DiapoSolucion({ paso }: PropsDiapo) {
  return (
    <>
      <div className="d-texto" style={{ width: 980 }}>
        <Aparece en={0} paso={paso} y={20}><p className="d-resuelve"><Sparkles aria-hidden="true" />La solución</p></Aparece>
        <Aparece en={0} paso={paso} demora={0.1}><h2 className="d-titulo d-titulo-chico">Monix: un banco completo, <b>en el celular.</b></h2></Aparece>
        <div className="d-pilares">
          {PILARES.map(({ problema, Icono, titulo, texto }, i) => (
            <Aparece key={titulo} en={i + 1} paso={paso} className="d-pilar">
              <span className="d-pilar-antes">{PROBLEMAS[problema].titulo}</span>
              <span className="d-pilar-ico"><Icono aria-hidden="true" /></span>
              <b>{titulo}</b>
              <span>{texto}</span>
            </Aparece>
          ))}
        </div>
      </div>
      <Celular src="/presentacion/inicio.jpg" alt="Inicio de la app Monix con el saldo y lo que rindió hoy" />
    </>
  )
}

// ---------------------------------------------------------------- 4. Abrir la cuenta

export function DiapoCuenta({ paso }: PropsDiapo) {
  return (
    <>
      <Texto
        paso={paso}
        problema="tiempo"
        resuelve="Chau filas y papeles"
        titulo={<>Tu cuenta, <b>lista en minutos.</b></>}
        items={['Tres pasos desde el celular', 'CBU y alias propios al terminar', 'Después entrás con tu huella']}
      />
      <Celular barra="#001a3d" src="/presentacion/registro.jpg" alt="Registro de Monix: el primer paso pide email y contraseña">
        <Aparece en={4} paso={paso} className="d-fl-pos" y={60}>
          <div className="p-fl-i d-fl" style={{ top: 624 }}>
            <div className="ico"><Sparkles strokeWidth={2.2} /></div>
            <div><small>De regalo al abrirla</small><b className="m">$ {paso >= 4 ? <Contador fin={150000} /> : '0'}</b></div>
          </div>
        </Aparece>
      </Celular>
    </>
  )
}

// ---------------------------------------------------------------- 5. Tu dinero rinde

// Lo que rinden $ 150.000 (el regalo de bienvenida) por día al 32 % anual: 150.000 × 0,32 / 365.
const POR_DIA_REGALO = Math.floor((150000 * 0.32) / 365)

export function DiapoRinde({ paso }: PropsDiapo) {
  const tasa = useContador(32, 1.1, 0, 0.3)
  return (
    <>
      <div className="d-texto">
        <Aparece en={0} paso={paso} y={20}><Resuelve problema="quieto" texto="Tu dinero deja de estar quieto" /></Aparece>
        <Aparece en={0} paso={paso} demora={0.1}><h2 className="d-titulo">Tu dinero rinde <b>todos los días.</b></h2></Aparece>
        <Aparece en={0} paso={paso} demora={0.2}>
          <p className="d-dato">{Math.round(tasa)}%<small>anual</small></p>
        </Aparece>
        <ul className="d-lista">
          <Aparece en={1} paso={paso} x={-30} y={0}><li><Check aria-hidden="true" strokeWidth={2.6} />En tu cuenta y en Reservas</li></Aparece>
          <Aparece en={2} paso={paso} x={-30} y={0}><li><Check aria-hidden="true" strokeWidth={2.6} />Sin activar nada: rinde solo</li></Aparece>
        </ul>
      </div>
      <Celular src="/presentacion/reservas.jpg" alt="Pantalla de Reservas con el saldo, la TNA de 32 % y lo que rinde por día">
        <Aparece en={3} paso={paso} className="d-fl-pos" y={60}>
          <div className="p-fl-i d-fl" style={{ top: 620 }}>
            <div className="ico"><TrendingUp strokeWidth={2.4} /></div>
            <div><small>Con $ 150.000, por día</small><b className="m">+$ {POR_DIA_REGALO}</b></div>
          </div>
        </Aparece>
      </Celular>
    </>
  )
}

// ---------------------------------------------------------------- 6. Dólares

export function DiapoDolares({ paso }: PropsDiapo) {
  return (
    <>
      <Texto
        paso={paso}
        problema="apps"
        resuelve="Sin salir de la app"
        titulo={<>Dólares al <b>precio oficial.</b></>}
        items={['Abrís tu caja en dólares desde la app', 'Ves cuánto pagás antes de confirmar', 'Y los vendés igual de rápido']}
      />
      <Celular src="/presentacion/dolares.jpg" alt="Compra de dólares: US$ 100 a pagar $ 157.000 al dólar oficial">
        <Aparece en={4} paso={paso} className="d-fl-pos" y={60}>
          <div className="p-fl-i d-fl" style={{ top: 288 }}>
            <div className="ico"><DollarSign strokeWidth={2.4} /></div>
            <div><small>US$ 100 hoy</small><b className="m">$ {paso >= 4 ? <Contador fin={157000} /> : '0'}</b></div>
          </div>
        </Aparece>
      </Celular>
    </>
  )
}

// ---------------------------------------------------------------- 7. QR y transferencias

/** QR de adorno: patrón fijo con los tres cuadrados de esquina. No se puede escanear. */
function QrAdorno() {
  const n = 25
  const celdas: ReactNode[] = []
  const esquina = (x: number, y: number) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (esquina(x, y)) continue
      if (((x * 73856093) ^ (y * 19349663) ^ (x * y * 83492791)) % 7 < 3) celdas.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />)
    }
  }
  const marco = (x: number, y: number) => (
    <g key={`m${x}${y}`}>
      <rect x={x + 0.5} y={y + 0.5} width="6" height="6" fill="none" stroke="#001a3d" strokeWidth="1" />
      <rect x={x + 2} y={y + 2} width="3" height="3" />
    </g>
  )
  return (
    <svg viewBox={`-1 -1 ${n + 2} ${n + 2}`} className="d-qr-svg" aria-hidden="true" fill="#001a3d" shapeRendering="crispEdges">
      {celdas}
      {marco(0, 0)}{marco(n - 7, 0)}{marco(0, n - 7)}
    </svg>
  )
}

export function DiapoPagos({ paso }: PropsDiapo) {
  return (
    <>
      <Texto
        paso={paso}
        problema="tiempo"
        resuelve="En segundos, las 24 horas"
        ancho={700}
        titulo={<>Cobrá con QR y <b>transferí al toque.</b></>}
        items={['QR de banco a banco', 'Por CBU o alias, a cualquier banco', 'El comprobante, listo para WhatsApp']}
      />
      <div className="d-pagos">
        <motion.div className="d-qr-card" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 60, damping: 13, delay: 0.2 }}>
          <p className="d-qr-tit"><QrCode aria-hidden="true" />Cobrar con QR</p>
          <div className="d-qr-blanco"><QrAdorno /></div>
          <p className="d-qr-monto">$ 12.500,00</p>
        </motion.div>
        <div className="d-avisos">
          <Aparece en={1} paso={paso} className="d-aviso-app" y={30}>
            <span className="ico"><Check strokeWidth={2.6} /></span>
            <div><small>Cobro acreditado</small><b className="m">+$ 12.500,00</b></div>
          </Aparece>
          <Aparece en={2} paso={paso} className="d-aviso-app" y={30}>
            <span className="ico"><Send strokeWidth={2.2} /></span>
            <div><small>Transferencia enviada</small><b>$ 25.000,00</b></div>
          </Aparece>
          <Aparece en={3} paso={paso} className="d-aviso-app" y={30}>
            <span className="ico"><FileText strokeWidth={2.2} /></span>
            <div><small>Comprobante en PDF</small><b>Por WhatsApp</b></div>
          </Aparece>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- 8. Préstamos

export function DiapoPrestamos({ paso }: PropsDiapo) {
  return (
    <>
      <Texto
        paso={paso}
        resuelve="Sin sorpresas"
        titulo={<>Conocé la cuota <b>antes de pedirlo.</b></>}
        items={['Cuota fija y el detalle mes a mes', 'Con tu sueldo en Monix, mejor tasa', 'El dinero cae al instante en tu cuenta']}
      />
      <Celular src="/presentacion/prestamos.jpg" alt="Simulador de préstamos: $ 500.000 en 6 cuotas de $ 101.948">
        <Aparece en={4} paso={paso} className="d-fl-pos" y={60}>
          <div className="p-fl-i d-fl" style={{ top: 860 }}>
            <div className="ico"><ReceiptText strokeWidth={2.2} /></div>
            <div><small>$ 500.000 en 6 cuotas</small><b className="m">$ {paso >= 4 ? <Contador fin={101948} /> : '0'}<i className="d-xmes"> por mes</i></b></div>
          </div>
        </Aparece>
      </Celular>
    </>
  )
}

// ---------------------------------------------------------------- 9. Metas en grupo

const INTEGRANTES = [
  { nombre: 'Alex', puso: 180000, color: '#26ffc1' },
  { nombre: 'Juli', puso: 150000, color: '#4fa3ff' },
  { nombre: 'Tomi', puso: 120000, color: '#ffc857' },
  { nombre: 'Cami', puso: 50000, color: '#b08cff' },
]
const OBJETIVO_META = 800000
const JUNTADO = INTEGRANTES.reduce((s, i) => s + i.puso, 0)

export function DiapoMetas({ paso }: PropsDiapo) {
  const reducir = useReducedMotion()
  return (
    <>
      <Texto
        paso={paso}
        problema="apps"
        resuelve="Sin planillas ni cuentas a mano"
        titulo={<>Ahorrar <b>en grupo.</b></>}
        sub="Para un viaje, un regalo o el alquiler."
        items={['Compartís un código y los demás se suman', 'Todos ven quién puso cuánto, y el dinero rinde', 'Para usarlo, lo aprueba la mayoría']}
      />
      <motion.div className="d-meta" initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 50, damping: 14, delay: 0.2 }}>
        <div className="d-meta-cab">
          <span className="d-meta-ico"><Users aria-hidden="true" /></span>
          <div><b>Viaje a Bariloche</b><small>4 integrantes · rinde 32% anual</small></div>
        </div>
        <p className="d-meta-monto">$ <Contador fin={JUNTADO} duracion={1.1} demora={0.4} /><small> de $ {formato(OBJETIVO_META)}</small></p>
        <div className="d-meta-barra">
          <motion.i
            initial={{ width: reducir ? `${(JUNTADO / OBJETIVO_META) * 100}%` : '0%' }}
            animate={{ width: `${(JUNTADO / OBJETIVO_META) * 100}%` }}
            transition={{ duration: 1.1, delay: 0.4, ease: SUAVE }}
          />
        </div>
        <ul className="d-meta-lista">
          {INTEGRANTES.map((p, i) => (
            <motion.li key={p.nombre} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 + i * 0.25, duration: 0.6, ease: SUAVE }}>
              <span className="d-avatar" style={{ background: p.color }}>{p.nombre[0]}</span>
              {p.nombre}
              <b>$ {formato(p.puso)}</b>
            </motion.li>
          ))}
        </ul>
        <Aparece en={3} paso={paso} className="d-meta-voto" y={20}>
          <Check aria-hidden="true" strokeWidth={2.6} />Pagar el hotel · 3 de 4 aprobaron
        </Aparece>
      </motion.div>
    </>
  )
}

// ---------------------------------------------------------------- 10. Tarjeta

// Las de la Landing, con el titular y el número de débito de la cuenta de prueba.
const TARJETAS: { variante: VarianteTarjeta; pan: string; etiqueta: string; pestaña: string }[] = [
  { variante: 'ars', pan: '4532  ••••  ••••  2201', etiqueta: 'DÉBITO', pestaña: 'Pesos' },
  { variante: 'usd', pan: '5591  ••••  ••••  7730', etiqueta: 'DÉBITO USD', pestaña: 'Dólares' },
  { variante: 'credito', pan: '4970  ••••  ••••  1408', etiqueta: 'CRÉDITO', pestaña: 'Crédito' },
]

const CASHBACK = [
  { pct: 8, donde: 'Nuestra tienda' },
  { pct: 5, donde: 'Combustible' },
  { pct: 3, donde: 'Restaurantes' },
]

function Tarjetas() {
  const reducir = useReducedMotion()
  const [k, setK] = useState(0)
  useEffect(() => {
    if (reducir) return
    const id = setInterval(() => setK((v) => (v + 1) % TARJETAS.length), 3400)
    return () => clearInterval(id)
  }, [reducir])
  return (
    <div className="d-tarjetas">
      <div className="p-tj-escena">
        <div className="p-tj-w">
          <div className="p-tjs d-tjs">
            {TARJETAS.map((t, j) => (
              <motion.div
                key={t.variante}
                className="p-tj"
                style={{ background: FONDO_FRENTE[t.variante] }}
                initial={false}
                animate={j === k ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 14, scale: 0.98 }}
                transition={j === k ? { duration: 1.1, delay: 0.25, ease: SUAVE } : { duration: 0.4, ease: 'easeOut' }}
              >
                <div className="p-tj-cepillo" />
                <ArcosTarjeta color={COLOR_ARCOS[t.variante]} />
                <div className="p-tj-brillo" />
                <IsologoTarjeta className="absolute left-[5.6%] top-[9%] h-[17%] w-auto" />
                <ChipTarjeta metal={METAL[t.variante]} className="absolute right-[6.5%] top-[11%] w-[11.2%]" />
                <div className="p-tj-pie">
                  <p className="p-tj-num">{t.pan}</p>
                  <div className="p-tj-fila"><span>ALEX ROMERO</span><span>{t.etiqueta}</span></div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      <div className="p-tabs d-tabs">
        {TARJETAS.map((t, j) => (
          <span key={t.variante} className={j === k ? 'on' : ''}>
            {j === k && <motion.i layoutId="d-tab" className="p-tab-fondo" transition={{ type: 'spring', stiffness: 220, damping: 26 }} />}
            <em>{t.pestaña}</em>
          </span>
        ))}
      </div>
    </div>
  )
}

export function DiapoTarjeta({ paso }: PropsDiapo) {
  return (
    <>
      <div className="d-texto" style={{ width: 760 }}>
        <Aparece en={0} paso={paso} y={20}><Resuelve texto="Beneficios en cada compra" /></Aparece>
        <Aparece en={0} paso={paso} demora={0.1}><h2 className="d-titulo">Pagás con la tarjeta <b>y parte vuelve.</b></h2></Aparece>
        <div className="d-cashback">
          {CASHBACK.map((c, i) => (
            <Aparece key={c.donde} en={i + 1} paso={paso} className="d-cb">
              <b>{c.pct}%</b><span>{c.donde}</span>
            </Aparece>
          ))}
        </div>
        <Aparece en={4} paso={paso} x={-30} y={0}>
          <p className="d-nota-linea"><Snowflake aria-hidden="true" />¿La perdiste? La congelás al toque.</p>
        </Aparece>
      </div>
      <Tarjetas />
    </>
  )
}

// ---------------------------------------------------------------- 11. Moni y Mis gastos

export function DiapoMoni({ paso }: PropsDiapo) {
  const reducir = useReducedMotion()
  const [escribiendo, setEscribiendo] = useState(false)
  const [respondio, setRespondio] = useState(paso >= 2)
  useEffect(() => {
    if (paso < 2) { setRespondio(false); return }
    if (respondio) return
    if (reducir) { setRespondio(true); return }
    setEscribiendo(true)
    const id = setTimeout(() => { setEscribiendo(false); setRespondio(true) }, 1300)
    return () => clearTimeout(id)
  }, [paso, respondio, reducir])

  return (
    <>
      <Texto
        paso={paso}
        resuelve="Te orienta"
        ancho={640}
        titulo={<>Moni te responde <b>al toque.</b></>}
        sub="Le escribís como a una persona y te dice en qué se va tu dinero."
      />
      <div className="d-moni-zona">
        <motion.div className="d-chat" initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.9, delay: 0.4, ease: SUAVE }}>
          <div className="d-chat-cab"><span className="d-chat-ava"><Bot aria-hidden="true" /></span><div><b>Moni</b><small>En línea</small></div></div>
          <div className="d-chat-cuerpo">
            <Aparece en={1} paso={paso} className="d-burbuja yo" y={20}>¿En qué gasté más este mes?</Aparece>
            {/* La respuesta ocupa su lugar desde el principio (invisible), así el globo no cambia
                de tamaño cuando aparece; los puntitos se dibujan encima, en el mismo lugar. */}
            <div className="d-respuesta">
              <AnimatePresence>
                {escribiendo && (
                  <motion.div key="puntos" className="d-burbuja moni d-puntos" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <i /><i /><i />
                  </motion.div>
                )}
              </AnimatePresence>
              <motion.div
                className="d-burbuja moni"
                aria-hidden={!respondio}
                initial={false}
                animate={respondio ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ duration: respondio ? 0.6 : 0, ease: SUAVE }}
              >
                Gastaste <b>$ 228.600</b>. Lo que más pesó fue Vivienda: $ 95.000.
                <span className="d-chat-boton">Ver mis gastos</span>
              </motion.div>
            </div>
          </div>
        </motion.div>
        <Celular src="/presentacion/gastos.jpg" alt="Mis gastos: $ 228.600 en el mes, Vivienda se llevó el 42 %" />
      </div>
    </>
  )
}

// ---------------------------------------------------------------- 12. Seguridad

const SEGURIDAD: { Icono: LucideIcon; titulo: string; texto: string }[] = [
  { Icono: Fingerprint, titulo: 'Huella', texto: 'Entrás con tu huella o tu rostro, sin códigos.' },
  { Icono: Mail, titulo: 'Avisos', texto: 'Si cambia tu clave o tu mail, te avisamos.' },
  { Icono: Smartphone, titulo: 'Dispositivos', texto: 'Ves dónde está abierta tu cuenta y la cerrás.' },
  { Icono: ShieldCheck, titulo: 'Dos pasos', texto: 'Opcional, sólo para lo importante.' },
]

export function DiapoSeguridad({ paso }: PropsDiapo) {
  return (
    <div className="d-col">
      <Aparece en={0} paso={paso} y={20}><Resuelve problema="frena" texto="La seguridad deja de frenarte" /></Aparece>
      <Aparece en={0} paso={paso} demora={0.1}><h2 className="d-slogan">Seguridad que <b>no te frena.</b></h2></Aparece>
      <div className="d-seg">
        {SEGURIDAD.map(({ Icono, titulo, texto }, i) => (
          <Aparece key={titulo} en={i + 1} paso={paso} className="d-seg-t">
            <Icono aria-hidden="true" strokeWidth={1.7} />
            <b>{titulo}</b>
            <span>{texto}</span>
          </Aparece>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- 13. Por qué elegirnos

// Plazo fijo: tasa de depósitos a 30 días en entidades financieras, BCRA (serie 12 de
// sus estadísticas monetarias), 21,18 % al 4 de noviembre de 2026.
const PLAZO_FIJO = 21.2

export function DiapoPorque({ paso }: PropsDiapo) {
  const reducir = useReducedMotion()
  const barra = (pct: number, demora: number) => ({
    initial: { width: reducir ? `${(pct / 32) * 100}%` : '0%' },
    animate: { width: `${(pct / 32) * 100}%` },
    transition: { duration: 1.6, delay: demora, ease: SUAVE },
  })
  return (
    <div className="d-col">
      <Aparece en={0} paso={paso} y={20}><p className="d-resuelve"><Sparkles aria-hidden="true" />Por qué elegirnos</p></Aparece>
      <Aparece en={0} paso={paso} demora={0.1}><h2 className="d-titulo d-centro d-titulo-chico">Un banco completo, <b>sin lo que molesta.</b></h2></Aparece>
      <div className="d-bento">
        <Aparece en={0} paso={paso} demora={0.3} className="d-b d-b-grande">
          <span className="d-b-ico"><TrendingUp aria-hidden="true" /></span>
          <b>Rinde más</b>
          <div className="d-barras">
            <p>Monix <strong>32%</strong></p>
            <div className="d-barra"><motion.i className="m" {...barra(32, 0.6)} /></div>
            <p>Plazo fijo a 30 días <strong>{formato(PLAZO_FIJO, 1)}%</strong></p>
            <div className="d-barra"><motion.i {...barra(PLAZO_FIJO, 0.9)} /></div>
          </div>
          <p className="d-b-anio">Con $ 150.000, en un año ganás unos <strong>$ {formato(150000 * 0.32)}</strong> en Monix contra $ {formato(150000 * PLAZO_FIJO / 100)} en un plazo fijo.</p>
        </Aparece>
        <Aparece en={1} paso={paso} className="d-b"><span className="d-b-ico"><Zap aria-hidden="true" /></span><b>Sin filas</b><span>Todo desde el celular, a cualquier hora.</span></Aparece>
        <Aparece en={2} paso={paso} className="d-b"><span className="d-b-ico"><CreditCard aria-hidden="true" /></span><b>Todo junto</b><span>Pesos, dólares, QR, préstamos y tarjeta.</span></Aparece>
        <Aparece en={3} paso={paso} className="d-b"><span className="d-b-ico"><Eye aria-hidden="true" /></span><b>Te orienta</b><span>Mis gastos y Moni te dicen en qué se va tu dinero.</span></Aparece>
        <Aparece en={4} paso={paso} className="d-b"><span className="d-b-ico"><ShieldCheck aria-hidden="true" /></span><b>Seguridad que no te frena</b><span>Huella, avisos y control de dispositivos.</span></Aparece>
      </div>
      <p className="d-fuente">Plazo fijo: tasa promedio de depósitos a 30 días en entidades financieras. Fuente: BCRA, 4 de noviembre de 2026.</p>
    </div>
  )
}

// ---------------------------------------------------------------- 14. Probalo

export function DiapoProbalo() {
  return (
    <>
      <div className="d-texto" style={{ width: 900 }}>
        <motion.p className="d-resuelve" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: SUAVE }}>
          <Bell aria-hidden="true" />Alex ya lo usa. ¿Y vos?
        </motion.p>
        <motion.h2 className="d-cta" initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1.1, delay: 0.1, ease: SUAVE }}>
          ¡Probalo <b>ahora!</b>
        </motion.h2>
        <motion.p className="d-sub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.5 }}>
          Escaneá el código y recorré la app por dentro, sin registrarte. El dinero es de ejemplo: probá sin miedo.
        </motion.p>
        <motion.p className="d-gracias" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 1 }}>
          ¡Gracias! · Maximiliano Turaglio · Diego Urenda
        </motion.p>
      </div>
      <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 60, damping: 12, delay: 0.3 }}>
        <div className="p-qr d-qr-final"><img src="/pitch/qr-prueba.png" alt="Código QR para probar Monix sin registrarse" /></div>
      </motion.div>
    </>
  )
}

// ---------------------------------------------------------------- Orden y guion

export type Diapo = {
  id: string
  titulo: string
  Diapo: ComponentType<PropsDiapo>
  /** Cuántos clics tiene adentro antes de pasar a la siguiente. */
  pasos: number
  centro?: boolean
  quien: 'DIEGO' | 'MAXI'
  notas: string
}

export const DIAPOS: Diapo[] = [
  {
    id: 'portada', titulo: 'Portada', Diapo: DiapoPortada, pasos: 0, centro: true, quien: 'DIEGO',
    notas: 'Buenas tardes, ¿cómo están? Somos Diego y Maxi, y venimos a presentarles Monix. Antes de arrancar, una pregunta: ¿cuándo fue la última vez que fueron a una sucursal? ¿Y cuánto esperaron hasta que los atendieron?',
  },
  {
    id: 'problema', titulo: 'El problema', Diapo: DiapoProblema, pasos: 4, centro: true, quien: 'DIEGO',
    notas: 'Les presentamos a Alex. Tiene veintipico, trabaja y cobra el sueldo en un banco de siempre. [Clic] El sueldo queda en la cuenta y, con los días, vale menos. [Clic] Para cualquier trámite: turno, fila y horario de banco. [Clic] Tiene una app para pagar, otra para los dólares y una planilla con los amigos para el viaje. [Clic] Y cuando quiere hacer algo rápido, le piden un código tras otro. Monix nació para resolver estas cuatro cosas.',
  },
  {
    id: 'solucion', titulo: 'La solución', Diapo: DiapoSolucion, pasos: 4, quien: 'DIEGO',
    notas: 'Monix es un banco completo en el celular. Cada problema de Alex tiene su respuesta. [Clic] El dinero quieto: acá rinde 32% anual desde el primer día. [Clic] El tiempo perdido: la cuenta se abre en minutos y todo funciona las 24 horas. [Clic] Las mil apps: pesos, dólares, QR, préstamos y ahorro, todo junto. [Clic] Y la seguridad que frena: te cuida sin pedirte un código para cada cosa. Ahora les mostramos cómo.',
  },
  {
    id: 'cuenta', titulo: 'Tu cuenta, lista en minutos', Diapo: DiapoCuenta, pasos: 4, quien: 'DIEGO',
    notas: 'Todo empieza abriendo la cuenta, y eso lleva un par de minutos. [Clic] Ponés tu email, completás tus datos y aceptás, sin papeles ni turnos. [Clic] Cuando terminás ya tenés tu CBU y tu alias. [Clic] Y para entrar después usás la huella o el rostro, sin acordarte de nada. [Clic] Además, al abrirla te regalamos 150.000 pesos.',
  },
  {
    id: 'rinde', titulo: 'Tu dinero rinde', Diapo: DiapoRinde, pasos: 3, quien: 'DIEGO',
    notas: 'Acá se termina el dinero quieto. La cuenta rinde un 32% anual desde el primer día. [Clic] Rinde en la cuenta y en Reservas, que es un bolsillo para ahorrar aparte. [Clic] No hay que activar nada: rinde solo, y cada vez que abrís la app ves cuánto ganaste hoy. [Clic] Con los 150.000 del regalo, son unos 131 pesos por día, sin hacer nada.',
  },
  {
    id: 'dolares', titulo: 'Dólares al precio oficial', Diapo: DiapoDolares, pasos: 4, quien: 'DIEGO',
    notas: '¿Quieren dólares? Sin cuevas y sin otra app. [Clic] Abrís tu caja en dólares desde Monix. [Clic] Ponés cuánto querés comprar y te muestra cuánto vas a pagar antes de confirmar. [Clic] Y si mañana los necesitás en pesos, los vendés igual de rápido. [Clic] Hoy, 100 dólares son 157.000 pesos. Y para mover todo ese dinero, le paso a Maxi.\n\nEL NÚMERO. Precio del 4 de noviembre ($ 1.570 por dólar). Si cambió el día de la presentación, decir "alrededor de".',
  },
  {
    id: 'pagos', titulo: 'QR y transferencias', Diapo: DiapoPagos, pasos: 3, quien: 'MAXI',
    notas: 'Gracias, Diego. Cobrar y pagar tiene que ser instantáneo. Generás un QR, con monto fijo o libre, y te pagan desde Monix o desde cualquier otro banco de la red. [Clic] Apenas te pagan, te avisa: cobro acreditado, sin recargar nada. [Clic] Para transferir ponés el CBU o el alias, la app te muestra a quién le mandás antes de confirmar, y llega en el momento. [Clic] Y el comprobante sale en PDF: en el celular lo mandás directo por WhatsApp.\n\nDEMO EN VIVO (si hay tiempo). Generar un QR y que alguien lo pague desde otro banco del curso.',
  },
  {
    id: 'metas', titulo: 'Ahorrar en grupo', Diapo: DiapoMetas, pasos: 3, quien: 'MAXI',
    notas: '¿Se acuerdan de la planilla de Alex para el viaje? Una meta común es una bolsa compartida. [Clic] Uno la crea y pasa el código, y los demás se suman desde su cuenta. [Clic] Todos ven quién puso cuánto, y mientras está juntado, el dinero rinde. [Clic] Para sacarlo, alguien propone pagar o devolver y lo aprueba la mayoría. Si se devuelve, cada uno recibe lo que puso más el interés.',
  },
  {
    id: 'moni', titulo: 'Moni y Mis gastos', Diapo: DiapoMoni, pasos: 2, quien: 'MAXI',
    notas: 'Y para que nunca te pierdas, está Moni. [Clic] Le preguntás "¿en qué gasté más este mes?" [Clic] y te responde con tus números y te lleva a la pantalla justa. Mis gastos ordena todo por concepto con el motivo de cada transferencia. Reservas y dólares no cuentan como gasto, porque ese dinero sigue siendo tuyo. Y si un día necesitás dinero extra, Diego les cuenta cómo.\n\nEN VIVO. Se le puede preguntar "¿cómo pido un préstamo?" o "¿qué TNA tiene Reservas?".',
  },
  {
    id: 'prestamos', titulo: 'Préstamos', Diapo: DiapoPrestamos, pasos: 4, quien: 'DIEGO',
    notas: 'Gracias, Maxi. Pedir un préstamo no debería ser una sorpresa. Elegís cuánto y en cuántas cuotas, y la app te dice exactamente cuánto vas a pagar. [Clic] La cuota es fija y ves el detalle mes a mes. [Clic] Si cobrás el sueldo en Monix, la tasa baja 12 puntos. [Clic] Lo confirmás y el dinero cae al instante en tu cuenta. [Clic] Por ejemplo: 500.000 pesos en 6 cuotas, unos 102.000 por mes.\n\nSI PREGUNTAN POR LAS TASAS. La captura es con sueldo en Monix: TNA 73%. Sin sueldo arranca en 85% para un cliente sin deudas, y sube según la central de deudores: 93%, 103% o 115%. Quien tiene deudas de más de un año sin pagar no puede pedir préstamo.',
  },
  {
    id: 'tarjeta', titulo: 'Tarjeta y cashback', Diapo: DiapoTarjeta, pasos: 4, quien: 'DIEGO',
    notas: 'Con la débito de Monix, cada compra te devuelve algo. [Clic] 8% en nuestra tienda, [Clic] 5% en combustible [Clic] y 3% en restaurantes. También hay promos en súper, cines y viajes. [Clic] Y si la perdés, no llamás a nadie: la congelás con un toque y la reactivás igual de rápido.',
  },
  {
    id: 'seguridad', titulo: 'Seguridad que no te frena', Diapo: DiapoSeguridad, pasos: 4, centro: true, quien: 'DIEGO',
    notas: 'El último problema de Alex era la seguridad que frena. Nuestra idea: seguridad que no te frena. [Clic] Entrás con la huella o el rostro, sin códigos. [Clic] Si alguien cambia tu contraseña, tu mail o la verificación en dos pasos, te llega un aviso por mail. [Clic] En tu perfil ves en qué dispositivos está abierta tu cuenta, con la ciudad, y la cerrás a distancia. [Clic] Y la verificación en dos pasos es opcional: nunca se pide para entrar, sólo para lo importante, como cambiar la contraseña o el mail.\n\nNO PROMETER DE MÁS. No decir "nadie más puede entrar".',
  },
  {
    id: 'porque', titulo: 'Por qué elegirnos', Diapo: DiapoPorque, pasos: 4, centro: true, quien: 'DIEGO',
    notas: 'Si tuviéramos que convencerlos en cinco frases: rinde más, 32% anual contra el 21% que paga hoy un plazo fijo a 30 días, según el Banco Central. [Clic] Sin filas: todo desde el celular, a cualquier hora. [Clic] Todo junto: pesos, dólares, QR, préstamos y tarjeta. [Clic] Te orienta: Mis gastos y Moni te dicen en qué se va tu dinero. [Clic] Y seguridad que no te frena.\n\nSI PREGUNTAN. Monix es un proyecto de la carrera y funciona contra el Banco Central de la cátedra, con los bancos del curso: no es un banco habilitado. El 32% es la tasa del producto dentro de ese sistema. No competir por tasa de préstamo: el promedio del mercado ronda 70% y el nuestro arranca en 85%.',
  },
  {
    id: 'probalo', titulo: '¡Probalo ahora!', Diapo: DiapoProbalo, pasos: 0, quien: 'DIEGO',
    notas: 'Alex ya resolvió sus cuatro problemas. Ahora les toca a ustedes: saquen el celular y escaneen el código. Entran sin registrarse y los guiamos paso a paso. Pueden comprar dólares, pedir un préstamo, ahorrar en Reservas y transferir, y ver cómo cambian el saldo, el historial y las estadísticas. El dinero es de ejemplo y al salir se borra todo. Y se instala como cualquier app, sin pasar por una tienda. Muchas gracias. Dejamos el código en pantalla mientras respondemos sus preguntas.\n\nQUÉ SE PUEDE EN LA PRUEBA. Reservas, dólares, préstamos, transferencias (a maria.gomez.monix), Historial y Mis gastos funcionan con dinero de ejemplo. "Simular un mes" acredita intereses y cobra cuotas. QR y tarjeta se recorren pero no confirman. Metas, Tienda, Perfil, Promos y Cashback invitan a registrarse.',
  },
]
