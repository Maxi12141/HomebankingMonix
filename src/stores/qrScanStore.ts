import { create } from 'zustand'
import { pedirStreamCamara } from '../lib/scanQr'

type QrScanStore = {
  open: boolean
  originX: number
  originY: number
  streamPromise: Promise<MediaStream> | null
  openAt: (x: number, y: number) => void
  openFromElement: (el: HTMLElement) => void
  close: () => void
  takeStreamPromise: () => Promise<MediaStream> | null
}

function fabOrigin() {
  if (typeof window === 'undefined') return { x: 0, y: 0 }
  return { x: window.innerWidth / 2, y: window.innerHeight - 88 }
}

export const useQrScanStore = create<QrScanStore>((set, get) => ({
  open: false,
  originX: 0,
  originY: 0,
  streamPromise: null,
  openAt: (x, y) => {
    if (get().open) return
    set({
      open: true,
      originX: x,
      originY: y,
      streamPromise: pedirStreamCamara(),
    })
  },
  openFromElement: (el) => {
    const r = el.getBoundingClientRect()
    get().openAt(r.left + r.width / 2, r.top + r.height / 2)
  },
  close: () => {
    const pending = get().streamPromise
    set({ open: false, streamPromise: null })
    if (pending) {
      void pending.then((stream) => {
        stream.getTracks().forEach((track) => track.stop())
      }).catch(() => undefined)
    }
  },
  takeStreamPromise: () => {
    const pending = get().streamPromise
    if (pending) set({ streamPromise: null })
    return pending
  },
}))

export function openQrScanDefault() {
  const { x, y } = fabOrigin()
  useQrScanStore.getState().openAt(x, y)
}
