import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  consumoIngresoConClave,
  esCelular,
  huellaActiva,
} from '../lib/biometria'

const RELOCK_MS = 2_000

export function useBiometriaLock(user: User | null) {
  const sesionAbierta = useRef(false)
  const lockedRef = useRef(false)

  const [locked, setLocked] = useState(() => {
    if (!user) return false
    if (sessionStorage.getItem('monix_just_authed') === '1') {
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
    setLocked(false)
  }, [])

  useEffect(() => {
    if (!user) {
      sesionAbierta.current = false
      setLocked(false)
      return
    }
    if (consumoIngresoConClave()) {
      sesionAbierta.current = true
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
    let hiddenAt = 0

    function onVis() {
      if (!user) return
      if (document.hidden) {
        if (lockedRef.current) {
          hiddenAt = 0
          return
        }
        hiddenAt = Date.now()
        return
      }
      if (hiddenAt && Date.now() - hiddenAt >= RELOCK_MS && shouldLock(user.id)) {
        sesionAbierta.current = false
        setLocked(true)
      }
      hiddenAt = 0
    }

    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [user, shouldLock])

  return {
    locked,
    unlock,
  }
}
