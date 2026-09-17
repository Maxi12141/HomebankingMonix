import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  consumoIngresoConClave,
  esCelular,
  huellaActiva,
} from '../lib/biometria'

const RELOCK_MS = 20_000

export function useBiometriaLock(user: User | null) {
  const [locked, setLocked] = useState(() => {
    if (!user) return false
    if (sessionStorage.getItem('monix_just_authed') === '1') return false
    return esCelular() && huellaActiva(user.id)
  })

  const shouldLock = useCallback((uid: string) => {
    return esCelular() && huellaActiva(uid)
  }, [])

  useEffect(() => {
    if (!user) {
      setLocked(false)
      return
    }
    if (consumoIngresoConClave() || !shouldLock(user.id)) {
      setLocked(false)
      return
    }
    setLocked(true)
  }, [user, shouldLock])

  useEffect(() => {
    if (!user) return
    let hiddenAt = 0

    function onVis() {
      if (!user) return
      if (document.hidden) {
        hiddenAt = Date.now()
        return
      }
      if (hiddenAt && Date.now() - hiddenAt >= RELOCK_MS && shouldLock(user.id)) {
        setLocked(true)
      }
      hiddenAt = 0
    }

    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [user, shouldLock])

  return {
    locked,
    unlock: () => setLocked(false),
  }
}
