import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRightLeft, Landmark, LayoutDashboard, PiggyBank, QrCode } from 'lucide-react'

const sideLinks = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Inicio' },
  { to: '/transferir', icon: ArrowRightLeft, label: 'Transferir' },
  { to: '/cuentas', icon: Landmark, label: 'Cuentas' },
  { to: '/reservas', icon: PiggyBank, label: 'Reservas' },
]

export function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const onQrScan = location.pathname === '/pagar' && params.get('scan') === '1'

  return (
    <nav
      id="tour-acciones-mobile"
      data-tour-fixed
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-navy-card/95 backdrop-blur-md border-t border-slate-200 dark:border-white/10"
    >
      <div className="relative flex items-end justify-around px-1 pt-2 pb-[max(0.4rem,env(safe-area-inset-bottom))]">
        {sideLinks.slice(0, 2).map((link) => (
          <SideLink key={link.to} {...link} />
        ))}

        <div className="w-16 shrink-0" aria-hidden />

        {sideLinks.slice(2).map((link) => (
          <SideLink key={link.to} {...link} />
        ))}

        <button
          type="button"
          onClick={() => navigate('/pagar?scan=1')}
          className="absolute left-1/2 -translate-x-1/2 -top-7 flex flex-col items-center"
          aria-label="Escanear QR para pagar"
        >
          <span className="relative flex h-14 w-16 items-center justify-center">
            <span className="qr-fab-ping absolute h-14 w-14 rounded-full bg-mint/40" />
            <span
              className={`qr-fab relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-mint text-navy shadow-lg shadow-mint/40 ${
                onQrScan ? 'ring-2 ring-navy/20 dark:ring-white/30' : ''
              }`}
            >
              <QrCode size={26} strokeWidth={2.2} />
            </span>
          </span>
          <span className={`mt-0.5 text-[10px] font-body font-medium ${onQrScan ? 'text-mint' : 'text-navy dark:text-white'}`}>
            QR
          </span>
        </button>
      </div>
    </nav>
  )
}

function SideLink({
  to,
  icon: Icon,
  label,
}: {
  to: string
  icon: typeof ArrowRightLeft
  label: string
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center gap-0.5 py-1 text-[10px] font-body font-medium transition-colors ${
          isActive ? 'text-mint' : 'text-slate-secondary'
        }`
      }
    >
      <Icon size={20} />
      {label}
    </NavLink>
  )
}
