import { useCallback, useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function esStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function esIOS() {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export type ResultadoInstalarPwa = 'instalada' | 'rechazada' | 'manual-ios' | 'no-disponible'

/**
 * Botón "Instalar Monix" — Chrome/Android disparan `beforeinstallprompt` y
 * ahí sí se puede instalar con un solo tap; Safari/iOS nunca lo dispara (no
 * lo soporta), así que ahí sólo se puede indicar el paso manual (Compartir →
 * Agregar a inicio). Nunca se muestra dentro de la APK de Capacitor (ya está
 * instalada) ni si el navegador ya la tiene instalada como PWA.
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [instalada, setInstalada] = useState(esStandalone())

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalada(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const mostrarBoton = !Capacitor.isNativePlatform() && !instalada

  const instalar = useCallback(async (): Promise<ResultadoInstalarPwa> => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      setDeferredPrompt(null)
      return outcome === 'accepted' ? 'instalada' : 'rechazada'
    }
    if (esIOS()) return 'manual-ios'
    return 'no-disponible'
  }, [deferredPrompt])

  return { mostrarBoton, instalar }
}
