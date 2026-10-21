import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRightLeft, BarChart2, ShieldCheck, ArrowRight, Sun, Moon, CheckCircle2, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '../components/ui/Button'
import { MarketTicker } from '../components/MarketTicker'
import { lazy, Suspense } from 'react'
import { TarjetaMini } from '../components/TarjetaPiezas'
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

const features = [
  {
    icon: ArrowRightLeft,
    title: 'Transferencias al instante',
    description: 'Enviá dinero por CBU o alias en segundos, las 24 horas del día.',
  },
  {
    icon: BarChart2,
    title: 'Historial completo',
    description: 'Seguí cada movimiento de tu cuenta con detalles y comprobantes en PDF.',
  },
  {
    icon: ShieldCheck,
    title: '100% seguro',
    description: 'Tu dinero y tus datos protegidos con los más altos estándares de seguridad.',
  },
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
    subtitle: '2% cashback en QR y débito',
    features: [
      'Hasta $800.000 de límite inicial',
      '3 y 6 cuotas sin interés en comercios adheridos',
      '2% de cashback con QR o débito',
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
          <MonixLogoNavbar className="h-6 sm:h-8 w-auto shrink-0" variant={theme === 'dark' ? 'white' : 'default'} />
          <nav className="flex items-center gap-1.5 sm:gap-3">
            <button
              onClick={toggleTheme}
              className="p-1.5 sm:p-2 rounded-xl text-slate-secondary hover:text-navy dark:hover:text-white hover:bg-navy/5 dark:hover:bg-white/5 transition-colors shrink-0"
              aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {theme === 'dark' ? <Sun size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Moon size={16} className="sm:w-[18px] sm:h-[18px]" />}
            </button>
            <Link to="/login">
              <Button variant="secondary-light" className="py-1.5 px-2.5 text-xs sm:py-2 sm:px-4 sm:text-sm whitespace-nowrap">Iniciá sesión</Button>
            </Link>
            <Link to="/register">
              <Button variant="primary" className="py-1.5 px-2.5 text-xs sm:py-2 sm:px-4 sm:text-sm whitespace-nowrap">Registrate</Button>
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
            Pesos, dólares y 2% de cashback en una sola app.
            Abrís tu cuenta online en 5 minutos, sin costo.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col items-center gap-4 lg:items-start">
            <Link to="/register">
              <Button variant="primary" className="px-8 py-3.5 text-base font-semibold flex items-center gap-2">
                Abrí tu cuenta gratis
                <ArrowRight size={18} />
              </Button>
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

      {/* Features */}
      <section className="bg-slate-input dark:bg-navy-card py-20 px-6 transition-colors duration-300">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-display text-3xl font-bold text-navy dark:text-white mb-3">Todo lo que necesitás</h2>
            <p className="font-body text-slate-secondary text-lg">Diseñado para que manejes tu plata sin complicaciones.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                className="bg-white dark:bg-navy rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-white/10"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <div className="w-11 h-11 rounded-xl bg-mint/10 flex items-center justify-center text-navy dark:text-mint mb-4">
                  <feature.icon size={22} />
                </div>
                <h3 className="font-display text-lg font-semibold text-navy dark:text-white mb-2">{feature.title}</h3>
                <p className="font-body text-slate-secondary text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
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

      {/* CTA final */}
      <section className="py-20 px-6 bg-slate-input dark:bg-navy-card transition-colors duration-300">
        <motion.div
          className="max-w-xl mx-auto text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="font-display text-3xl font-bold text-navy dark:text-white mb-4">Empezá hoy, es gratis</h2>
          <p className="font-body text-slate-secondary mb-8">
            Abrí tu cuenta en minutos y empezá a usar todos los beneficios de Monix.
          </p>
          <Link to="/register">
            <Button variant="primary" className="px-10 py-3.5 text-base font-semibold">Crear cuenta gratis</Button>
          </Link>
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
