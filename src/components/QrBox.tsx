import { useEffect, useState } from 'react'

export function QrBox({
  value,
  alt = 'Código QR Monix',
  onReady,
}: {
  value: string
  alt?: string
  onReady?: (dataUrl: string) => void
}) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let alive = true
    void import('qrcode').then((QR) =>
      // El JWT del QR interbancario (con jti, cid y monto) es largo: con
      // corrección "L" el QR tiene menos módulos (en una pantalla no hay
      // manchas que corregir) y a 560 px queda nítido en pantallas de alta
      // densidad — se lee mucho mejor desde otro celular.
      QR.toDataURL(value, {
        width: 560,
        margin: 1,
        errorCorrectionLevel: 'L',
        color: { dark: '#0D2B52', light: '#ffffff' },
      }).then((url) => {
        if (!alive) return
        setSrc(url)
        onReady?.(url)
      }),
    )
    return () => { alive = false }
  }, [value])
  if (!src) return <div className="w-56 h-56 rounded-xl bg-slate-input dark:bg-white/5 animate-pulse mx-auto" />
  return <img src={src} alt={alt} className="w-56 h-56 mx-auto rounded-xl bg-white p-2" />
}
