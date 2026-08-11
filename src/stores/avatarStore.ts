import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AvatarStore {
  photos: Record<string, string>
  setPhoto: (userId: string, dataUrl: string) => void
  removePhoto: (userId: string) => void
}

export const useAvatarStore = create<AvatarStore>()(
  persist(
    (set) => ({
      photos: {},
      setPhoto: (userId, dataUrl) =>
        set((s) => ({ photos: { ...s.photos, [userId]: dataUrl } })),
      removePhoto: (userId) =>
        set((s) => {
          const next = { ...s.photos }
          delete next[userId]
          return { photos: next }
        }),
    }),
    { name: 'monix-avatars' }
  )
)
