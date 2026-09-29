import { Capacitor } from '@capacitor/core'
import toast from 'react-hot-toast'
import { registerSW } from 'virtual:pwa-register'

// Sólo tiene sentido en el navegador: la APK de Capacitor ya carga los
// assets embebidos localmente (webDir: dist) y tiene su propio mecanismo de
// aviso de build nuevo (ver recargarSiHayBuildNuevo.tsx) — registrar acá
// además un service worker duplicaría ese sistema sin necesidad.
export function registrarPwa() {
  if (Capacitor.isNativePlatform()) return

  let registro: ServiceWorkerRegistration | undefined
  const inicio = Date.now()

  const updateSW = registerSW({
    onRegisteredSW(_url, registration) {
      registro = registration
    },
    onNeedRefresh() {
      // Recién abierta la app (los primeros segundos, típicamente el chequeo
      // que dispara el propio registro del service worker): no hay nada que
      // perder, se aplica sola. Pasado ese margen — alguien puede estar en
      // medio de un formulario — sólo se avisa con el toast.
      if (Date.now() - inicio < 10_000) {
        void updateSW(true)
        return
      }
      toast(
        (t) => (
          <span className="flex items-center gap-3">
            Nueva versión disponible
            <button
              type="button"
              onClick={() => {
                toast.dismiss(t.id)
                void updateSW(true)
              }}
              className="font-semibold text-mint underline underline-offset-2"
            >
              Actualizar
            </button>
          </span>
        ),
        { id: 'pwa-nueva-version', duration: Infinity },
      )
    },
  })

  // Una PWA instalada que se reabre desde el ícono (sin navegación real) casi
  // nunca dispara el chequeo automático del navegador — se fuerza a mano cada
  // vez que la app vuelve a primer plano.
  const forzarChequeo = () => { void registro?.update() }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') forzarChequeo()
  })
  window.addEventListener('focus', forzarChequeo)
  window.addEventListener('pageshow', forzarChequeo)
  window.setInterval(() => {
    if (document.visibilityState === 'visible') forzarChequeo()
  }, 20_000)
}
