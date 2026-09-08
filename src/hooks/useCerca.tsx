import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useCuenta } from './useCuenta'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabaseClient'
import { randomToken, parseRadioPayload } from '../lib/tokens'
import { monixRadio, radioCapabilities, type RadioCapabilities } from '../native/monixRadio'
import { CercaPrompt } from '../components/CercaPrompt'
import {
  activarPresencia,
  abrirDestinoCerca,
  desactivarPresencia,
  presenciaPropia,
  resolverPresencia,
  type DestinoCerca,
  type PersonaCerca,
} from '../services/cerca'

const VISIBLE_KEY = 'monix_cerca_visible'
const HEARTBEAT_MS = 4 * 60 * 1000
const PROMPT_COOLDOWN_MS = 120_000

interface CercaState {
  visible: boolean
  setVisible: (next: boolean) => Promise<void>
  buscando: boolean
  startBusqueda: (opts?: { silent?: boolean }) => Promise<void>
  nearby: PersonaCerca[]
  error: string
  caps: RadioCapabilities
  transferirA: (token: string) => Promise<void>
}

const CercaContext = createContext<CercaState | null>(null)

export function useCerca() {
  const ctx = useContext(CercaContext)
  if (!ctx) throw new Error('useCerca debe usarse dentro de CercaProvider')
  return ctx
}

function useCercaRuntime() {
  const { cuenta } = useCuenta()
  const { user, loading: authLoading } = useAuthStore()
  const [visible, setVisible] = useState(() => localStorage.getItem(VISIBLE_KEY) === '1')
  const [buscando, setBuscando] = useState(false)
  const [nearby, setNearby] = useState<PersonaCerca[]>([])
  const [prompt, setPrompt] = useState<PersonaCerca | null>(null)
  const [error, setError] = useState('')
  const tokenRef = useRef<string>(randomToken())
  const seenRef = useRef<Map<string, number>>(new Map())
  const caps = radioCapabilities()

  const publish = useCallback(async () => {
    if (!cuenta?.id || !visible) return
    const session = (await supabase.auth.getSession()).data.session
    if (!session?.access_token) return
    const token = randomToken()
    tokenRef.current = token
    await activarPresencia(cuenta.id, token)
    await monixRadio.startAdvertising({
      token,
      cuentaId: cuenta.id,
      accessToken: session.access_token,
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string,
      supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    })
  }, [cuenta?.id, visible])

  useEffect(() => {
    if (!user) return
    presenciaPropia()
      .then((row) => {
        if (row?.visible && new Date(row.expires_at) > new Date()) {
          setVisible(true)
          localStorage.setItem(VISIBLE_KEY, '1')
        }
      })
      .catch(() => undefined)
  }, [user])

  useEffect(() => {
    if (authLoading || !user || !cuenta?.id) {
      if (!authLoading && !user) {
        monixRadio.stopAdvertising().catch(() => undefined)
      }
      return
    }
    if (!visible) {
      desactivarPresencia().catch(() => undefined)
      monixRadio.stopAdvertising().catch(() => undefined)
      localStorage.setItem(VISIBLE_KEY, '0')
      return
    }
    localStorage.setItem(VISIBLE_KEY, '1')
    publish().catch((err) => {
      const msg = err instanceof Error ? err.message : 'No se pudo activar Cerca'
      if (/401|403|42501|JWT|autenticad|permission denied|not authorized/i.test(msg)) {
        console.warn('Monix Cerca: no se pudo activar presencia', msg)
        return
      }
      setError(msg)
    })
    const id = window.setInterval(() => {
      publish().catch(() => undefined)
    }, HEARTBEAT_MS)
    return () => window.clearInterval(id)
  }, [authLoading, user, cuenta?.id, visible, publish])

  const handleToken = useCallback(async (token: string, rssi?: number) => {
    if (!token || token === tokenRef.current) return
    const last = seenRef.current.get(token) ?? 0
    if (Date.now() - last < 8_000) return
    seenRef.current.set(token, Date.now())
    try {
      const persona = await resolverPresencia(token)
      if (!persona) return
      const found: PersonaCerca = { ...persona, rssi }
      setNearby((prev) => {
        const rest = prev.filter((p) => p.token !== token)
        return [found, ...rest].slice(0, 8)
      })
      const promptedAt = Number(sessionStorage.getItem(`cerca_prompt_${token}`) ?? 0)
      if (Date.now() - promptedAt > PROMPT_COOLDOWN_MS) {
        sessionStorage.setItem(`cerca_prompt_${token}`, String(Date.now()))
        setPrompt(found)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo identificar')
    }
  }, [])

  useEffect(() => {
    const offNearby = monixRadio.onNearby((ev) => {
      void handleToken(ev.token, ev.rssi)
    })
    const offNfc = monixRadio.onNfc((payload) => {
      const parsed = parseRadioPayload(payload)
      if (parsed?.kind === 'id') void handleToken(parsed.value)
    })
    return () => {
      offNearby()
      offNfc()
    }
  }, [handleToken])

  const startBusqueda = useCallback(async (opts?: { silent?: boolean }) => {
    setError('')
    setBuscando(true)
    try {
      await monixRadio.startScan()
      await monixRadio.startNfcListen().catch(() => undefined)
    } catch (err) {
      setBuscando(false)
      const msg = err instanceof Error ? err.message : 'No se pudo buscar personas cerca'
      setError(msg)
      if (!opts?.silent) toast.error(msg)
    }
  }, [])

  const stopBusqueda = useCallback(async () => {
    setBuscando(false)
    await monixRadio.stopScan().catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!user) return
    startBusqueda({ silent: true }).catch(() => undefined)
    return () => {
      stopBusqueda().catch(() => undefined)
    }
  }, [user, startBusqueda, stopBusqueda])

  async function setVisibleSafe(next: boolean) {
    setVisible(next)
    if (!next) {
      try {
        await desactivarPresencia()
        await monixRadio.stopAdvertising()
      } catch {
        /* already off */
      }
    }
  }

  async function abrirTransferencia(token: string): Promise<DestinoCerca | null> {
    try {
      return await abrirDestinoCerca(token)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo abrir la transferencia')
      return null
    }
  }

  return {
    visible,
    setVisible: setVisibleSafe,
    buscando,
    startBusqueda,
    nearby,
    prompt,
    dismissPrompt: () => setPrompt(null),
    abrirTransferencia,
    error,
    caps,
  }
}

export function CercaProvider({ children }: { children: ReactNode }) {
  const runtime = useCercaRuntime()
  const navigate = useNavigate()

  const transferirA = useCallback(async (token: string) => {
    const destino = await runtime.abrirTransferencia(token)
    if (!destino) return
    runtime.dismissPrompt()
    navigate('/transferir', { state: { cbu: destino.cbu, fromCerca: true } })
  }, [navigate, runtime])

  const value: CercaState = {
    visible: runtime.visible,
    setVisible: runtime.setVisible,
    buscando: runtime.buscando,
    startBusqueda: runtime.startBusqueda,
    nearby: runtime.nearby,
    error: runtime.error,
    caps: runtime.caps,
    transferirA,
  }

  return (
    <CercaContext.Provider value={value}>
      {children}
      {runtime.prompt && (
        <CercaPrompt
          persona={runtime.prompt}
          onTransferir={() => { void transferirA(runtime.prompt!.token) }}
          onDismiss={runtime.dismissPrompt}
        />
      )}
    </CercaContext.Provider>
  )
}
