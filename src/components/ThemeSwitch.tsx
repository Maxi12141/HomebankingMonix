import { lazy, Suspense } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useThemeStore } from '../stores/themeStore'

// El switch animado va en su propio chunk para no pesar en el JS inicial.
const SwitchButton = lazy(() => import('./kokonutui/switch-button'))

const SIN_FONDO = 'border-transparent bg-transparent dark:border-transparent dark:bg-transparent'

/** Botón de modo claro/oscuro. Mientras baja el chunk animado, un botón simple del mismo tamaño. */
export function ThemeSwitch() {
  const { theme, toggleTheme } = useThemeStore()
  const etiqueta = theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'

  return (
    <Suspense
      fallback={
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={etiqueta}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-navy dark:text-white"
        >
          {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      }
    >
      <SwitchButton
        size="touch"
        showLabel={false}
        theme={theme}
        onThemeChange={toggleTheme}
        className={SIN_FONDO}
      />
    </Suspense>
  )
}
