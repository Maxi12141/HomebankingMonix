import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import type { Persona } from '../types'

interface AuthState {
  user: User | null
  persona: Persona | null
  loading: boolean
  // auth.signUp() ya deja al usuario "logueado" (dispara onAuthStateChange)
  // antes de que RegisterPage termine de crear la persona/cuenta contra el
  // Banco Central y Supabase — esta bandera evita que PublicOnly lo saque
  // de /register a mitad de ese proceso.
  provisioning: boolean
  setUser: (user: User | null) => void
  setPersona: (persona: Persona | null) => void
  setLoading: (loading: boolean) => void
  setProvisioning: (provisioning: boolean) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  persona: null,
  loading: true,
  provisioning: false,
  setUser: (user) => set({ user }),
  setPersona: (persona) => set({ persona }),
  setLoading: (loading) => set({ loading }),
  setProvisioning: (provisioning) => set({ provisioning }),
  clear: () => set({ user: null, persona: null, loading: false, provisioning: false }),
}))
