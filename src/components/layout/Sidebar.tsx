import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ArrowRightLeft, History, User, LogOut, PiggyBank, BookUser, CreditCard, Vault, Receipt } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

const links = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Inicio' },
  { to: '/transferir', icon: ArrowRightLeft, label: 'Transferir' },
  { to: '/pagar', icon: Receipt, label: 'Pagar' },
  { to: '/depositar', icon: PiggyBank, label: 'Depositar' },
  { to: '/reservas', icon: Vault, label: 'Reservas' },
  { to: '/tarjeta', icon: CreditCard, label: 'Mi tarjeta' },
  { to: '/historial', icon: History, label: 'Historial' },
  { to: '/contactos', icon: BookUser, label: 'Contactos' },
  { to: '/perfil', icon: User, label: 'Perfil' },
]

export function Sidebar() {
  const { logout } = useAuth()

  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen bg-white dark:bg-navy-card border-r border-slate-200 dark:border-white/10 py-8 px-4 gap-2">
      <div className="mb-8 px-2">
        <span className="font-display text-2xl font-bold text-navy dark:text-mint tracking-tight">Monix</span>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
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
        onClick={logout}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-body font-medium text-sm text-slate-secondary hover:text-navy dark:hover:text-white hover:bg-navy/5 dark:hover:bg-white/5 transition-[transform,background-color,color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:translate-x-1"
      >
        <LogOut size={18} />
        Cerrar sesión
      </button>
    </aside>
  )
}
