export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Listener = () => void

let capturedEvent: BeforeInstallPromptEvent | null = null
let yaInstalada = false
const listeners = new Set<Listener>()

function notificar() {
  listeners.forEach((l) => l())
}

// Este módulo se importa desde main.tsx ANTES de montar React (ver
// src/main.tsx) a propósito: Chrome puede disparar `beforeinstallprompt`
// mientras todavía se ve la pantalla de carga inicial (App.tsx la mantiene
// ~2.4s mínimo), es decir antes de que LandingPage/LoginPage lleguen a
// montarse y suscribir su propio listener. Si nadie escucha en ese momento
// el evento se pierde para siempre en esa carga de página y el botón
// "Instalar" queda inutilizable (isDeferredPrompt null) aunque el navegador
// sí soporte instalar la PWA — por eso el listener vive acá, a nivel de
// módulo, y no dentro de un useEffect.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    capturedEvent = e as BeforeInstallPromptEvent
    notificar()
  })
  window.addEventListener('appinstalled', () => {
    yaInstalada = true
    capturedEvent = null
    notificar()
  })
}

export function getPromptCapturado() {
  return capturedEvent
}

export function consumirPromptCapturado() {
  capturedEvent = null
}

export function getYaInstalada() {
  return yaInstalada
}

export function suscribirPwaInstall(listener: Listener) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
