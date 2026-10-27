import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRightLeft, QrCode, PiggyBank, Fingerprint, ArrowRight, Sun, Moon, CheckCircle2, Download, Star, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '../components/ui/Button'
import { MarketTicker } from '../components/MarketTicker'
import { lazy, Suspense } from 'react'
import { TarjetaMini } from '../components/TarjetaPiezas'
import SpecularButton from '../components/SpecularButton'
import { MonixLogoNavbar } from '../components/MonixLogoNavbar'
import { useThemeStore } from '../stores/themeStore'
import { usePwaInstall } from '../hooks/usePwaInstall'

// Decorativa: va en su propio chunk para no sumar al JS inicial (CONSTRAINTS.md, Bundle).
const TarjetaHero = lazy(() => import('../components/TarjetaHero').then((m) => ({ default: m.TarjetaHero })))

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
}

// Aparición al entrar en pantalla, igual en todas las secciones.
const enVista = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
}

const cifras = [
  { valor: '$0', texto: 'de mantenimiento' },
  { valor: '8%', texto: 'de cashback en nuestra tienda' },
  { valor: '5 min', texto: 'para abrir tu cuenta' },
  { valor: '24/7', texto: 'tu banco en el celular' },
]

const beneficios = [
  {
    icon: ArrowRightLeft,
    title: 'Transferís en segundos',
    description: 'A cualquier CBU o alias, de cualquier banco, a cualquier hora. Guardás tus contactos y repetís con un toque.',
  },
  {
    icon: QrCode,
    title: 'Cobrás con QR',
    description: 'Generás tu código, te escanean y la plata entra al instante. Sin posnet ni comisiones.',
  },
  {
    icon: PiggyBank,
    title: 'Ahorrás con un objetivo',
    description: 'Armá metas solo o con amigos y separá plata en reservas que rinden todos los días.',
  },
  {
    icon: Fingerprint,
    title: 'Tu plata bajo llave',
    description: 'La app se abre con tu huella y cada movimiento queda registrado con su comprobante.',
  },
]

const pasos = [
  { titulo: 'Te registrás', texto: 'Con tu mail y tu DNI, desde el celular. Te lleva dos minutos.' },
  { titulo: 'Validás tu identidad', texto: 'Una foto del documento y listo. Sin papeles ni sucursales.' },
  { titulo: 'Empezás a usarla', texto: 'Recibís tu CBU, tu alias y la tarjeta virtual para operar en el momento.' },
]

const testimonios = [
  { nombre: 'Lucía Fernández', lugar: 'Rosario', texto: 'Abrí la cuenta en el colectivo y antes de bajarme ya había cobrado una transferencia. Así de simple.' },
  { nombre: 'Martín Acosta', lugar: 'Córdoba', texto: 'Con el QR le cobro a mis clientes sin posnet. El cashback me paga la suscripción del gimnasio.' },
  { nombre: 'Sofía Ramírez', lugar: 'CABA', texto: 'Con mis amigas armamos una meta para el viaje a Bariloche. Cada una pone lo suyo y vemos cuánto falta.' },
]

const preguntas = [
  { p: '¿Tiene algún costo?', r: 'No. Abrir la cuenta, mantenerla y usar la tarjeta de débito es gratis. La tarjeta de crédito no tiene costo el primer año.' },
  { p: '¿Cuánto tarda la apertura?', r: 'Unos 5 minutos. Te registrás, validás tu identidad con el DNI y ya tenés tu CBU y tu alias para operar.' },
  { p: '¿Qué necesito para abrir la cuenta?', r: 'Ser mayor de 18 años, tener DNI argentino vigente y un mail. Nada más.' },
  { p: '¿Es seguro?', r: 'Sí. La app se abre con tu huella o tu clave, cada operación queda registrada y tus datos viajan cifrados.' },
  { p: '¿Puedo transferir a otros bancos?', r: 'Sí, a cualquier CBU, CVU o alias del país, las 24 horas, y la plata llega al instante.' },
  { p: '¿Cómo compro dólares?', r: 'Desde la app, al precio del dólar MEP. Los dólares quedan en tu cuenta en USD, sin límite de saldo.' },
  { p: '¿Cómo funciona el cashback?', r: 'Te devolvemos el 8% de cada compra en mercadoMONIX, nuestra tienda. Se acredita en tu cuenta.' },
  { p: '¿Hay que descargar una app?', r: 'Podés usar Monix desde el navegador o instalarla en tu celular: en Android tocá "Instalar app", y en iPhone, Compartir y "Agregar a Inicio".' },
]

/* ─── Datos de productos ─────────────────────────────────────────── */
const products = [
  {
    accentColor: '#26ffc1',
    variante: 'ars' as const,
    pan: '4532 •••• •••• 2481',
    etiqueta: 'Débito',
    badge: 'Cuenta ARS',
    title: 'Cuenta en Pesos',
    subtitle: 'Sin costo de mantenimiento',
    features: [
      'Débito Visa incluida sin cargo',
      'Transferencias CBU/alias ilimitadas',
      'Rendimiento automático en FCI',
      'Apertura 100% online en 5 minutos',
      'Acceso 24/7 desde la app',
    ],
    cta: 'Abrí tu cuenta',
  },
  {
    accentColor: '#AEB8C4',
    variante: 'usd' as const,
    pan: '5591 •••• •••• 7730',
    etiqueta: 'Débito USD',
    badge: 'Cuenta USD',
    title: 'Cuenta en Dólares',
    subtitle: 'Sin límite de saldo',
    features: [
      'Ahorrá y operá en dólares',
      'Cotización dólar MEP competitiva',
      'Sin costo de apertura ni mantenimiento',
      'Transferencias internacionales SWIFT',
      'Disponible 24 hs, los 365 días',
    ],
    cta: 'Abrí tu cuenta en USD',
  },
  {
    accentColor: '#D6BA80',
    variante: 'credito' as const,
    pan: '4970 •••• •••• 1408',
    etiqueta: 'Crédito',
    badge: 'Crédito',
    title: 'Tarjeta Monix',
    subtitle: '8% de cashback en nuestra tienda',
    features: [
      'Hasta $800.000 de límite inicial',
      '3 y 6 cuotas sin interés en comercios adheridos',
      '8% de cashback en nuestra tienda',
      'Resumen digital, sin papel',
      'Sin costo el primer año',
    ],
    cta: 'Solicitá la tuya',
  },
]

/* ─── Página ─────────────────────────────────────────────────────── */
export function LandingPage() {
  const { theme, toggleTheme } = useThemeStore()
  const { mostrarBoton: mostrarInstalar, instalar } = usePwaInstall()

  async function handleInstalar() {
    const resultado = await instalar()
    if (resultado === 'manual-ios') {
      toast('Para instalar: tocá Compartir y elegí "Agregar a Inicio"', { icon: '📲', duration: 5000 })
    } else if (resultado === 'no-disponible') {
      toast('Tu navegador todavía no permite instalar. Probá con Chrome en Android.', { duration: 4000 })
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-navy text-navy dark:text-white transition-colors duration-300">

      {/* Navbar */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-navy-card/95 md:bg-white/80 md:dark:bg-navy-card/90 md:backdrop-blur-md border-b border-slate-200 dark:border-white/10 transition-colors duration-300 pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          <MonixLogoNavbar className="h-5 sm:h-8 w-auto shrink-0" variant={theme === 'dark' ? 'white' : 'default'} />
          <nav className="flex items-center gap-1 sm:gap-3">
            <button
              onClick={toggleTheme}
              className="p-1.5 sm:p-2 rounded-xl text-slate-secondary hover:text-navy dark:hover:text-white hover:bg-navy/5 dark:hover:bg-white/5 transition-colors shrink-0"
              aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {theme === 'dark' ? <Sun size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Moon size={16} className="sm:w-[18px] sm:h-[18px]" />}
            </button>
            <Link
              to="/login"
              className="inline-flex min-h-11 items-center rounded-xl px-2 font-body text-sm font-medium whitespace-nowrap text-navy hover:bg-navy/5 dark:text-white dark:hover:bg-white/5 sm:px-3"
            >
              <span className="sm:hidden">Ingresá</span>
              <span className="hidden sm:inline">Iniciá sesión</span>
            </Link>
            <Link to="/register">
              {/* !: Button no combina clases y su px-5 py-3 le ganaría al tamaño chico */}
              <Button variant="primary" className="!px-3 !py-0 min-h-11 text-sm whitespace-nowrap sm:!px-4">Registrate</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Ticker de mercado */}
      <MarketTicker />

      {/* Hero */}
      <section className="overflow-hidden px-4 pt-10 pb-16 sm:px-6 sm:pt-14 sm:pb-20">
        <div className="max-w-6xl mx-auto grid items-center gap-6 lg:grid-cols-2 lg:gap-12 md:min-h-[60vh]">
        <motion.div
          className="w-full max-w-xl mx-auto text-center lg:mx-0 lg:text-left"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.h1
            variants={itemVariants}
            className="font-display text-[1.85rem] sm:text-[2.25rem] lg:text-[3.25rem] font-bold text-navy dark:text-white leading-[1.12] mb-5 sm:mb-6 text-balance"
          >
            La tarjeta que da vuelta tu forma de manejar{' '}
            <span className="whitespace-nowrap underline decoration-mint decoration-[6px] underline-offset-[10px] dark:text-mint dark:no-underline">la plata.</span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="font-body text-lg text-slate-secondary leading-relaxed mb-8 max-w-lg mx-auto lg:mx-0"
          >
            Pesos, dólares y 8% de cashback en nuestra tienda en una sola app.
            Abrís tu cuenta online en 5 minutos, sin costo.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col items-center gap-4 lg:items-start">
            <Link to="/register">
              <SpecularButton
                size="md"
                radius={12}
                tint="#26FFC1"
                tintOpacity={1}
                textColor="#001A3D"
                // Luz blanca sobre fondo oscuro; en claro no se vería, va en mint tinta fuerte.
                lineColor={theme === 'dark' ? '#FFFFFF' : '#007A5A'}
                baseColor="#1FE6AF"
                idleIntensity={0.5}
                className="font-body font-semibold"
              >
                Abrí tu cuenta gratis
                <ArrowRight size={18} />
              </SpecularButton>
            </Link>
            <p className="font-body text-sm text-slate-secondary">
              <span className="font-semibold text-navy dark:text-white">+120.000 personas</span> ya usan Monix · 4,8 ★ en las tiendas
            </p>
          </motion.div>

          {mostrarInstalar && (
            <motion.button
              variants={itemVariants}
              type="button"
              onClick={() => { void handleInstalar() }}
              className="mt-5 inline-flex items-center gap-2 text-navy dark:text-mint font-body text-sm font-medium hover:text-navy/70 dark:hover:text-mint-hover transition-colors"
            >
              <Download size={16} />
              Instalar app
            </motion.button>
          )}
        </motion.div>

        {/* El fallback reserva el mismo lugar que la tarjeta para que no haya salto de layout */}
        <Suspense fallback={<div className="mx-auto w-full max-w-[340px] py-8 sm:max-w-[420px] lg:max-w-[460px]"><div className="aspect-[856/540]" /></div>}>
          <TarjetaHero />
        </Suspense>
        </div>
      </section>

      {/* Cifras */}
      <section className="border-y border-slate-200 dark:border-white/10 bg-slate-input dark:bg-navy-card px-4 py-8 sm:px-6 transition-colors duration-300">
        <dl className="max-w-6xl mx-auto grid grid-cols-2 gap-6 lg:grid-cols-4">
          {cifras.map((c) => (
            <div key={c.valor} className="flex flex-col-reverse text-center">
              <dt className="mt-1 font-body text-sm text-slate-secondary">{c.texto}</dt>
              <dd className="font-display text-3xl sm:text-4xl font-bold text-navy dark:text-mint">{c.valor}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Beneficios */}
      <section className="py-20 px-6 bg-white dark:bg-navy transition-colors duration-300">
        <div className="max-w-6xl mx-auto">
          <motion.div className="text-center mb-12" {...enVista}>
            <h2 className="font-display text-3xl font-bold text-navy dark:text-white mb-3">Todo tu banco, sin vueltas</h2>
            <p className="font-body text-slate-secondary text-lg">Lo que hacías en una sucursal, ahora lo hacés en segundos.</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {beneficios.map((b, i) => (
              <motion.div
                key={b.title}
                className="bg-slate-input dark:bg-navy-card rounded-2xl p-6 border border-slate-200 dark:border-white/10"
                {...enVista}
                transition={{ duration: 0.5, delay: i * 0.08 }}
              >
                <div className="w-11 h-11 rounded-xl bg-navy dark:bg-mint/10 flex items-center justify-center text-mint mb-4">
                  <b.icon size={22} />
                </div>
                <h3 className="font-display text-lg font-semibold text-navy dark:text-white mb-2">{b.title}</h3>
                <p className="font-body text-slate-secondary text-sm leading-relaxed">{b.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="py-20 px-6 bg-slate-input dark:bg-navy-card transition-colors duration-300">
        <div className="max-w-5xl mx-auto">
          <motion.div className="text-center mb-12" {...enVista}>
            <h2 className="font-display text-3xl font-bold text-navy dark:text-white mb-3">Tu cuenta, en tres pasos</h2>
            <p className="font-body text-slate-secondary text-lg">Todo online. Sin turnos, sin papeles.</p>
          </motion.div>

          <ol className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pasos.map((paso, i) => (
              <motion.li key={paso.titulo} className="text-center md:text-left" {...enVista} transition={{ duration: 0.5, delay: i * 0.1 }}>
                <span className="mx-auto md:mx-0 flex w-11 h-11 items-center justify-center rounded-full bg-mint font-display text-lg font-bold text-navy mb-4">
                  {i + 1}
                </span>
                <h3 className="font-display text-lg font-semibold text-navy dark:text-white mb-2">{paso.titulo}</h3>
                <p className="font-body text-slate-secondary text-sm leading-relaxed">{paso.texto}</p>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      {/* Productos */}
      <section className="py-20 px-6 bg-white dark:bg-navy transition-colors duration-300">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-display text-3xl font-bold text-navy dark:text-white mb-3">Nuestros productos</h2>
            <p className="font-body text-slate-secondary text-lg">Todo lo que necesitás, sin ir a una sucursal.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {products.map((product, i) => (
              <motion.div
                key={product.title}
                className="bg-slate-input dark:bg-navy-card rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 flex flex-col"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <div className="h-1" style={{ backgroundColor: product.accentColor }} />

                <div className="p-6 flex flex-col flex-1">
                  <span
                    className="inline-block self-start text-xs font-body font-semibold rounded-full px-3 py-1 mb-4 text-navy dark:text-white"
                    style={{ backgroundColor: `${product.accentColor}33` }}
                  >
                    {product.badge}
                  </span>

                  <h3 className="font-display text-xl font-bold text-navy dark:text-white mb-1">{product.title}</h3>
                  <p className="font-body text-sm text-slate-secondary mb-5">{product.subtitle}</p>

                  {/* Card mockup */}
                  <div className="mb-5 rounded-xl overflow-hidden shadow-lg ring-1 ring-black/10">
                    <TarjetaMini variante={product.variante} pan={product.pan} etiqueta={product.etiqueta} />
                  </div>

                  <ul className="flex flex-col gap-2.5 mb-6 flex-1">
                    {product.features.map(f => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckCircle2 size={15} className="shrink-0 mt-0.5" style={{ color: product.accentColor }} />
                        <span className="font-body text-sm text-navy dark:text-white">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Link to="/register">
                    <Button variant="primary" className="w-full text-sm py-2.5">{product.cta}</Button>
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonios */}
      <section className="py-20 px-6 bg-slate-input dark:bg-navy-card transition-colors duration-300">
        <div className="max-w-6xl mx-auto">
          <motion.div className="text-center mb-12" {...enVista}>
            <h2 className="font-display text-3xl font-bold text-navy dark:text-white mb-3">Lo que dicen nuestros clientes</h2>
            <p className="font-body text-slate-secondary text-lg">4,8 ★ de promedio en las tiendas de apps.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonios.map((t, i) => (
              <motion.figure
                key={t.nombre}
                className="bg-white dark:bg-navy rounded-2xl p-6 border border-slate-200 dark:border-white/10 flex flex-col"
                {...enVista}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <div className="flex gap-0.5 text-navy dark:text-mint mb-4" role="img" aria-label="5 de 5 estrellas">
                  {[0, 1, 2, 3, 4].map((n) => <Star key={n} size={16} fill="currentColor" aria-hidden="true" />)}
                </div>
                <blockquote className="font-body text-navy dark:text-white leading-relaxed flex-1">“{t.texto}”</blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <span className="flex w-10 h-10 items-center justify-center rounded-full bg-navy font-display text-sm font-bold text-mint" aria-hidden="true">
                    {t.nombre.split(' ').map((n) => n[0]).join('')}
                  </span>
                  <span className="font-body text-sm">
                    <span className="block font-semibold text-navy dark:text-white">{t.nombre}</span>
                    <span className="text-slate-secondary">{t.lugar}</span>
                  </span>
                </figcaption>
              </motion.figure>
            ))}
          </div>
        </div>
      </section>

      {/* Preguntas frecuentes */}
      <section className="py-20 px-6 bg-white dark:bg-navy transition-colors duration-300">
        <div className="max-w-3xl mx-auto">
          <motion.h2 className="font-display text-3xl font-bold text-navy dark:text-white mb-10 text-center" {...enVista}>
            Preguntas frecuentes
          </motion.h2>
          <div className="divide-y divide-slate-200 dark:divide-white/10 border-y border-slate-200 dark:border-white/10">
            {preguntas.map((q) => (
              <details key={q.p} className="group">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-4 font-display text-base font-semibold text-navy dark:text-white [&::-webkit-details-marker]:hidden">
                  {q.p}
                  <ChevronDown size={20} className="shrink-0 text-slate-secondary transition-transform duration-300 group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="pb-5 font-body text-slate-secondary leading-relaxed">{q.r}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-20 px-6 bg-slate-input dark:bg-navy-card transition-colors duration-300">
        <motion.div
          className="max-w-xl mx-auto text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="font-display text-3xl font-bold text-navy dark:text-white mb-4">Tu tarjeta te está esperando</h2>
          <p className="font-body text-slate-secondary mb-8">
            Abrí tu cuenta en 5 minutos y empezá a usar Monix hoy.
          </p>
          <Link to="/register" className="inline-block">
            <Button variant="primary" className="px-8 py-3.5 text-base font-semibold flex items-center gap-2">
              Abrí tu cuenta gratis
              <ArrowRight size={18} />
            </Button>
          </Link>
          <p className="mt-4 font-body text-sm text-slate-secondary">Sin costo de apertura ni de mantenimiento. La cerrás cuando quieras.</p>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-white dark:bg-navy-card border-t border-slate-200 dark:border-white/10 py-6 px-6 transition-colors duration-300">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <MonixLogoNavbar className="h-6 w-auto" variant={theme === 'dark' ? 'white' : 'default'} />
          <p className="font-body text-sm text-slate-secondary">
            © {new Date().getFullYear()} Monix. Todos los derechos reservados.
          </p>
        </div>
      </footer>

    </div>
  )
}
