import { useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../store/authStore'
import { useCuentaStore } from '../store/cuentaStore'
import { registrarEmailUid } from '../lib/biometria'
import { leerSesionConfiable, sesionPideCodigo } from '../utils/dosPasos'
import { marcarActividad } from '../utils/sesiones'
import { entrarModoPrueba, esModoPrueba, salirModoPrueba, soltarPruebaEnEntradaReal } from '../lib/modoPrueba'
import type { Session } from '@supabase/supabase-js'
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
  const { user, persona, loading, provisioning, pendienteCodigo, comprobandoDispositivo, setUser, setPersona, setLoading, setPendienteCodigo, setComprobandoDispositivo, clear } = useAuthStore()
  const { clear: clearCuenta } = useCuentaStore()

  useEffect(() => {
    let cancelled = false

    soltarPruebaEnEntradaReal()

    // /prueba no espera la sesión guardada: si este celular ya tenía una cuenta
    // con huella, esa pantalla tapaba el banco de prueba antes de entrar.
    const abrirPrueba = window.location.pathname === '/prueba'
    if (abrirPrueba || esModoPrueba()) {
      entrarModoPrueba(abrirPrueba ? { reiniciarTour: true } : undefined)
    }

    // En un reload en frío (p. ej. "pull to refresh" en el celular, o volver
    // de background) la red puede tardar un instante en estar lista —
    // reintentamos una vez antes de dar la sesión por perdida, para no
    // expulsar a alguien con una sesión guardada válida por un hueco de red
    // de un segundo.
    async function restaurarSesion(intento = 1): Promise<void> {
      if (esModoPrueba()) {
        entrarModoPrueba()
        return
      }
      try {
        const { data: { session } } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_TIMEOUT_MS,
          'Tiempo agotado al restaurar la sesión',
        )
        if (cancelled) return
        if (esModoPrueba()) {
          entrarModoPrueba()
          return
        }
        if (session?.user) {
          await aplicarSesion(session)
        } else {
          setUser(null)
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
        if (esModoPrueba()) {
          entrarModoPrueba()
          return
        }
        clear()
        clearCuenta()
        setLoading(false)
      }
    }

    if (!esModoPrueba()) void restaurarSesion()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (esModoPrueba()) {
        entrarModoPrueba()
        return
      }
      if (session?.user) {
        void aplicarSesion(session)
      } else {
        setUser(null)
        clear()
        clearCuenta()
      }
    })

    function alSalirDeLaPrueba() {
      if (!cancelled) void restaurarSesion()
    }
    window.addEventListener('monix-salir-prueba', alSalirDeLaPrueba)

    return () => {
      cancelled = true
      subscription.unsubscribe()
      window.removeEventListener('monix-salir-prueba', alSalirDeLaPrueba)
    }
  }, [])

  // Corre dentro de onAuthStateChange: no puede llamar a métodos de Auth.
  async function aplicarSesion(session: Session) {
    setUser(session.user)
    if (session.user.email) registrarEmailUid(session.user.email, session.user.id)
    if (sesionPideCodigo(session, leerSesionConfiable())) {
      setPersona(null)
      setPendienteCodigo(true)
      // El link de recuperación de contraseña siempre pide el código.
      if (window.location.pathname !== '/restablecer-contrasena') {
        setComprobandoDispositivo(true)
        const confiable = await import('../services/dispositivoConfianza')
          .then((m) => m.entrarConDispositivo(session))
          .catch(() => false)
        setComprobandoDispositivo(false)
        if (confiable) {
          setPendienteCodigo(false)
          await fetchPersona(session.user.id)
          return
        }
      }
      setLoading(false)
      return
    }
    setPendienteCodigo(false)
    await fetchPersona(session.user.id)
  }

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
    marcarActividad()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data.user
  }

  async function logout() {
    if (esModoPrueba()) {
      salirModoPrueba()
      return
    }
    // Sale de este dispositivo. Para cerrar otros está el panel de Perfil.
    await supabase.auth.signOut({ scope: 'local' })
  }

  return { user, persona, loading, provisioning, pendienteCodigo, comprobandoDispositivo, login, logout }
}
