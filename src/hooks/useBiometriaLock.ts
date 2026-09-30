import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  consumoIngresoConClave,
  esCelular,
  huellaActiva,
} from '../lib/biometria'

const GRACIA_MS = 30_000
// localStorage: al salir, Android suele matar el WebView y sessionStorage no llega al regreso.
const ACTIVO_KEY = 'monix_activo_en'

function guardarMarca() {
  try {
    localStorage.setItem(ACTIVO_KEY, String(Date.now()))
  } catch {
    /* modo privado */
  }
}

function marcarActivo() {
  if (typeof document !== 'undefined' && document.hidden) return
  guardarMarca()
}

function dentroDeGracia() {
  try {
    const t = Number(localStorage.getItem(ACTIVO_KEY) || 0)
    return t > 0 && Date.now() - t < GRACIA_MS
  } catch {
    return false
  }
}

export function useBiometriaLock(user: User | null) {
  const sesionAbierta = useRef(false)
  const lockedRef = useRef(false)

  const [locked, setLocked] = useState(() => {
    if (!user) return false
    if (sessionStorage.getItem('monix_just_authed') === '1' || dentroDeGracia()) {
      sesionAbierta.current = true
      return false
    }
    return esCelular() && huellaActiva(user.id)
  })
  lockedRef.current = locked

  const shouldLock = useCallback((uid: string) => {
    return esCelular() && huellaActiva(uid)
  }, [])

  const unlock = useCallback(() => {
    sesionAbierta.current = true
    marcarActivo()
    setLocked(false)
  }, [])

  useEffect(() => {
    if (!user) {
      sesionAbierta.current = false
      setLocked(false)
      return
    }
    if (consumoIngresoConClave() || dentroDeGracia()) {
      sesionAbierta.current = true
      marcarActivo()
      setLocked(false)
      return
    }
    if (!shouldLock(user.id)) {
      setLocked(false)
      return
    }
    if (sesionAbierta.current) return
    setLocked(true)
  }, [user, shouldLock])

  useEffect(() => {
    if (!user) return

    function alSalir() {
      if (lockedRef.current) return
      guardarMarca()
    }

    function alVolver() {
      if (!user || document.hidden) return
      if (!shouldLock(user.id) || dentroDeGracia()) return
      sesionAbierta.current = false
      setLocked(true)
    }

    function onVis() {
      if (document.hidden) alSalir()
      else alVolver()
    }

    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', alSalir)
    window.addEventListener('pageshow', alVolver)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', alSalir)
      window.removeEventListener('pageshow', alVolver)
    }
  }, [user, shouldLock])

  useEffect(() => {
    if (!user || locked) return
    marcarActivo()
    const id = window.setInterval(marcarActivo, 5_000)
    return () => window.clearInterval(id)
  }, [user, locked])

  return {
    locked,
    unlock,
  }
}
