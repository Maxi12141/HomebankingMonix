import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { animate, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight, ArrowRightLeft, Bell, Bot, Check, ChartPie, CreditCard, DollarSign, Fingerprint,
  HandCoins, Landmark, LayoutDashboard, Mail, Menu, MessageSquare, PiggyBank, QrCode, Shield,
  ShieldCheck, Smartphone, Sun,
} from 'lucide-react'
import { MonixLogoNavbar } from '../MonixLogoNavbar'
import { ArcosTarjeta, ChipTarjeta, COLOR_ARCOS, FONDO_FRENTE, IsologoTarjeta, METAL, type VarianteTarjeta } from '../TarjetaPiezas'

// Escenas de la pauta de /pitch. Cada una se monta al entrar, así sus animaciones
// arrancan de cero; el orden y la duración los maneja PitchPage.

const SUAVE: [number, number, number, number] = [0.2, 0.7, 0.2, 1]

function formato(n: number, dec = 0) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

/** Número que sube desde `desde` hasta `fin` al montarse. */
function useContador(fin: number, duracion = 2.4, desde = 0, demora = 0) {
  const reducir = useReducedMotion()
  const [valor, setValor] = useState(reducir ? fin : desde)
  useEffect(() => {
    if (reducir) { setValor(fin); return }
    const c = animate(desde, fin, { duration: duracion, delay: demora, ease: SUAVE, onUpdate: setValor })
    return () => c.stop()
  }, [fin, duracion, desde, demora, reducir])
  return valor
}

function Ripple({ tamaños, top = '50%', left = '50%' }: { tamaños: number[]; top?: string; left?: string }) {
  return (
    <div className="p-ripple" aria-hidden="true" style={{ top, left }}>
      {tamaños.map((t, i) => <i key={t} style={{ width: t, height: t, animationDelay: `${i * 0.7}s` }} />)}
    </div>
  )
}

// ---------------------------------------------------------------- 1. Marca

const ORBITA = [
  { nombre: 'Transferir', Icono: ArrowRight },
  { nombre: 'Tarjeta', Icono: CreditCard },
  { nombre: 'Dólares', Icono: DollarSign },
  { nombre: 'Préstamos', Icono: HandCoins },
  { nombre: 'Gastos', Icono: ChartPie },
  { nombre: 'Moni', Icono: MessageSquare },
  { nombre: 'Seguridad', Icono: Shield },
]

export function EscenaMarca() {
  return (
    <>
      <div className="p-orbita" aria-hidden="true">
        <Ripple tamaños={[560, 760, 960]} />
        <div className="p-anillo">
          {ORBITA.map(({ nombre, Icono }, i) => {
            const a = (i / ORBITA.length) * Math.PI * 2 - Math.PI / 2
            return (
              <div key={nombre} className="p-it" style={{ transform: `translate(${Math.cos(a) * 460}px, ${Math.sin(a) * 460}px)` }}>
                <div><div className="p-chip-orbita"><Icono strokeWidth={1.8} /></div><span>{nombre}</span></div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="p-marca">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: SUAVE }}
        >
          <MonixLogoNavbar variant="white" className="w-full h-auto" />
        </motion.div>
      </div>
      <motion.p
        className="p-lema"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, delay: 0.6, ease: SUAVE }}
      >
        Tu banco, en tu celular.
      </motion.p>
    </>
  )
}

// ---------------------------------------------------------------- 2. Teléfono

function AppInicio() {
  const saldo = useContador(162300, 2.6, 0, 0.6)
  return (
    <div className="p-app">
      <div className="p-head">
        <Menu className="b" />
        <MonixLogoNavbar variant="white" className="h-7 w-auto" />
        <span className="sp" />
        <span className="p-campana"><Bell className="b" /><i>3</i></span>
        <Sun className="b" />
      </div>
      <div className="p-body">
        <p className="p-h1">Hola, Alex</p>
        <div className="p-tarj">
          <p className="p-lbl">Saldo disponible en pesos</p>
          <p className="p-big">$ {formato(saldo, 2)}</p>
          <p className="p-mini">TNA <b>32.00%</b> &nbsp;&nbsp; Hoy ~ <b>+$ 142,29</b></p>
          <p className="p-ok">↗ +$ 186,30 acreditados</p>
          <p className="p-lbl" style={{ marginTop: 10 }}>Cuenta N° 0001842201 · Caja de Ahorro</p>
          <div className="p-sep" />
          <p className="p-lbl">CBU <span className="p-mono">0000003100098765432101</span></p>
          <p className="p-lbl" style={{ marginTop: 8 }}>Alias <b style={{ color: '#fff', fontWeight: 600 }}>alex.romero.monix</b></p>
        </div>
        <div className="p-tarj">
          <p className="p-h1" style={{ fontSize: 22 }}>Reservas</p>
          <p className="p-sub">Ahorrá aparte y sumá rendimiento todos los días</p>
          <p className="p-lbl" style={{ marginTop: 14 }}>Saldo en reserva</p>
          <p className="p-big" style={{ fontSize: 32 }}>$ 25.000,00</p>
        </div>
      </div>
      <div className="p-nav">
        <div className="on"><LayoutDashboard />Inicio</div>
        <div><ArrowRightLeft />Transferir</div>
        <div className="qr"><QrCode /></div>
        <div><Landmark />Cuentas</div>
        <div><PiggyBank />Reservas</div>
      </div>
    </div>
  )
}

function Flotante({ estilo, demora, desfase, children }: { estilo: CSSProperties; demora: number; desfase: number; children: ReactNode }) {
  return (
    <motion.div
      className="p-fl"
      style={estilo}
      initial={{ opacity: 0, y: 60, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 60, damping: 14, delay: demora }}
    >
      <div className="p-fl-i" style={{ animationDelay: `${desfase}s` }}>{children}</div>
    </motion.div>
  )
}

function TarjetaChica() {
  return (
    <div className="p-tj-mini relative aspect-[856/540] overflow-hidden rounded-xl border border-white/20" style={{ background: FONDO_FRENTE.ars }}>
      <ArcosTarjeta />
      <IsologoTarjeta className="absolute left-[7%] top-[12%] h-[24%] w-auto" />
      <ChipTarjeta className="absolute right-[8%] top-[13%] w-[18%]" />
    </div>
  )
}

export function EscenaTelefono() {
  return (
    <>
      <div style={{ perspective: 1800 }}>
        <motion.div
          initial={{ rotateX: 34, y: 80, opacity: 0 }}
          animate={{ rotateX: 0, y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 40, damping: 14 }}
        >
          <div className="p-flota">
            <div className="p-phone"><div className="p-pantalla"><AppInicio /></div></div>
          </div>
        </motion.div>
      </div>

      <Flotante estilo={{ left: 110, top: 170 }} demora={0.9} desfase={0}>
        <div className="ico"><Check strokeWidth={2.6} /></div>
        <div><small>Transferencia enviada</small><b className="m">$ 25.000,00</b></div>
      </Flotante>
      <Flotante estilo={{ left: 70, top: 590 }} demora={1.5} desfase={-2}>
        <div className="ico"><Bot strokeWidth={2.2} /></div>
        <div><small>Moni</small><b>Gastaste $ 228.600</b></div>
      </Flotante>
      <Flotante estilo={{ right: 110, top: 140 }} demora={1.2} desfase={-4}>
        <div className="ico"><DollarSign strokeWidth={2.4} /></div>
        <div><small>Dólares</small><b className="m">US$ 100,00</b></div>
      </Flotante>
      <Flotante estilo={{ right: 60, top: 430 }} demora={1.8} desfase={-1}>
        <div className="p-donita" />
        <div><small>Mis gastos</small><b>Noviembre</b></div>
      </Flotante>
      <Flotante estilo={{ right: 130, top: 760 }} demora={2.1} desfase={-5}>
        <TarjetaChica />
        <div><small>Débito Monix</small><b>•••• 2481</b></div>
      </Flotante>
    </>
  )
}

// ---------------------------------------------------------------- 3. Tarjetas

// Mismos números y etiquetas que las tarjetas de la Landing.
const TARJETAS: { variante: VarianteTarjeta; pan: string; etiqueta: string; pestaña: string }[] = [
  { variante: 'ars', pan: '4532  8814  6201  2481', etiqueta: 'DÉBITO', pestaña: 'Pesos' },
  { variante: 'usd', pan: '5591  ••••  ••••  7730', etiqueta: 'DÉBITO USD', pestaña: 'Dólares' },
  { variante: 'credito', pan: '4970  ••••  ••••  1408', etiqueta: 'CRÉDITO', pestaña: 'Crédito' },
]

export function EscenaTarjetas() {
  const [k, setK] = useState(0)
  useEffect(() => {
    const t1 = setTimeout(() => setK(1), 3400)
    const t2 = setTimeout(() => setK(2), 6800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <>
      <Ripple tamaños={[900, 1200]} top="46%" />
      <div className="p-tj-escena">
        <motion.div
          className="p-tj-w"
          initial={{ opacity: 0, y: 60, rotateX: 18 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ type: 'spring', stiffness: 45, damping: 14 }}
        >
          <div className="p-tjs">
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
                  <div className="p-tj-fila"><span>MARTINA GÓMEZ</span><span>{t.etiqueta}</span></div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
      <div className="p-tabs">
        {TARJETAS.map((t, j) => (
          <span key={t.variante} className={j === k ? 'on' : ''}>
            {j === k && <motion.i layoutId="p-tab" className="p-tab-fondo" transition={{ type: 'spring', stiffness: 220, damping: 26 }} />}
            <em>{t.pestaña}</em>
          </span>
        ))}
      </div>
    </>
  )
}

// ---------------------------------------------------------------- 4. Tu dinero rinde

const RESERVA = 780000
const META = 1000000
// Lo que rinde por día una reserva de $ 780.000 al 32 % anual: 780.000 × 0,32 / 365.
const POR_DIA = Math.round((RESERVA * 0.32) / 365)
const CIRCUNFERENCIA = 2 * Math.PI * 290
const LUGARES = [[600, 90], [-70, 110], [640, 480], [300, -70], [-90, 600]]

export function EscenaRinde() {
  const reducir = useReducedMotion()
  const tasa = useContador(32, 1.8)
  const reserva = useContador(RESERVA, 3.2, 0, 0.4)
  const [burbujas, setBurbujas] = useState<number[]>([])

  useEffect(() => {
    if (reducir) return
    const ts = [1800, 3000, 4300, 5600, 6900].map((ms, i) => setTimeout(() => setBurbujas((b) => [...b, i]), ms))
    return () => ts.forEach(clearTimeout)
  }, [reducir])

  return (
    <>
      <div style={{ textAlign: 'left' }}>
        <p className="p-r-antes">Tu dinero rinde</p>
        <p className="p-r-dato">{Math.round(tasa)}%</p>
        <p className="p-r-post">anual</p>
      </div>
      <div className="p-anillo-r">
        <svg viewBox="0 0 700 700" aria-hidden="true">
          <defs>
            <linearGradient id="p-ga" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#26FFC1" />
              <stop offset="1" stopColor="#4FA3FF" />
            </linearGradient>
          </defs>
          <circle cx="350" cy="350" r="290" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="48" />
          <motion.circle
            cx="350" cy="350" r="290" fill="none" stroke="url(#p-ga)" strokeWidth="48" strokeLinecap="round"
            transform="rotate(-90 350 350)" strokeDasharray={CIRCUNFERENCIA}
            initial={{ strokeDashoffset: reducir ? CIRCUNFERENCIA * (1 - RESERVA / META) : CIRCUNFERENCIA }}
            animate={{ strokeDashoffset: CIRCUNFERENCIA * (1 - RESERVA / META) }}
            transition={{ duration: 3.2, delay: 0.4, ease: SUAVE }}
          />
        </svg>
        <div className="p-r-centro">
          <small>Reserva · Vacaciones</small>
          <strong>$ {formato(reserva)}</strong>
          <small>de $ {formato(META)}</small>
        </div>
        {burbujas.map((i) => (
          <motion.div
            key={i}
            className="p-burb-r"
            style={{ left: LUGARES[i % LUGARES.length][0], top: LUGARES[i % LUGARES.length][1] }}
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: [0, 1, 1, 0], y: [30, 0, -110, -170], scale: [0.9, 1, 1, 1] }}
            transition={{ duration: 3.2, times: [0, 0.2, 0.75, 1], ease: 'easeOut' }}
          >
            +$ {formato(POR_DIA)}
          </motion.div>
        ))}
      </div>
    </>
  )
}

// ---------------------------------------------------------------- 5. Seguridad

const SEGURIDAD = [
  { texto: 'Huella', Icono: Fingerprint },
  { texto: 'Avisos', Icono: Mail },
  { texto: 'Dispositivos', Icono: Smartphone },
  { texto: 'Dos pasos', Icono: ShieldCheck },
]

export function EscenaSeguridad() {
  return (
    <>
      <Ripple tamaños={[700, 1000, 1300]} top="44%" />
      <motion.p
        className="p-slogan"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.1, ease: SUAVE }}
      >
        Seguridad que<br /><b>no te frena.</b>
      </motion.p>
      <div className="p-iconos">
        {SEGURIDAD.map(({ texto, Icono }, i) => (
          <motion.div
            key={texto}
            className="p-ic-t"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 70, damping: 14, delay: 0.5 + i * 0.2 }}
          >
            <Icono strokeWidth={1.7} />{texto}
          </motion.div>
        ))}
      </div>
    </>
  )
}

// ---------------------------------------------------------------- 6. Probalo

export function EscenaProbalo() {
  return (
    <>
      <Ripple tamaños={[800, 1100]} left="70%" />
      <motion.p
        className="p-cta"
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1.1, ease: SUAVE }}
      >
        Escaneá<br />y <b>probalo.</b>
      </motion.p>
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 60, damping: 12, delay: 0.3 }}
      >
        <div className="p-qr"><img src="/pitch/qr-prueba.png" alt="Código QR para probar Monix sin registrarse" /></div>
      </motion.div>
    </>
  )
}
