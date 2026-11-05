import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import { esCelular, huellaActiva } from '../lib/biometria'
import { esModoPrueba } from '../lib/modoPrueba'
import { useAuthStore } from '../store/authStore'
import { inactividadVencida, leerUltimaActividad, marcarActividad } from '../utils/sesiones'

const REVISAR_CADA_MS = 30_000

/**
 * Sin biometría, a los 15 minutos sin uso se cierra la sesión, también si la app quedó cerrada.
 * Con biometría no hace falta: el bloqueo la pide al volver.
 */
export function useCierrePorInactividad() {
  const uid = useAuthStore((s) => s.user?.id)

  useEffect(() => {
    if (!uid || esModoPrueba()) return

    function revisar() {
      // El link de recuperación llega con una sesión nueva y hay que dejar cambiar la contraseña.
      if (window.location.pathname === '/restablecer-contrasena') {
        marcarActividad()
        return
      }
      if (document.hidden) return
      if (!inactividadVencida(leerUltimaActividad(), Date.now(), esCelular() && huellaActiva(uid!))) return
      toast('Cerramos tu sesión porque pasó un rato sin uso.', { id: 'cierre-inactividad' })
      void supabase.auth.signOut()
    }

    if (leerUltimaActividad() === null) marcarActividad()
    revisar()

    const alVolver = () => { if (!document.hidden) revisar() }
    const alUsar = () => marcarActividad()
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('pointerdown', alUsar, { passive: true })
    window.addEventListener('keydown', alUsar)
    const id = window.setInterval(revisar, REVISAR_CADA_MS)
    return () => {
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('pointerdown', alUsar)
      window.removeEventListener('keydown', alUsar)
      window.clearInterval(id)
    }
  }, [uid])
}
