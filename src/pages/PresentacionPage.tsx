import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, MotionConfig, motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Maximize, MonitorSpeaker } from 'lucide-react'
import { MonixLogoNavbar } from '../components/MonixLogoNavbar'
import { ArcosTarjeta } from '../components/TarjetaPiezas'
import { DIAPOS } from '../components/presentacion/Diapos'
import './pitch.css'
import './presentacion.css'

// Presentación de Monix para la cátedra, en la web y con las piezas reales de la app.
// No está enlazada desde ningún lado y sólo abre con la clave en el link:
//   /presentacion#monix-pp1
// Teclas: → / espacio / PageDown avanzan (el clicker manda esas), ← / PageUp vuelven,
// F pantalla completa, N muestra las notas, P abre la vista del presentador en otra ventana.
// Las dos ventanas se mantienen sincronizadas con BroadcastChannel.

const CLAVE = 'monix-pp1'
const LLAVE_OK = 'monix_presentacion_ok'
const LLAVE_POS = 'monix_presentacion_pos'
const CANAL = 'monix-presentacion'
const ANCHO = 1920
const ALTO = 1080

type Pos = { i: number; paso: number }
type Mensaje = { tipo: 'pos'; pos: Pos } | { tipo: 'hola' }

function tieneClave() {
  try {
    if (window.location.hash === `#${CLAVE}`) {
      sessionStorage.setItem(LLAVE_OK, '1')
      return true
    }
    return sessionStorage.getItem(LLAVE_OK) === '1'
  } catch {
    return window.location.hash === `#${CLAVE}`
  }
}

function posGuardada(): Pos {
  try {
    const p = JSON.parse(sessionStorage.getItem(LLAVE_POS) || '') as Pos
    if (p.i >= 0 && p.i < DIAPOS.length && p.paso >= 0 && p.paso <= DIAPOS[p.i].pasos) return p
  } catch { /* sin posición guardada */ }
  return { i: 0, paso: 0 }
}

function siguiente({ i, paso }: Pos): Pos {
  if (paso < DIAPOS[i].pasos) return { i, paso: paso + 1 }
  return i < DIAPOS.length - 1 ? { i: i + 1, paso: 0 } : { i, paso }
}

function anterior({ i, paso }: Pos): Pos {
  if (paso > 0) return { i, paso: paso - 1 }
  return i > 0 ? { i: i - 1, paso: DIAPOS[i - 1].pasos } : { i, paso }
}

/** Posición compartida entre la pantalla y la vista del presentador. */
function usePosicion() {
  const [pos, setPos] = useState<Pos>(posGuardada)
  const canal = useRef<BroadcastChannel | null>(null)
  const actual = useRef(pos)
  useEffect(() => { actual.current = pos }, [pos])

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const c = new BroadcastChannel(CANAL)
    canal.current = c
    c.onmessage = (e: MessageEvent<Mensaje>) => {
      if (e.data.tipo === 'pos') setPos(e.data.pos)
      else if (e.data.tipo === 'hola') c.postMessage({ tipo: 'pos', pos: actual.current } satisfies Mensaje)
    }
    c.postMessage({ tipo: 'hola' } satisfies Mensaje)
    return () => { c.close(); canal.current = null }
  }, [])

  useEffect(() => {
    try { sessionStorage.setItem(LLAVE_POS, JSON.stringify(pos)) } catch { /* modo privado */ }
  }, [pos])

  const ir = useCallback((cambio: (p: Pos) => Pos) => {
    setPos((p) => {
      const n = cambio(p)
      if (n.i !== p.i || n.paso !== p.paso) canal.current?.postMessage({ tipo: 'pos', pos: n } satisfies Mensaje)
      return n
    })
  }, [])

  return { pos, ir }
}

function useTeclas(ir: (c: (p: Pos) => Pos) => void, extra?: (e: KeyboardEvent) => void) {
  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); ir(siguiente) }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); ir(anterior) }
      else if (e.key === 'Home') ir(() => ({ i: 0, paso: 0 }))
      else if (e.key === 'End') ir(() => ({ i: DIAPOS.length - 1, paso: 0 }))
      else extra?.(e)
    }
    window.addEventListener('keydown', teclas)
    return () => window.removeEventListener('keydown', teclas)
  }, [ir, extra])
}

/** Escala del escenario de 1920×1080 para que entre en el elemento. */
function useEscala<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [escala, setEscala] = useState(1)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ajustar = () => setEscala(Math.min(el.clientWidth / ANCHO, el.clientHeight / ALTO))
    ajustar()
    const ro = new ResizeObserver(ajustar)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return { ref, escala }
}

function Escenario({ pos, escala, animar = true }: { pos: Pos; escala: number; animar?: boolean }) {
  const reducir = useReducedMotion() || !animar
  const { Diapo, centro } = DIAPOS[pos.i]
  return (
    <main className="p-stage" style={{ zoom: escala }} aria-label="Presentación de Monix" data-diapo={pos.i} data-paso={pos.paso}>
      <h1 className="sr-only">Monix: banca de verdad, desde tu celular</h1>
      <div className="p-arcos-fondo" aria-hidden="true"><ArcosTarjeta color="#C7D4E3" /></div>
      <AnimatePresence initial={false}>
        <motion.section
          key={pos.i}
          className={`p-scene d-scene${centro ? ' centro' : ''}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: reducir ? 0 : 0.7, delay: reducir ? 0 : 0.15 } }}
          exit={{ opacity: 0, transition: { duration: reducir ? 0 : 0.45 } }}
        >
          <Diapo paso={pos.paso} />
        </motion.section>
      </AnimatePresence>
      <motion.div className="p-esquina" aria-hidden="true" animate={{ opacity: pos.i === 0 ? 0 : 0.9 }} transition={{ duration: 0.6 }}>
        <MonixLogoNavbar variant="white" className="w-full h-auto" />
      </motion.div>
    </main>
  )
}

function SinClave() {
  return (
    <div className="d-sin-clave">
      <p>Esta página no existe.</p>
      <a href="/">Ir a Monix</a>
    </div>
  )
}

export function PresentacionPage() {
  const [ok] = useState(tieneClave)

  // Que no aparezca en buscadores.
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    const titulo = document.title
    document.title = 'Monix · Presentación'
    return () => { meta.remove(); document.title = titulo }
  }, [])

  if (!ok) return <SinClave />
  // Con "reducir movimiento" activado en el sistema, framer saca los desplazamientos y deja los fundidos.
  return (
    <MotionConfig reducedMotion="user">
      {new URLSearchParams(window.location.search).has('presentador') ? <VistaPresentador /> : <Pantalla />}
    </MotionConfig>
  )
}

// ---------------------------------------------------------------- Pantalla (proyector)

function Pantalla() {
  const { pos, ir } = usePosicion()
  const { ref, escala } = useEscala<HTMLDivElement>()
  const [notas, setNotas] = useState(false)
  const [quieto, setQuieto] = useState(false)
  const [completa, setCompleta] = useState(false)

  const pedirPantallaCompleta = useCallback(() => {
    if (!document.fullscreenElement) ref.current?.requestFullscreen().catch(() => {})
  }, [ref])

  const abrirPresentador = useCallback(() => {
    window.open(`/presentacion?presentador#${CLAVE}`, 'monix-presentador', 'width=1280,height=800')
  }, [])

  const extra = useCallback((e: KeyboardEvent) => {
    if (e.key === 'f' || e.key === 'F') pedirPantallaCompleta()
    else if (e.key === 'n' || e.key === 'N') setNotas((v) => !v)
    else if (e.key === 'p' || e.key === 'P') abrirPresentador()
  }, [pedirPantallaCompleta, abrirPresentador])
  useTeclas(ir, extra)

  useEffect(() => {
    const cambio = () => setCompleta(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', cambio)
    return () => document.removeEventListener('fullscreenchange', cambio)
  }, [])

  useEffect(() => {
    let id = 0
    const despertar = () => {
      setQuieto(false)
      window.clearTimeout(id)
      id = window.setTimeout(() => setQuieto(true), 2500)
    }
    despertar()
    window.addEventListener('pointermove', despertar)
    return () => { window.clearTimeout(id); window.removeEventListener('pointermove', despertar) }
  }, [])

  const d = DIAPOS[pos.i]
  return (
    <div ref={ref} className={`pitch deck${quieto ? ' quieto' : ''}${completa ? ' completa' : ''}`}>
      <Escenario pos={pos} escala={escala} />

      <div className="d-controles">
        <button type="button" onClick={() => ir(anterior)} aria-label="Anterior"><ChevronLeft aria-hidden="true" /></button>
        <span>{pos.i + 1} / {DIAPOS.length}</span>
        <button type="button" onClick={() => ir(siguiente)} aria-label="Siguiente"><ChevronRight aria-hidden="true" /></button>
        <button type="button" onClick={abrirPresentador} className="d-con-texto"><MonitorSpeaker aria-hidden="true" />Notas</button>
        {!completa && <button type="button" onClick={pedirPantallaCompleta} className="d-con-texto"><Maximize aria-hidden="true" />Pantalla completa</button>}
      </div>

      {notas && (
        <aside className="d-notas-flotantes" aria-label="Notas de la diapositiva">
          <b>{d.quien}</b>
          <p>{d.notas}</p>
        </aside>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- Vista del presentador

function Miniatura({ pos, animar, id }: { pos: Pos; animar?: boolean; id: string }) {
  const { ref, escala } = useEscala<HTMLDivElement>()
  return (
    <div ref={ref} className="pitch deck d-mini">
      <LayoutGroup id={id}><Escenario pos={pos} escala={escala} animar={animar} /></LayoutGroup>
    </div>
  )
}

function Reloj() {
  const [inicio, setInicio] = useState(() => Date.now())
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const s = Math.max(0, Math.floor((ahora - inicio) / 1000))
  return (
    <button type="button" className="d-reloj" onClick={() => { setInicio(Date.now()); setAhora(Date.now()) }} title="Reiniciar">
      {String(Math.floor(s / 60)).padStart(2, '0')}:{String(s % 60).padStart(2, '0')}
    </button>
  )
}

function VistaPresentador() {
  const { pos, ir } = usePosicion()
  useTeclas(ir)
  const d = DIAPOS[pos.i]
  const prox = siguiente(pos)
  const esUltimo = prox.i === pos.i && prox.paso === pos.paso

  // Resalta los [Clic] y marca cuáles ya pasaron.
  let clic = 0
  const partes = d.notas.split(/(\[Clic\])/g).map((t, k) => {
    if (t !== '[Clic]') return <span key={k}>{t}</span>
    clic += 1
    return <mark key={k} className={clic <= pos.paso ? 'hecho' : clic === pos.paso + 1 ? 'proximo' : ''}>clic</mark>
  })

  return (
    <div className="d-presentador">
      <section className="d-pres-actual">
        <Miniatura pos={pos} id="actual" />
        <div className="d-pres-barra">
          <button type="button" onClick={() => ir(anterior)}><ChevronLeft aria-hidden="true" />Anterior</button>
          <span>Diapo {pos.i + 1} de {DIAPOS.length} · clic {pos.paso} de {d.pasos}</span>
          <button type="button" onClick={() => ir(siguiente)}>Siguiente<ChevronRight aria-hidden="true" /></button>
        </div>
        <div className="d-pres-prox">
          <p>{esUltimo ? 'Es la última' : prox.i === pos.i ? 'Próximo clic' : `Sigue: ${DIAPOS[prox.i].titulo} (${DIAPOS[prox.i].quien})`}</p>
          {!esUltimo && <Miniatura pos={prox} animar={false} id="proxima" />}
        </div>
      </section>
      <section className="d-pres-lado">
        <div className="d-pres-cab">
          <span className={`d-quien ${d.quien === 'DIEGO' ? 'diego' : 'maxi'}`}>{d.quien}</span>
          <Reloj />
        </div>
        <h1>{d.titulo}</h1>
        <div className="d-pres-notas">{partes}</div>
      </section>
    </div>
  )
}
