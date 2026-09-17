import { useEffect, useState } from 'react'
import { Camera, Mic, Nfc, ShieldCheck } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { esCelular } from '../lib/biometria'
import { pedirTodosLosPermisos } from '../native/monixRadio'
import { Button } from './ui/Button'

const OK_KEY = 'monix_permisos_ok'
const SKIP_KEY = 'monix_permisos_skip'

export function PermisosPrimeraVez() {
  const { user } = useAuthStore()
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user || !esCelular()) {
      setVisible(false)
      return
    }
    if (localStorage.getItem(OK_KEY) === '1') return
    if (sessionStorage.getItem(SKIP_KEY) === '1') return
    setVisible(true)
  }, [user])

  if (!visible) return null

  async function permitir() {
    setLoading(true)
    try {
      await pedirTodosLosPermisos()
      localStorage.setItem(OK_KEY, '1')
      setVisible(false)
    } finally {
      setLoading(false)
    }
  }

  function ahoraNo() {
    sessionStorage.setItem(SKIP_KEY, '1')
    setVisible(false)
  }

  return (
    <div className="fixed inset-0 z-[9000] bg-navy/70 flex items-end sm:items-center justify-center px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-10">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-navy-card p-6 shadow-xl">
        <div className="w-12 h-12 rounded-full bg-mint/15 text-mint flex items-center justify-center mb-4">
          <ShieldCheck size={24} />
        </div>
        <h2 className="font-display text-xl font-semibold text-navy dark:text-white mb-1">
          Permitir cámara, micrófono y NFC
        </h2>
        <p className="font-body text-sm text-slate-secondary mb-5">
          Monix los usa para escanear QR, hablar con Moni y acercar el teléfono. La huella y el Face ID se activan después en Perfil.
        </p>
        <ul className="flex flex-col gap-3 mb-6">
          <li className="flex items-start gap-3">
            <Camera size={18} className="text-mint shrink-0 mt-0.5" />
            <span className="font-body text-sm text-navy dark:text-white">Cámara para pagar con QR</span>
          </li>
          <li className="flex items-start gap-3">
            <Mic size={18} className="text-mint shrink-0 mt-0.5" />
            <span className="font-body text-sm text-navy dark:text-white">Micrófono para “okey Moni”</span>
          </li>
          <li className="flex items-start gap-3">
            <Nfc size={18} className="text-mint shrink-0 mt-0.5" />
            <span className="font-body text-sm text-navy dark:text-white">NFC y Bluetooth para Monix Cerca</span>
          </li>
        </ul>
        <Button type="button" loading={loading} onClick={() => { void permitir() }} className="w-full mb-3">
          Permitir todo
        </Button>
        <button
          type="button"
          onClick={ahoraNo}
          className="w-full font-body text-sm text-slate-secondary hover:text-navy dark:hover:text-white py-2"
        >
          Ahora no
        </button>
      </div>
    </div>
  )
}
