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

export async function startQrCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false,
  })
  video.srcObject = stream
  video.setAttribute('playsinline', 'true')
  video.muted = true
  await video.play()
  return stream
}

export function stopMediaStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
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
