import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface NotificacionesStore {
  lastReadAt: string | null
  markAllRead: () => void
}

export const useNotificacionesStore = create<NotificacionesStore>()(
  persist(
    (set) => ({
      lastReadAt: null,
      markAllRead: () => set({ lastReadAt: new Date().toISOString() }),
    }),
    { name: 'monix-notificaciones' }
  )
)
