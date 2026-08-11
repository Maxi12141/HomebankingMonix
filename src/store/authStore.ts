import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import type { Persona } from '../types'

interface AuthState {
  user: User | null
  persona: Persona | null
  loading: boolean
  setUser: (user: User | null) => void
  setPersona: (persona: Persona | null) => void
  setLoading: (loading: boolean) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  persona: null,
  loading: true,
  setUser: (user) => set({ user }),
  setPersona: (persona) => set({ persona }),
  setLoading: (loading) => set({ loading }),
  clear: () => set({ user: null, persona: null, loading: false }),
}))
