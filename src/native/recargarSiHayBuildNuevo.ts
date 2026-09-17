import { Capacitor } from '@capacitor/core'

const CLAVE = 'monix_build'

async function leerBuild() {
  const res = await fetch(`/monix-build.txt?t=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) return ''
  return (await res.text()).trim()
}

export function recargarSiHayBuildNuevo() {
  if (!Capacitor.isNativePlatform()) return

  const chequear = async () => {
    try {
      const id = await leerBuild()
      if (!id) return
      const prev = localStorage.getItem(CLAVE)
      if (prev && prev !== id) {
        localStorage.setItem(CLAVE, id)
        window.location.reload()
        return
      }
      localStorage.setItem(CLAVE, id)
    } catch {
      // Sin red no recargamos; la app sigue con lo último que cargó.
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
