import { create } from 'zustand'

interface SalidaPruebaState {
  abierta: boolean
  abrir: () => void
  cerrar: () => void
}

export const useSalidaPruebaStore = create<SalidaPruebaState>((set) => ({
  abierta: false,
  abrir: () => set({ abierta: true }),
  cerrar: () => set({ abierta: false }),
}))
