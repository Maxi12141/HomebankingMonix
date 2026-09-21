export function isIosDevice() {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>
}

function getBarcodeDetector(): BarcodeDetectorLike | null {
  const Ctor = (window as unknown as {
    BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike
  }).BarcodeDetector
  if (!Ctor) return null
  try {
    return new Ctor({ formats: ['qr_code'] })
  } catch {
    return null
  }
}

async function waitFrame() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

export async function detectQrUntil(video: HTMLVideoElement, signal: AbortSignal): Promise<string> {
  const detector = getBarcodeDetector()
  if (detector) {
    while (!signal.aborted) {
      if (video.readyState >= 2) {
        const codes = await detector.detect(video)
        const raw = codes[0]?.rawValue?.trim()
        if (raw) return raw
      }
      await waitFrame()
    }
    throw new DOMException('Aborted', 'AbortError')
  }

  const jsQR = (await import('jsqr')).default
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('No se pudo leer el QR con la cámara')

  while (!signal.aborted) {
    if (video.readyState >= 2 && video.videoWidth > 0) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(image.data, image.width, image.height)
      const raw = code?.data?.trim()
      if (raw) return raw
    }
    await waitFrame()
  }
  throw new DOMException('Aborted', 'AbortError')
}

export function mensajeErrorCamara(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  const raw = err instanceof Error ? err.message : ''
  if (
    name === 'NotAllowedError'
    || name === 'PermissionDeniedError'
    || /permission|denied|notallowed|not allowed/i.test(raw)
  ) {
    return 'La cámara está bloqueada. En Perfil tocá “Permitir cámara, micrófono y NFC”. Si Android no pregunta, andá a Ajustes → Apps → Monix → Permisos → Cámara → Permitir. También sirve “Sacar foto del QR”.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No encontramos una cámara. Usá “Sacar foto del QR”.'
  }
  if (name === 'NotReadableError') {
    return 'La cámara está ocupada por otra app. Cerrala o usá “Sacar foto del QR”.'
  }
  if (raw.trim() && !/^permission denied$/i.test(raw.trim())) return raw
  return 'No se pudo abrir la cámara en vivo. Tocá “Sacar foto del QR”.'
}

/** iOS anula el permiso si getUserMedia no arranca en el mismo toque del botón. */
export async function pedirStreamCamara(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Este navegador no permite la cámara en vivo. Usá “Sacar foto del QR”.')
  }

  const intentos: MediaStreamConstraints[] = [
    { audio: false, video: { facingMode: { ideal: 'environment' } } },
    { audio: false, video: { facingMode: 'environment' } },
    { audio: false, video: true },
  ]

  let ultimo: unknown
  for (const constraints of intentos) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (err) {
      ultimo = err
    }
  }
  throw ultimo instanceof Error ? ultimo : new Error('No se pudo abrir la cámara')
}

export async function engancharCamara(video: HTMLVideoElement, stream: MediaStream) {
  video.setAttribute('playsinline', 'true')
  video.setAttribute('webkit-playsinline', 'true')
  video.muted = true
  video.autoplay = true
  video.srcObject = stream
  try {
    await video.play()
  } catch {
    /* muted + playsinline alcanza en iOS si play() llega tarde */
  }
}

export async function leerQrDeArchivo(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file)
  try {
    const detector = getBarcodeDetector()
    if (detector) {
      const codes = await detector.detect(bitmap)
      const raw = codes[0]?.rawValue?.trim()
      if (raw) return raw
    }

    const jsQR = (await import('jsqr')).default
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('No se pudo leer la foto')
    ctx.drawImage(bitmap, 0, 0)
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(image.data, image.width, image.height)
    const raw = code?.data?.trim()
    if (raw) return raw
    throw new Error('No vimos un QR de Monix en esa foto. Encuadrá el código y volvé a disparar.')
  } finally {
    bitmap.close()
  }
}

export function stopMediaStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

export function tieneLinterna(stream: MediaStream | null) {
  const track = stream?.getVideoTracks()[0]
  if (!track?.getCapabilities) return false
  return Boolean((track.getCapabilities() as { torch?: boolean }).torch)
}

export async function setLinterna(stream: MediaStream | null, on: boolean) {
  const track = stream?.getVideoTracks()[0]
  if (!track) return
  await track.applyConstraints({
    advanced: [{ torch: on } as MediaTrackConstraintSet],
  })
}

export async function startQrCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await pedirStreamCamara()
  await engancharCamara(video, stream)
  return stream
}

export async function waitForVideo(getVideo: () => HTMLVideoElement | null, signal: AbortSignal) {
  for (let i = 0; i < 45; i++) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    const video = getVideo()
    if (video) return video
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
  throw new Error('No se pudo abrir la cámara')
}
