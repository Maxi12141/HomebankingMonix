import { useEffect, useState } from 'react'
import { hayCamaraDeVideo } from '../lib/scanQr'

const ESCRITORIO = '(min-width: 768px)'

export function useHayCamara() {
  const [hay, setHay] = useState(false)

  useEffect(() => {
    let vivo = true
    const mq = window.matchMedia(ESCRITORIO)

    async function mirar() {
      if (!mq.matches) {
        if (vivo) setHay(false)
        return
      }
      const ok = await hayCamaraDeVideo()
      if (vivo) setHay(ok)
    }

    void mirar()
    const onChange = () => { void mirar() }
    navigator.mediaDevices?.addEventListener('devicechange', onChange)
    mq.addEventListener('change', onChange)
    return () => {
      vivo = false
      navigator.mediaDevices?.removeEventListener('devicechange', onChange)
      mq.removeEventListener('change', onChange)
    }
  }, [])

  return hay
}
