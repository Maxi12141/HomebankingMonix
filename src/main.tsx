import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fuentes servidas desde la app (antes Google Fonts: dos orígenes externos en el
// camino crítico). Sólo latín y sólo los pesos que se usan; Inter 600/700 no
// venían de Google y el navegador inventaba la negrita.
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/plus-jakarta-sans/latin-600.css'
import '@fontsource/plus-jakarta-sans/latin-700.css'
import './index.css'
import App from './App.tsx'
import { registrarPwa } from './lib/registrarPwa'
// Sólo por el efecto secundario de registrar el listener de
// beforeinstallprompt lo antes posible — ver comentario en el propio archivo.
import './lib/pwaInstallPrompt'

registrarPwa()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
