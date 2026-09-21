import { Capacitor } from '@capacitor/core'
import toast from 'react-hot-toast'

const CLAVE = 'monix_build'

async function leerBuild() {
  const res = await fetch(`/monix-build.txt?t=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) return ''
  return (await res.text()).trim()
}

function avisarNuevaVersion() {
  toast(
    (t) => (
      <span className="flex items-center gap-3">
        Nueva versión disponible
        <button
          type="button"
          onClick={() => {
            toast.dismiss(t.id)
            window.location.reload()
          }}
          className="font-semibold text-mint underline underline-offset-2"
        >
          Actualizar
        </button>
      </span>
    ),
    { id: 'nueva-version-monix', duration: Infinity },
  )
}

export function recargarSiHayBuildNuevo() {
  if (!Capacitor.isNativePlatform()) return

  // Sólo el primer chequeo (arranque en frío del proceso) recarga solo, sin
  // avisar — no hay nada que perder porque la app recién está arrancando.
  // Los chequeos siguientes (foco/visibilidad/intervalo) sólo avisan con un
  // toast: recargar solo mientras el usuario puede estar completando un
  // formulario perdería lo que tenía escrito.
  let arranqueEnFrio = true

  const chequear = async () => {
    try {
      const id = await leerBuild()
      if (!id) return
      const prev = localStorage.getItem(CLAVE)
      if (prev && prev !== id) {
        localStorage.setItem(CLAVE, id)
        if (arranqueEnFrio) {
          window.location.reload()
        } else {
          avisarNuevaVersion()
        }
        return
      }
      localStorage.setItem(CLAVE, id)
    } catch {
      // Sin red no recargamos; la app sigue con lo último que cargó.
    } finally {
      arranqueEnFrio = false
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void chequear()
  })
  window.addEventListener('focus', () => { void chequear() })
  window.addEventListener('pageshow', () => { void chequear() })
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void chequear()
  }, 20_000)
  void chequear()
}
