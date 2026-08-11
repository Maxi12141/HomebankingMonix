import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ArrowRightLeft, History, User } from 'lucide-react'

const links = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Inicio' },
  { to: '/transferir', icon: ArrowRightLeft, label: 'Transferir' },
  { to: '/historial', icon: History, label: 'Historial' },
  { to: '/perfil', icon: User, label: 'Perfil' },
]

export function Navbar() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-navy-card border-t border-white/10 z-50">
      <div className="flex justify-around py-2">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-body font-medium transition-colors
               ${isActive ? 'text-mint' : 'text-slate-secondary'}`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
