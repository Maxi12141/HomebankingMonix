import { Capacitor, registerPlugin } from '@capacitor/core'

export function isNative(): boolean {
  if (typeof window === 'undefined') return false
  if (Capacitor.isNativePlatform()) return true
  if (Capacitor.getPlatform() === 'android') return true
  return Boolean((window as unknown as { androidBridge?: unknown }).androidBridge)
}

type MonixPlugin = {
  pedirCamara?: () => Promise<void>
  pedirMic?: () => Promise<void>
  pedirTodosLosPermisos?: () => Promise<void>
  requestPermissions?: () => Promise<void>
  abrirAjustes?: () => Promise<void>
  soportaBiometria?: () => Promise<{ ok?: boolean }>
  verificarBiometria?: () => Promise<void>
  startVoz?: () => Promise<void>
  stopVoz?: () => Promise<void>
  sacarFoto?: () => Promise<{ dataUrl?: string }>
  addListener: (event: string, cb: (data: Record<string, unknown>) => void) => Promise<{ remove: () => Promise<void> }>
}

async function getPlugin(): Promise<MonixPlugin | null> {
  if (!isNative()) return null
  return registerPlugin<MonixPlugin>('MonixRadio')
}

function conTiempo<T>(promesa: Promise<T>, ms: number) {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error('timeout')), ms)
    promesa.then(
      (v) => { window.clearTimeout(t); resolve(v) },
      (e) => { window.clearTimeout(t); reject(e) },
    )
  })
}

export async function pedirPermisoCamara() {
  try {
    const plugin = await getPlugin()
    const pedir = plugin?.pedirCamara
    if (!pedir) return
    await conTiempo(pedir(), 20_000)
  } catch {
    /* APK vieja o permiso ya negado: getUserMedia igual dispara el diálogo del WebView */
  }
}

export async function pedirPermisosNativos() {
  try {
    const plugin = await getPlugin()
    if (plugin?.pedirCamara) await conTiempo(plugin.pedirCamara(), 20_000).catch(() => undefined)
    if (plugin?.pedirMic) await conTiempo(plugin.pedirMic(), 20_000).catch(() => undefined)
  } catch {
    /* diálogo cancelado o APK vieja */
  }
}

async function pedirMediosWeb() {
  if (navigator.mediaDevices?.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      stream.getTracks().forEach((t) => t.stop())
    } catch {
      try {
        const cam = await navigator.mediaDevices.getUserMedia({ video: true })
        cam.getTracks().forEach((t) => t.stop())
      } catch {
        /* cámara denegada */
      }
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true })
        mic.getTracks().forEach((t) => t.stop())
      } catch {
        /* mic denegado */
      }
    }
  }
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
  } catch {
    /* notificaciones no disponibles */
  }
}

export async function pedirTodosLosPermisos() {
  await pedirPermisosNativos()
  if (isNative()) return
  await conTiempo(pedirMediosWeb(), 8_000).catch(() => undefined)
}

export async function abrirAjustesPermisos() {
  try {
    const plugin = await getPlugin()
    await plugin?.abrirAjustes?.()
  } catch {
    /* APK vieja */
  }
}

export async function soportaBiometriaNativa() {
  try {
    const plugin = await getPlugin()
    const res = await plugin?.soportaBiometria?.()
    return Boolean(res?.ok)
  } catch {
    return false
  }
}

export async function sacarFotoNativa(): Promise<Blob | null> {
  const plugin = await getPlugin()
  const fn = plugin?.sacarFoto
  if (!fn) throw new Error('Actualizá la APK de Monix para abrir la cámara')
  try {
    const res = await fn()
    const dataUrl = res?.dataUrl
    if (!dataUrl) return null
    const respuesta = await fetch(dataUrl)
    return respuesta.blob()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/cancel/i.test(msg)) return null
    throw err
  }
}

export async function verificarBiometriaNativa() {
  const plugin = await getPlugin()
  const fn = plugin?.verificarBiometria
  if (!fn) throw new Error('Instalá la APK nueva de Monix para usar huella o Face ID')
  try {
    await conTiempo(fn(), 90_000)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err ?? '')
    if (/not implemented|unimplemented/i.test(msg)) {
      throw new Error('Instalá la APK nueva de Monix. La huella no se actualiza sola.')
    }
    if (/timeout/i.test(msg)) {
      throw new Error('El teléfono no mostró la huella. Reinstalá la APK nueva de Monix.')
    }
    throw err
  }
}

export async function startVozNativa() {
  const plugin = await getPlugin()
  const fn = plugin?.startVoz
  if (!fn) throw new Error('Actualizá la APK de Monix para hablarle a Moni')
  await fn()
}

export async function stopVozNativa() {
  try {
    const plugin = await getPlugin()
    await plugin?.stopVoz?.()
  } catch {
    /* ya estaba parado */
  }
}

export async function onVozNativa(handler: (text: string, isFinal: boolean) => void) {
  const plugin = await getPlugin()
  if (!plugin?.addListener) return null
  return plugin.addListener('voz', (data) => {
    handler(String(data.text ?? ''), Boolean(data.final))
  })
}

export function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const name = 'name' in err ? String(err.name) : ''
  const message = 'message' in err ? String(err.message) : ''
  return name === 'AbortError' || /signal is aborted/i.test(message)
}
