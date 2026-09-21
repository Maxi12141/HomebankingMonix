import { Capacitor } from '@capacitor/core'
import toast from 'react-hot-toast'
import { registerSW } from 'virtual:pwa-register'

// Sólo tiene sentido en el navegador: la APK de Capacitor ya carga los
// assets embebidos localmente (webDir: dist) y tiene su propio mecanismo de
// aviso de build nuevo (ver recargarSiHayBuildNuevo.tsx) — registrar acá
// además un service worker duplicaría ese sistema sin necesidad.
export function registrarPwa() {
  if (Capacitor.isNativePlatform()) return

  const updateSW = registerSW({
    onNeedRefresh() {
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
}
