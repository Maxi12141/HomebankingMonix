import { useCallback, useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import {
  consumirPromptCapturado, getPromptCapturado, getYaInstalada, suscribirPwaInstall,
} from '../lib/pwaInstallPrompt'

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
 *
 * El evento en sí se captura fuera de React (ver `lib/pwaInstallPrompt.ts`,
 * importado bien temprano desde main.tsx) para no perderlo si dispara
 * mientras todavía se ve la pantalla de carga inicial.
 */
export function usePwaInstall() {
  const [, setTick] = useState(0)
  const [instalada, setInstalada] = useState(() => esStandalone() || getYaInstalada())

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return
    return suscribirPwaInstall(() => {
      if (getYaInstalada()) setInstalada(true)
      setTick((n) => n + 1)
    })
  }, [])

  const mostrarBoton = !Capacitor.isNativePlatform() && !instalada

  const instalar = useCallback(async (): Promise<ResultadoInstalarPwa> => {
    const evento = getPromptCapturado()
    if (evento) {
      await evento.prompt()
      const { outcome } = await evento.userChoice
      consumirPromptCapturado()
      return outcome === 'accepted' ? 'instalada' : 'rechazada'
    }
    if (esIOS()) return 'manual-ios'
    return 'no-disponible'
  }, [])

  return { mostrarBoton, instalar }
}
