import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRightLeft, BarChart2, ShieldCheck, ArrowRight, Sun, Moon, CheckCircle2 } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { MonixLogoAnimated } from '../components/MonixLogoAnimated'
import { MonixLogoNavbar } from '../components/MonixLogoNavbar'
import { useThemeStore } from '../stores/themeStore'
import monixLogoWhite from '../assets/logos/logo-blanco.svg'

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

/* ─── Chip EMV reutilizable ─────────────────────────────────────── */
function Chip({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <defs>
        <linearGradient id="chipGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f0c040" />
          <stop offset="50%" stopColor="#f8de80" />
          <stop offset="100%" stopColor="#c8980a" />
        </linearGradient>
      </defs>
      <rect x={x} y={y} width="44" height="34" rx="6" fill="url(#chipGold)" />
      <line x1={x} y1={y + 12} x2={x + 44} y2={y + 12} stroke="#8B6914" strokeWidth="1" strokeOpacity="0.55" />
      <line x1={x} y1={y + 22} x2={x + 44} y2={y + 22} stroke="#8B6914" strokeWidth="1" strokeOpacity="0.55" />
      <line x1={x + 18} y1={y} x2={x + 18} y2={y + 34} stroke="#8B6914" strokeWidth="1" strokeOpacity="0.55" />
      <line x1={x + 28} y1={y} x2={x + 28} y2={y + 34} stroke="#8B6914" strokeWidth="1" strokeOpacity="0.55" />
    </g>
  )
}

/* ─── Símbolo NFC reutilizable ──────────────────────────────────── */
function NFC({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="2.8" fill="white" fillOpacity="0.7" />
      <path d={`M ${cx} ${cy - 10} A 10 10 0 0 1 ${cx} ${cy + 10}`} fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeOpacity="0.7" />
      <path d={`M ${cx} ${cy - 16} A 16 16 0 0 1 ${cx} ${cy + 16}`} fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeOpacity="0.7" />
      <path d={`M ${cx} ${cy - 22} A 22 22 0 0 1 ${cx} ${cy + 22}`} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.62" />
    </g>
  )
}

/* ─── Tarjeta de Débito (Cuenta ARS) ────────────────────────────── */
function DebitCardSVG() {
  return (
    <svg viewBox="0 0 360 220" xmlns="http://www.w3.org/2000/svg" className="w-full">
      <defs>
        <linearGradient id="debitBg" x1="0" y1="0" x2="360" y2="220" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#062d52" />
          <stop offset="100%" stopColor="#001e3a" />
        </linearGradient>
        <linearGradient id="debitGloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.07" />
          <stop offset="55%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <clipPath id="debitClip">
          <rect width="360" height="220" rx="16" />
        </clipPath>
      </defs>

      <rect width="360" height="220" rx="16" fill="url(#debitBg)" />

      <g clipPath="url(#debitClip)">
        {/* Diagonal mint stripes – bottom-left corner */}
        <line x1="-30" y1="210" x2="130" y2="50" stroke="#26ffc1" strokeWidth="40" strokeOpacity="0.07" />
        <line x1="10" y1="240" x2="170" y2="80" stroke="#26ffc1" strokeWidth="28" strokeOpacity="0.055" />
        <line x1="50" y1="260" x2="210" y2="100" stroke="#26ffc1" strokeWidth="18" strokeOpacity="0.04" />
        {/* Mint accent line – top edge */}
        <rect x="0" y="0" width="360" height="3" rx="0" fill="#26ffc1" fillOpacity="0.55" />
        {/* Gloss */}
        <rect width="360" height="110" fill="url(#debitGloss)" />
        <rect x="0" y="0" width="360" height="1" fill="white" fillOpacity="0.08" />
      </g>

      {/* Logo Monix – top left */}
      <image href={monixLogoWhite} x="18" y="14" width="128" height="32" opacity="0.92" />

      {/* DÉBITO badge */}
      <rect x="18" y="52" width="54" height="14" rx="7" fill="#26ffc1" fillOpacity="0.18" />
      <text x="45" y="63" fontFamily="'Inter', sans-serif" fontSize="8" fontWeight="600" fill="#26ffc1" textAnchor="middle" letterSpacing="1">DÉBITO</text>

      <Chip x={26} y={86} />
      <NFC cx={84} cy={103} />

      {/* Número */}
      <text x="26" y="148" fontFamily="'Courier New', Courier, monospace" fontSize="19" fill="white" letterSpacing="3" fillOpacity="0.9">
        •••• •••• •••• 7234
      </text>

      {/* Valid thru */}
      <text x="26" y="176" fontFamily="'Inter', sans-serif" fontSize="8" fill="white" fillOpacity="0.5" letterSpacing="1.5">VÁLIDA HASTA</text>
      <text x="26" y="194" fontFamily="'Courier New', Courier, monospace" fontSize="14" fill="white" fillOpacity="0.85" letterSpacing="2">09/27</text>

      {/* Titular */}
      <text x="118" y="176" fontFamily="'Inter', sans-serif" fontSize="8" fill="white" fillOpacity="0.5" letterSpacing="1.5">TITULAR</text>
      <text x="118" y="194" fontFamily="'Inter', sans-serif" fontSize="13" fill="white" fillOpacity="0.85" letterSpacing="1">MARÍA GÓMEZ</text>

      {/* Visa Débito – bottom right */}
      <text x="334" y="194" fontFamily="'Times New Roman', Georgia, serif" fontSize="22" fontWeight="900" fill="white" fontStyle="italic" textAnchor="end" fillOpacity="0.9">VISA</text>
      <text x="334" y="208" fontFamily="'Inter', sans-serif" fontSize="8" fill="white" textAnchor="end" fillOpacity="0.55" letterSpacing="0.5">Débito</text>
    </svg>
  )
}

/* ─── Tarjeta USD ────────────────────────────────────────────────── */
function UsdCardSVG() {
  return (
    <svg viewBox="0 0 360 220" xmlns="http://www.w3.org/2000/svg" className="w-full">
      <defs>
        <linearGradient id="usdBg" x1="0" y1="0" x2="360" y2="220" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0a0f1e" />
          <stop offset="100%" stopColor="#040812" />
        </linearGradient>
        <linearGradient id="usdGloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.06" />
          <stop offset="55%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <clipPath id="usdClip">
          <rect width="360" height="220" rx="16" />
        </clipPath>
      </defs>

      <rect width="360" height="220" rx="16" fill="url(#usdBg)" />

      <g clipPath="url(#usdClip)">
        {/* Amber/gold arc decorations – bottom right */}
        <circle cx="360" cy="220" r="150" fill="none" stroke="#c9a227" strokeWidth="55" opacity="0.08" />
        <circle cx="360" cy="220" r="96" fill="none" stroke="#c9a227" strokeWidth="38" opacity="0.07" />
        {/* $ watermark */}
        <text x="248" y="198" fontFamily="'Georgia', serif" fontSize="115" fill="#c9a227" fillOpacity="0.05" fontWeight="bold">$</text>
        {/* Amber accent line – top */}
        <rect x="0" y="0" width="360" height="3" rx="0" fill="#c9a227" fillOpacity="0.5" />
        {/* Gloss */}
        <rect width="360" height="110" fill="url(#usdGloss)" />
        <rect x="0" y="0" width="360" height="1" fill="white" fillOpacity="0.07" />
      </g>

      {/* Logo Monix – top left */}
      <image href={monixLogoWhite} x="18" y="14" width="128" height="32" opacity="0.9" />

      {/* USD badge */}
      <rect x="18" y="52" width="42" height="14" rx="7" fill="#c9a227" fillOpacity="0.2" />
      <text x="39" y="63" fontFamily="'Inter', sans-serif" fontSize="8" fontWeight="600" fill="#c9a227" textAnchor="middle" letterSpacing="1">USD</text>

      <Chip x={26} y={86} />
      <NFC cx={84} cy={103} />

      {/* Número */}
      <text x="26" y="148" fontFamily="'Courier New', Courier, monospace" fontSize="19" fill="white" letterSpacing="3" fillOpacity="0.9">
        •••• •••• •••• 9102
      </text>

      {/* Valid thru */}
      <text x="26" y="176" fontFamily="'Inter', sans-serif" fontSize="8" fill="white" fillOpacity="0.5" letterSpacing="1.5">VÁLIDA HASTA</text>
      <text x="26" y="194" fontFamily="'Courier New', Courier, monospace" fontSize="14" fill="white" fillOpacity="0.85" letterSpacing="2">03/29</text>

      {/* Titular */}
      <text x="118" y="176" fontFamily="'Inter', sans-serif" fontSize="8" fill="white" fillOpacity="0.5" letterSpacing="1.5">TITULAR</text>
      <text x="118" y="194" fontFamily="'Inter', sans-serif" fontSize="13" fill="white" fillOpacity="0.85" letterSpacing="1">JUAN PÉREZ</text>

      {/* Mastercard – bottom right (dos círculos) */}
      <circle cx="314" cy="188" r="13" fill="#eb001b" fillOpacity="0.85" />
      <circle cx="330" cy="188" r="13" fill="#f79e1b" fillOpacity="0.85" />
      <text x="322" y="208" fontFamily="'Inter', sans-serif" fontSize="7" fill="white" textAnchor="middle" fillOpacity="0.5" letterSpacing="0.3">mastercard</text>
    </svg>
  )
}

/* ─── Tarjeta de Crédito ─────────────────────────────────────────── */
function CreditCardSVG() {
  return (
    <svg viewBox="0 0 360 220" xmlns="http://www.w3.org/2000/svg" className="w-full">
      <defs>
        <linearGradient id="creditBg" x1="0" y1="0" x2="360" y2="220" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#052548" />
          <stop offset="100%" stopColor="#001128" />
        </linearGradient>
        <linearGradient id="creditGloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.06" />
          <stop offset="55%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <clipPath id="creditClip">
          <rect width="360" height="220" rx="16" />
        </clipPath>
      </defs>

      <rect width="360" height="220" rx="16" fill="url(#creditBg)" />

      <g clipPath="url(#creditClip)">
        {/* Mint arc decorations – bottom right */}
        <circle cx="360" cy="220" r="150" fill="none" stroke="#26ffc1" strokeWidth="55" opacity="0.07" />
        <circle cx="360" cy="220" r="95" fill="none" stroke="#26ffc1" strokeWidth="36" opacity="0.07" />
        {/* Mint accent line – top */}
        <rect x="0" y="0" width="360" height="3" rx="0" fill="#26ffc1" fillOpacity="0.55" />
        {/* Gloss */}
        <rect width="360" height="110" fill="url(#creditGloss)" />
        <rect x="0" y="0" width="360" height="1" fill="white" fillOpacity="0.09" />
      </g>

      {/* Logo Monix – top left */}
      <image href={monixLogoWhite} x="18" y="14" width="128" height="32" opacity="0.92" />

      {/* CRÉDITO badge */}
      <rect x="18" y="52" width="58" height="14" rx="7" fill="#26ffc1" fillOpacity="0.18" />
      <text x="47" y="63" fontFamily="'Inter', sans-serif" fontSize="8" fontWeight="600" fill="#26ffc1" textAnchor="middle" letterSpacing="1">CRÉDITO</text>

      <Chip x={26} y={86} />
      <NFC cx={84} cy={103} />

      {/* Número */}
      <text x="26" y="148" fontFamily="'Courier New', Courier, monospace" fontSize="19" fill="white" letterSpacing="3" fillOpacity="0.9">
        •••• •••• •••• 4821
      </text>

      {/* Valid thru */}
      <text x="26" y="176" fontFamily="'Inter', sans-serif" fontSize="8" fill="white" fillOpacity="0.5" letterSpacing="1.5">VÁLIDA HASTA</text>
      <text x="26" y="194" fontFamily="'Courier New', Courier, monospace" fontSize="14" fill="white" fillOpacity="0.85" letterSpacing="2">12/28</text>

      {/* Titular */}
      <text x="118" y="176" fontFamily="'Inter', sans-serif" fontSize="8" fill="white" fillOpacity="0.5" letterSpacing="1.5">TITULAR</text>
      <text x="118" y="194" fontFamily="'Inter', sans-serif" fontSize="13" fill="white" fillOpacity="0.85" letterSpacing="1">JUAN PÉREZ</text>

      {/* VISA – bottom right */}
      <text x="334" y="194" fontFamily="'Times New Roman', Georgia, serif" fontSize="26" fontWeight="900" fill="white" fontStyle="italic" textAnchor="end" fillOpacity="0.9">VISA</text>
    </svg>
  )
}

/* ─── Datos de productos ─────────────────────────────────────────── */
const products = [
  {
    accentColor: '#26ffc1',
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
    CardMockup: DebitCardSVG,
  },
  {
    accentColor: '#c9a227',
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
    CardMockup: UsdCardSVG,
  },
  {
    accentColor: '#26ffc1',
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
    CardMockup: CreditCardSVG,
  },
]

/* ─── Página ─────────────────────────────────────────────────────── */
export function LandingPage() {
  const { theme, toggleTheme } = useThemeStore()

  return (
    <div className="min-h-screen bg-white dark:bg-navy text-navy dark:text-white transition-colors duration-300">

      {/* Navbar */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-navy-card/90 backdrop-blur-md border-b border-slate-200 dark:border-white/10 transition-colors duration-300">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <MonixLogoNavbar className="h-8 w-auto" variant={theme === 'dark' ? 'white' : 'default'} />
          <nav className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-secondary hover:text-navy dark:hover:text-white hover:bg-navy/5 dark:hover:bg-white/5 transition-colors"
              aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Link to="/login">
              <Button variant="secondary-light" className="py-2 px-4 text-sm">Iniciá sesión</Button>
            </Link>
            <Link to="/register">
              <Button variant="primary" className="py-2 px-4 text-sm">Registrate</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="min-h-[85vh] flex items-center justify-center px-6">
        <motion.div
          className="max-w-2xl mx-auto text-center"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="mb-8 flex justify-center">
            <MonixLogoAnimated
              className="h-16 md:h-20 w-auto"
              variant={theme === 'dark' ? 'white' : 'default'}
            />
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="font-display text-5xl md:text-6xl font-bold text-navy dark:text-white leading-tight mb-6"
          >
            Banca de verdad,{' '}
            <span className="text-mint">desde tu celular.</span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="font-body text-lg text-slate-secondary leading-relaxed mb-10 max-w-lg mx-auto"
          >
            Todo lo que necesitás de un banco, sin la complejidad de uno.
            Cuenta en pesos, dólares y crédito en un solo lugar.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button variant="primary" className="px-8 py-3.5 text-base font-semibold flex items-center gap-2">
                Abrí tu cuenta gratis
                <ArrowRight size={18} />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="secondary-light" className="px-8 py-3.5 text-base">Iniciá sesión</Button>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="bg-[#F0F2F5] dark:bg-navy-card py-20 px-6 transition-colors duration-300">
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
                <div className="w-11 h-11 rounded-xl bg-mint/10 flex items-center justify-center text-mint mb-4">
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
                className="bg-[#F0F2F5] dark:bg-navy-card rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 flex flex-col"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <div className="h-1" style={{ backgroundColor: product.accentColor }} />

                <div className="p-6 flex flex-col flex-1">
                  <span
                    className="inline-block self-start text-xs font-body font-semibold rounded-full px-3 py-1 mb-4"
                    style={{ color: product.accentColor, backgroundColor: `${product.accentColor}22` }}
                  >
                    {product.badge}
                  </span>

                  <h3 className="font-display text-xl font-bold text-navy dark:text-white mb-1">{product.title}</h3>
                  <p className="font-body text-sm text-slate-secondary mb-5">{product.subtitle}</p>

                  {/* Card mockup */}
                  <div className="mb-5 rounded-xl overflow-hidden shadow-lg ring-1 ring-black/10">
                    <product.CardMockup />
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
      <section className="py-20 px-6 bg-[#F0F2F5] dark:bg-navy-card transition-colors duration-300">
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
