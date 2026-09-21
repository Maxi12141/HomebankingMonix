import { useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../store/authStore'
import { useCuentaStore } from '../store/cuentaStore'
import { registrarEmailUid } from '../lib/biometria'
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
  const { user, persona, loading, provisioning, setUser, setPersona, setLoading, clear } = useAuthStore()
  const { clear: clearCuenta } = useCuentaStore()

  useEffect(() => {
    let cancelled = false

    // En un reload en frío (p. ej. "pull to refresh" en el celular, o volver
    // de background) la red puede tardar un instante en estar lista —
    // reintentamos una vez antes de dar la sesión por perdida, para no
    // expulsar a alguien con una sesión guardada válida por un hueco de red
    // de un segundo.
    async function restaurarSesion(intento = 1): Promise<void> {
      try {
        const { data: { session } } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_TIMEOUT_MS,
          'Tiempo agotado al restaurar la sesión',
        )
        if (cancelled) return
        setUser(session?.user ?? null)
        if (session?.user) {
          if (session.user.email) registrarEmailUid(session.user.email, session.user.id)
          await fetchPersona(session.user.id)
        } else {
          setLoading(false)
        }
      } catch (err) {
        if (cancelled) return
        if (intento < 2) {
          await new Promise((resolve) => window.setTimeout(resolve, 1000))
          if (!cancelled) await restaurarSesion(intento + 1)
          return
        }
        console.error('Error al restaurar la sesión:', err)
        clear()
        clearCuenta()
        setLoading(false)
      }
    }

    void restaurarSesion()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        if (session.user.email) registrarEmailUid(session.user.email, session.user.id)
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

  return { user, persona, loading, provisioning, login, logout }
}
