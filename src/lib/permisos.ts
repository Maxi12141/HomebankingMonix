// Pedido de permisos del navegador (cámara, micrófono y notificaciones) en
// un solo toque, para que después el QR y Moni no tengan que pedirlos.

function conTiempo<T>(promesa: Promise<T>, ms: number) {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error('timeout')), ms)
    promesa.then(
      (v) => { window.clearTimeout(t); resolve(v) },
      (e) => { window.clearTimeout(t); reject(e) },
    )
  })
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
  await conTiempo(pedirMediosWeb(), 8_000).catch(() => undefined)
}

export function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const name = 'name' in err ? String(err.name) : ''
  const message = 'message' in err ? String(err.message) : ''
  return name === 'AbortError' || /signal is aborted/i.test(message)
}
