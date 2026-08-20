import { NavLink, Link } from 'react-router-dom'
import { LayoutDashboard, ArrowRightLeft, History, User, LogOut, X, PiggyBank, BookUser, CreditCard, Vault, Receipt, Landmark, Repeat } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useThemeStore } from '../../stores/themeStore'
import { MonixLogoNavbar } from '../MonixLogoNavbar'

const links = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Inicio' },
  { to: '/cuentas', icon: Landmark, label: 'Cuentas' },
  { to: '/dolares', icon: Repeat, label: 'Compra y Venta USD' },
  { to: '/transferir', icon: ArrowRightLeft, label: 'Transferir' },
  { to: '/pagar', icon: Receipt, label: 'Pagar' },
  { to: '/depositar', icon: PiggyBank, label: 'Depositar' },
  { to: '/reservas', icon: Vault, label: 'Reservas' },
  { to: '/tarjeta', icon: CreditCard, label: 'Mis Tarjetas' },
  { to: '/historial', icon: History, label: 'Historial' },
  { to: '/contactos', icon: BookUser, label: 'Contactos' },
  { to: '/perfil', icon: User, label: 'Perfil' },
]

interface Props {
  onClose: () => void
}

export function MobileDrawer({ onClose }: Props) {
  const { logout } = useAuth()
  const { theme } = useThemeStore()

  return (
    <div className="flex flex-col h-full py-6 px-4">
      <div className="flex items-center justify-between mb-8 px-2">
        <Link to="/dashboard" onClick={onClose}>
          <MonixLogoNavbar
            variant={theme === 'dark' ? 'white' : 'default'}
            className="h-7 w-auto"
          />
        </Link>
        <button
          onClick={onClose}
          className="text-slate-secondary hover:text-navy dark:hover:text-white transition-colors"
          aria-label="Cerrar menú"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl font-body font-medium text-sm transition-[transform,background-color,color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
               ${isActive
                 ? 'bg-mint text-navy shadow-sm shadow-mint/30'
                 : 'text-slate-secondary hover:text-navy dark:hover:text-white hover:bg-navy/5 dark:hover:bg-white/5 hover:translate-x-1'
               }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={() => { logout(); onClose() }}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-body font-medium text-sm text-slate-secondary hover:text-navy dark:hover:text-white hover:bg-navy/5 dark:hover:bg-white/5 transition-[transform,background-color,color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:translate-x-1"
      >
        <LogOut size={18} />
        Cerrar sesión
      </button>
    </div>
  )
}
