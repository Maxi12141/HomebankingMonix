import { lazy, Suspense, useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { MonixLogoNavbar } from '../components/MonixLogoNavbar'

// Segunda pantalla del pitch: una TV de fondo mientras se presenta. Se lee de lejos
// y no compite con los oradores: frases cortas, movimiento lento y nada que dependa
// de datos en vivo. Medidas en vmin para que sirva en horizontal y en vertical.
const TarjetaHero = lazy(() => import('../components/TarjetaHero').then((m) => ({ default: m.TarjetaHero })))

const ESCENAS = [
  { imagen: '/pitch/inicio.jpg', antes: 'Tu dinero rinde', dato: '32% anual', alt: 'Inicio de Monix con el saldo y lo que rinde por día' },
  { imagen: '/pitch/dolares.jpg', antes: 'Dólares al', dato: 'precio real', alt: 'Compra de dólares al precio oficial del momento' },
  { imagen: '/pitch/gastos.jpg', antes: 'Mirá en qué', dato: 'gastás', alt: 'Mis gastos: total del mes y barras por concepto' },
  { imagen: '/pitch/moni.jpg', antes: 'Moni te responde', dato: 'al toque', alt: 'Moni responde en qué se gastó más este mes' },
  { imagen: '/pitch/tarjeta.jpg', antes: 'Tu débito devuelve', dato: 'hasta 8%', alt: 'Tarjeta de débito Monix' },
]
const SEGUNDOS_POR_ESCENA = 7

export function PitchPage() {
  const reducir = useReducedMotion()
  const [indice, setIndice] = useState(0)
  const escena = ESCENAS[indice]

  useEffect(() => {
    // Se bajan todas de entrada: el service worker las guarda por si se corta internet en el aula.
    ESCENAS.forEach((e) => { new Image().src = e.imagen })
    const id = window.setInterval(() => setIndice((i) => (i + 1) % ESCENAS.length), SEGUNDOS_POR_ESCENA * 1000)
    return () => window.clearInterval(id)
  }, [])

  const fundido = { duration: reducir ? 0 : 1 }

  return (
    <main
      className="dark h-screen w-screen overflow-hidden text-white grid grid-rows-[auto_auto_1fr] landscape:grid-rows-1 landscape:grid-cols-[1.15fr_auto_0.85fr] items-center gap-[4vmin] p-[5vmin]"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, #0D2B52 0%, #001A3D 55%, #00112A 100%)' }}
    >
      <section className="flex flex-col gap-[4vmin] min-w-0">
        <MonixLogoNavbar variant="white" className="w-[38vmin] h-auto" />
        <h1 className="sr-only">Monix: banca de verdad, desde tu celular</h1>
        <div className="min-h-[24vmin]" aria-live="off">
          <AnimatePresence mode="wait">
            <motion.p
              key={escena.dato}
              initial={{ opacity: 0, y: reducir ? 0 : 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reducir ? 0 : 0.6 }}
              className="font-display font-extrabold leading-[1.05] tracking-tight text-[9vmin]"
            >
              {escena.antes}
              <span className="block text-mint text-[13vmin]">{escena.dato}</span>
            </motion.p>
          </AnimatePresence>
        </div>
      </section>

      <motion.div
        className="relative justify-self-center h-[46vh] landscape:h-[88vh] aspect-[390/844] rounded-[5vmin] border-[1vmin] border-[#0A1F3D] bg-navy overflow-hidden shadow-2xl"
        animate={reducir ? undefined : { y: [0, -10, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <AnimatePresence initial={false}>
          <motion.img
            key={escena.imagen}
            src={escena.imagen}
            alt={escena.alt}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={fundido}
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
        </AnimatePresence>
      </motion.div>

      <section className="flex landscape:flex-col items-center justify-center gap-[4vmin] min-w-0 min-h-0">
        <div className="hidden landscape:block w-full max-w-[60vmin]" aria-hidden="true">
          <Suspense fallback={null}>
            <TarjetaHero />
          </Suspense>
        </div>
        <div className="flex landscape:flex-col items-center gap-[3vmin] text-center">
          <img
            src="/pitch/qr-prueba.png"
            alt="Código QR para probar Monix sin registrarse"
            className="w-[24vmin] h-[24vmin] rounded-[2vmin] bg-white"
          />
          <p className="font-display font-bold text-[4vmin] leading-tight max-w-[40vmin]">
            Escaneá y <span className="text-mint">probalo</span>
          </p>
        </div>
      </section>
    </main>
  )
}
