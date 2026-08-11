import { useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../store/authStore'
import { useCuentaStore } from '../store/cuentaStore'
import type { Persona } from '../types'

export function useAuth() {
  const { user, persona, loading, setUser, setPersona, setLoading, clear } = useAuthStore()
  const { clear: clearCuenta } = useCuentaStore()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchPersona(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchPersona(session.user.id)
      } else {
        clear()
        clearCuenta()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchPersona(userId: string) {
    const { data } = await supabase
      .from('personas')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    setPersona(data as Persona | null)
    setLoading(false)
  }

  async function login(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  return { user, persona, loading, login, logout }
}
