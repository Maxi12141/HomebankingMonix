import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { aplicarBarraDeEstado } from './native/statusBar'
import { recargarSiHayBuildNuevo } from './native/recargarSiHayBuildNuevo'
import { useThemeStore } from './stores/themeStore'

void aplicarBarraDeEstado(useThemeStore.getState().theme)
recargarSiHayBuildNuevo()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
