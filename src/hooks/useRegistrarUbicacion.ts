import { useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { esModoPrueba } from '../lib/modoPrueba'
import { useAuthStore } from '../store/authStore'
import { idDeSesion } from '../utils/dosPasos'

/** Una vez por sesión guarda la ciudad aproximada que informa Vercel, para el panel de Perfil. */
export function useRegistrarUbicacion() {
  const uid = useAuthStore((s) => s.user?.id)

  useEffect(() => {
    if (!uid || esModoPrueba()) return
    let vigente = true

    async function registrar() {
      const { data: { session } } = await supabase.auth.getSession()
      const sesionId = session ? idDeSesion(session.access_token) : null
      if (!sesionId) return
      const clave = `monix_ubicacion_${sesionId}`
      if (sessionStorage.getItem(clave)) return

      const respuesta = await fetch('/api/ubicacion')
      if (!vigente || !respuesta.ok) return
      const { ciudad } = (await respuesta.json()) as { ciudad?: string }
      if (!ciudad) return
      const { error } = await supabase.rpc('guardar_ubicacion_sesion', { p_ciudad: ciudad })
      if (error) throw error
      sessionStorage.setItem(clave, '1')
    }

    // Es un dato extra: si falla, el panel se muestra sin la ciudad.
    registrar().catch((err) => console.error('No se pudo registrar la ubicación:', err))
    return () => { vigente = false }
  }, [uid])
}
