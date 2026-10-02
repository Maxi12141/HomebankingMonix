import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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
