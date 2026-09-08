import { useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../store/authStore'
import { useCuentaStore } from '../store/cuentaStore'
import type { Persona } from '../types'

const AUTH_TIMEOUT_MS = 8000

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = window.setTimeout(() => reject(new Error(label)), ms)
    Promise.resolve(promise).then(
      (value) => { window.clearTimeout(id); resolve(value) },
      (err) => { window.clearTimeout(id); reject(err) },
    )
  })
}

export function useAuth() {
  const { user, persona, loading, setUser, setPersona, setLoading, clear } = useAuthStore()
  const { clear: clearCuenta } = useCuentaStore()

  useEffect(() => {
    let cancelled = false

    withTimeout(supabase.auth.getSession(), AUTH_TIMEOUT_MS, 'Tiempo agotado al restaurar la sesión')
      .then(({ data: { session } }) => {
        if (cancelled) return
        setUser(session?.user ?? null)
        if (session?.user) {
          return fetchPersona(session.user.id)
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error('Error al restaurar la sesión:', err)
        if (cancelled) return
        clear()
        clearCuenta()
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        void fetchPersona(session.user.id)
      } else {
        clear()
        clearCuenta()
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  async function fetchPersona(userId: string) {
    try {
      const query = supabase
        .from('personas')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      const { data, error } = await withTimeout(
        Promise.resolve(query),
        AUTH_TIMEOUT_MS,
        'Tiempo agotado al cargar el perfil',
      )
      if (error) console.error('Error al cargar el perfil:', error.message)
      setPersona(data as Persona | null)
    } catch (err) {
      console.error('Error al cargar el perfil:', err)
      setPersona(null)
    } finally {
      setLoading(false)
    }
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
