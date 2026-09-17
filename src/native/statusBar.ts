import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

export async function aplicarBarraDeEstado(theme: 'light' | 'dark') {
  if (!Capacitor.isNativePlatform()) return
  try {
    await StatusBar.show()
    await StatusBar.setOverlaysWebView({ overlay: false })
    if (theme === 'dark') {
      await StatusBar.setBackgroundColor({ color: '#0D2B52' })
      await StatusBar.setStyle({ style: Style.Dark })
    } else {
      await StatusBar.setBackgroundColor({ color: '#FFFFFF' })
      await StatusBar.setStyle({ style: Style.Light })
    }
  } catch {
    // En el navegador o si el plugin no está, la app sigue igual.
  }
}
