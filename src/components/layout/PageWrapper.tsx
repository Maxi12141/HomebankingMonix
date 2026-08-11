import { useState } from 'react'
import type { ReactNode } from 'react'
import { Menu, Sun, Moon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MobileDrawer } from './MobileDrawer'
import { MonixLogoNavbar } from '../MonixLogoNavbar'
import { NotificationBell } from '../NotificationBell'
import { useSyncTransferenciasEntrantes } from '../../hooks/useSyncTransferenciasEntrantes'
import { useThemeStore } from '../../stores/themeStore'

interface PageWrapperProps {
  children: ReactNode
}

export function PageWrapper({ children }: PageWrapperProps) {
  useSyncTransferenciasEntrantes()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { theme, toggleTheme } = useThemeStore()

  return (
    <div className="flex min-h-screen bg-[#F0F2F5] dark:bg-navy font-body transition-colors duration-300">
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setDrawerOpen(false)}
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-navy-card border-r border-slate-200 dark:border-white/10 transform transition-transform duration-300 ease-in-out ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <MobileDrawer onClose={() => setDrawerOpen(false)} />
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-navy-card/90 backdrop-blur-md border-b border-slate-200 dark:border-white/10 flex items-center justify-between px-4 h-14 shrink-0">
          <div className="flex items-center gap-3">
            <button
              id="tour-menu"
              onClick={() => setDrawerOpen(true)}
              className="text-slate-secondary hover:text-navy dark:hover:text-white transition-colors"
              aria-label="Abrir menú"
            >
              <Menu size={24} />
            </button>
            <Link to="/dashboard">
              <MonixLogoNavbar
                variant={theme === 'dark' ? 'white' : 'default'}
                className="h-7 w-auto"
              />
            </Link>
          </div>

          <div className="flex items-center gap-1">
            <NotificationBell />
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-secondary hover:text-navy dark:hover:text-white hover:bg-navy/5 dark:hover:bg-white/5 transition-colors"
              aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
