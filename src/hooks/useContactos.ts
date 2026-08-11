import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Contacto } from '../types'

interface ContactosState {
  contactos: Contacto[]
  guardar: (c: Omit<Contacto, 'id' | 'savedAt'>) => void
  eliminar: (cbu: string) => void
  editarApodo: (cbu: string, apodo: string | null) => void
  isGuardado: (cbu: string) => boolean
}

const useContactosStore = create<ContactosState>()(
  persist(
    (set, get) => ({
      contactos: [],
      guardar: (c) => {
        const prev = get().contactos
        if (prev.some((x) => x.cbu === c.cbu)) return
        set({
          contactos: [
            { ...c, id: crypto.randomUUID(), savedAt: new Date().toISOString() },
            ...prev,
          ],
        })
      },
      eliminar: (cbu) =>
        set((state) => ({ contactos: state.contactos.filter((x) => x.cbu !== cbu) })),
      editarApodo: (cbu, apodo) =>
        set((state) => ({
          contactos: state.contactos.map((x) => (x.cbu === cbu ? { ...x, apodo } : x)),
        })),
      isGuardado: (cbu) => get().contactos.some((x) => x.cbu === cbu),
    }),
    {
      name: 'monix_contactos',
      // Migrate old localStorage format (plain array) to zustand persist shape
      migrate: (persisted: unknown) => {
        if (Array.isArray(persisted)) {
          return {
            contactos: (persisted as Contacto[]).map((c) => ({ ...c, apodo: c.apodo ?? null })),
          }
        }
        const state = persisted as { contactos?: Contacto[] }
        return {
          contactos: (state.contactos ?? []).map((c) => ({ ...c, apodo: c.apodo ?? null })),
        }
      },
      version: 1,
    },
  ),
)

export function useContactos() {
  return useContactosStore()
}
