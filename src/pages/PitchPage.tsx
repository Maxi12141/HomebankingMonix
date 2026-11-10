import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Maximize } from 'lucide-react'
import { MonixLogoNavbar } from '../components/MonixLogoNavbar'
import { ArcosTarjeta } from '../components/TarjetaPiezas'
import {
  EscenaMarca, EscenaProbalo, EscenaRinde, EscenaSeguridad, EscenaTarjetas, EscenaTelefono,
} from '../components/pitch/EscenasPitch'
import './pitch.css'

// Segunda pantalla de la presentación: una pauta de marca que corre de fondo en una TV
// de 32" mientras se expone. Poco texto, movimiento lento y nada que dependa de datos en
// vivo. El escenario mide 1920×1080 y se escala con zoom para que el texto quede nítido.
// Teclas: ← → cambian de escena, espacio pausa, F pone pantalla completa (Esc o F11 salen).

const ESCENAS: { Escena: ComponentType; segundos: number; centro?: boolean; gap?: number }[] = [
  { Escena: EscenaMarca, segundos: 8, centro: true },
  { Escena: EscenaTelefono, segundos: 9 },
  { Escena: EscenaTarjetas, segundos: 10, centro: true },
  { Escena: EscenaRinde, segundos: 9, gap: 110 },
  { Escena: EscenaSeguridad, segundos: 9, centro: true },
  { Escena: EscenaProbalo, segundos: 9, gap: 140 },
]

const ANCHO = 1920
const ALTO = 1080

function enPantallaCompleta() {
  return !!document.fullscreenElement
}

export function PitchPage() {
  const reducir = useReducedMotion()
  const raiz = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(1)
  const [indice, setIndice] = useState(0)
  const [pausado, setPausado] = useState(false)
  const [quieto, setQuieto] = useState(false)
  const [completa, setCompleta] = useState(false)
  const [aviso, setAviso] = useState('')

  // Escala el escenario a la ventana (vertical u horizontal) sin deformarlo.
  useEffect(() => {
    const el = raiz.current
    if (!el) return
    const ajustar = () => setEscala(Math.min(el.clientWidth / ANCHO, el.clientHeight / ALTO))
    ajustar()
    const ro = new ResizeObserver(ajustar)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Avance automático. Cambiar de escena a mano reinicia el tiempo de la nueva.
  useEffect(() => {
    if (pausado) return
    const id = window.setTimeout(() => setIndice((i) => (i + 1) % ESCENAS.length), ESCENAS[indice].segundos * 1000)
    return () => window.clearTimeout(id)
  }, [indice, pausado])

  // El QR se baja de entrada: el service worker lo guarda por si se corta internet.
  useEffect(() => { new Image().src = '/pitch/qr-prueba.png' }, [])

  const pedirPantallaCompleta = useCallback(() => {
    const el = raiz.current
    if (!el || enPantallaCompleta()) return
    el.requestFullscreen().catch(() => {
      setAviso('Este navegador no deja usar pantalla completa. Probá con F11.')
      window.setTimeout(() => setAviso(''), 6000)
    })
  }, [])

  useEffect(() => {
    const cambio = () => setCompleta(enPantallaCompleta())
    document.addEventListener('fullscreenchange', cambio)
    return () => document.removeEventListener('fullscreenchange', cambio)
  }, [])

  // El botón y el cursor se esconden solos para que no se vean en la TV.
  useEffect(() => {
    let id = 0
    const despertar = () => {
      setQuieto(false)
      window.clearTimeout(id)
      id = window.setTimeout(() => setQuieto(true), 2500)
    }
    despertar()
    window.addEventListener('pointermove', despertar)
    window.addEventListener('keydown', despertar)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('pointermove', despertar)
      window.removeEventListener('keydown', despertar)
    }
  }, [])

  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIndice((i) => (i + 1) % ESCENAS.length)
      else if (e.key === 'ArrowLeft') setIndice((i) => (i - 1 + ESCENAS.length) % ESCENAS.length)
      else if (e.key === ' ') { e.preventDefault(); setPausado((p) => !p) }
      else if (e.key === 'f' || e.key === 'F') pedirPantallaCompleta()
    }
    window.addEventListener('keydown', teclas)
    return () => window.removeEventListener('keydown', teclas)
  }, [pedirPantallaCompleta])

  const { Escena, centro, gap } = ESCENAS[indice]

  return (
    <div ref={raiz} className={`pitch${quieto ? ' quieto' : ''}${completa ? ' completa' : ''}`}>
      <main className="p-stage" style={{ zoom: escala }} aria-label="Pauta de Monix" data-escena={indice}>
        <h1 className="sr-only">Monix: tu banco, en tu celular</h1>
        <div className="p-arcos-fondo" aria-hidden="true"><ArcosTarjeta color="#C7D4E3" /></div>

        <AnimatePresence initial={false}>
          <motion.section
            key={indice}
            className={`p-scene${centro ? ' centro' : ''}`}
            style={gap ? { gap } : undefined}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: reducir ? 0 : 1, delay: reducir ? 0 : 0.25 } }}
            exit={{ opacity: 0, transition: { duration: reducir ? 0 : 0.7 } }}
          >
            <Escena />
          </motion.section>
        </AnimatePresence>

        <motion.div
          className="p-esquina"
          aria-hidden="true"
          animate={{ opacity: indice === 0 ? 0 : 0.9 }}
          transition={{ duration: 0.6 }}
        >
          <MonixLogoNavbar variant="white" className="w-full h-auto" />
        </motion.div>
      </main>

      <button type="button" className="p-fs" onClick={pedirPantallaCompleta}>
        <Maximize aria-hidden="true" />Pantalla completa
      </button>
      {aviso && <p className="p-aviso" role="status">{aviso}</p>}
    </div>
  )
}
