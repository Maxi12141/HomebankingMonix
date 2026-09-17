import { useEffect, useState } from 'react'

export function useTecladoInset() {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const medir = () => {
      const cubierto = window.innerHeight - vv.height - vv.offsetTop
      setInset(Math.max(0, Math.round(cubierto)))
    }

    vv.addEventListener('resize', medir)
    vv.addEventListener('scroll', medir)
    window.addEventListener('focusin', medir)
    window.addEventListener('focusout', medir)
    medir()
    return () => {
      vv.removeEventListener('resize', medir)
      vv.removeEventListener('scroll', medir)
      window.removeEventListener('focusin', medir)
      window.removeEventListener('focusout', medir)
    }
  }, [])

  return inset
}
