import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useCuenta } from './useCuenta'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabaseClient'
import { randomToken, parseCercaPayload } from '../lib/tokens'
import { isAbortError, monixRadio, radioCapabilities, type RadioCapabilities } from '../native/monixRadio'
import { CercaPrompt } from '../components/CercaPrompt'
import { useContactos } from './useContactos'
import {
  activarPresencia,
  abrirDestinoCerca,
  abrirDestinoCercaCuenta,
  desactivarPresencia,
  listarVisibles,
  presenciaPropia,
  resolverPersonaRed,
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
  filtro: string
  setFiltro: (q: string) => void
  error: string
  caps: RadioCapabilities
  transferirA: (token: string) => Promise<void>
  guardarContacto: (token: string) => Promise<void>
  esContacto: (token: string) => boolean
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
  const [filtro, setFiltro] = useState('')
  const tokenRef = useRef<string>(randomToken())
  const seenRef = useRef<Map<string, number>>(new Map())
  const caps = radioCapabilities()

  const mergePersona = useCallback((found: PersonaCerca) => {
    setNearby((prev) => {
      const rest = prev.filter((p) => p.token !== found.token && p.cuentaId !== found.cuentaId)
      return [found, ...rest].slice(0, 24)
    })
  }, [])

  const refrescarVisibles = useCallback(async () => {
    try {
      const visibles = await listarVisibles()
      setNearby((prev) => {
        const radio = prev.filter((p) => !p.cuentaId || visibles.some((v) => v.cuentaId === p.cuentaId))
        const keys = new Set(radio.map((p) => p.cuentaId ?? p.token))
        const extra = visibles.filter((v) => !keys.has(v.cuentaId ?? v.token))
        return [...extra, ...radio].slice(0, 24)
      })
    } catch {
      /* RPC todavía no aplicada o sin sesión */
    }
  }, [])

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
      if (isAbortError(err)) return
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

  const handleRaw = useCallback(async (raw: string, rssi?: number, opts?: { silent?: boolean }) => {
    const hint = parseCercaPayload(raw)
    if (!hint) return
    if (hint.kind === 'token' && hint.value === tokenRef.current) return
    const key = hint.value
    const last = seenRef.current.get(key) ?? 0
    if (Date.now() - last < 8_000) return
    seenRef.current.set(key, Date.now())
    try {
      const persona = hint.kind === 'token'
        ? await resolverPresencia(hint.value)
        : await resolverPersonaRed(hint.value, hint.kind === 'cbu')
      if (!persona) return
      const found: PersonaCerca = { ...persona, rssi }
      mergePersona(found)
      if (opts?.silent) return
      const promptedAt = Number(sessionStorage.getItem(`cerca_prompt_${found.token}`) ?? 0)
      if (Date.now() - promptedAt > PROMPT_COOLDOWN_MS) {
        sessionStorage.setItem(`cerca_prompt_${found.token}`, String(Date.now()))
        setPrompt(found)
      }
    } catch (err) {
      if (isAbortError(err)) return
      setError(err instanceof Error ? err.message : 'No se pudo identificar')
    }
  }, [mergePersona])

  useEffect(() => {
    const offNearby = monixRadio.onNearby((ev) => {
      void handleRaw(ev.payload ?? ev.token, ev.rssi)
    })
    const offNfc = monixRadio.onNfc((payload) => {
      void handleRaw(payload)
    })
    return () => {
      offNearby()
      offNfc()
    }
  }, [handleRaw])

  const startBusqueda = useCallback(async (opts?: { silent?: boolean }) => {
    setError('')
    setBuscando(true)
    try {
      await monixRadio.startScan()
      await monixRadio.startNfcListen().catch((err) => {
        if (isAbortError(err)) return
        if (caps.nfc && !opts?.silent) {
          const msg = err instanceof Error ? err.message : 'No se pudo activar el NFC'
          setError(msg)
        }
      })
      await refrescarVisibles()
    } catch (err) {
      if (isAbortError(err)) return
      if (opts?.silent) {
        await refrescarVisibles()
        return
      }
      const msg = err instanceof Error ? err.message : 'No se pudo buscar personas cerca'
      setError(msg)
      toast.error(msg)
      await refrescarVisibles()
    }
  }, [caps.nfc, refrescarVisibles])

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

  useEffect(() => {
    if (!user || !buscando) return
    const id = window.setInterval(() => {
      void refrescarVisibles()
    }, 8_000)
    return () => window.clearInterval(id)
  }, [user, buscando, refrescarVisibles])

  useEffect(() => {
    const q = filtro.trim()
    if (!q) return
    const hint = parseCercaPayload(q)
    if (!hint || hint.kind === 'token') return
    const id = window.setTimeout(() => {
      void handleRaw(hint.value, undefined, { silent: true })
    }, 450)
    return () => window.clearTimeout(id)
  }, [filtro, handleRaw])

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

  async function abrirTransferencia(persona: PersonaCerca): Promise<DestinoCerca | null> {
    try {
      if (persona.cbu) {
        return {
          nombre: persona.nombre,
          apellido: persona.apellido,
          alias: persona.alias,
          cbu: persona.cbu,
          cuenta_id: persona.cuentaId ?? '',
          moneda: 'ARS',
        }
      }
      const dest = persona.cuentaId
        ? await abrirDestinoCercaCuenta(persona.cuentaId)
        : await abrirDestinoCerca(persona.token)
      setNearby((prev) => prev.map((p) => (
        p.token === persona.token ? { ...p, cbu: dest.cbu, alias: dest.alias } : p
      )))
      return dest
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
    filtro,
    setFiltro,
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
  const { guardar, isGuardado, contactos } = useContactos()

  const personaDe = useCallback((token: string) => {
    return runtime.nearby.find((p) => p.token === token)
      ?? (runtime.prompt?.token === token ? runtime.prompt : null)
  }, [runtime.nearby, runtime.prompt])

  const transferirA = useCallback(async (token: string) => {
    const persona = personaDe(token)
    if (!persona) return
    const destino = await runtime.abrirTransferencia(persona)
    if (!destino) return
    runtime.dismissPrompt()
    navigate('/transferir', {
      state: { cbu: destino.cbu, fromCerca: true, banco: persona.banco },
    })
  }, [navigate, personaDe, runtime])

  const guardarContacto = useCallback(async (token: string) => {
    const persona = personaDe(token)
    if (!persona) return
    const destino = await runtime.abrirTransferencia(persona)
    if (!destino) return
    if (isGuardado(destino.cbu)) {
      toast.success('Ya está en tus contactos')
      return
    }
    guardar({
      nombre: destino.nombre,
      apellido: destino.apellido,
      cbu: destino.cbu,
      alias: destino.alias,
      apodo: null,
    })
    toast.success(`Guardamos a ${destino.nombre} ${destino.apellido} en contactos`)
  }, [guardar, isGuardado, personaDe, runtime])

  const esContacto = useCallback((token: string) => {
    const persona = personaDe(token)
    if (!persona) return false
    if (persona.cbu && isGuardado(persona.cbu)) return true
    const alias = persona.alias?.toLowerCase()
    return Boolean(alias && contactos.some((c) => c.alias?.toLowerCase() === alias))
  }, [contactos, isGuardado, personaDe])

  const value: CercaState = {
    visible: runtime.visible,
    setVisible: runtime.setVisible,
    buscando: runtime.buscando,
    startBusqueda: runtime.startBusqueda,
    nearby: runtime.nearby,
    filtro: runtime.filtro,
    setFiltro: runtime.setFiltro,
    error: runtime.error,
    caps: runtime.caps,
    transferirA,
    guardarContacto,
    esContacto,
  }

  return (
    <CercaContext.Provider value={value}>
      {children}
      {runtime.prompt && (
        <CercaPrompt
          persona={runtime.prompt}
          onTransferir={() => { void transferirA(runtime.prompt!.token) }}
          onGuardar={() => { void guardarContacto(runtime.prompt!.token) }}
          onDismiss={runtime.dismissPrompt}
        />
      )}
    </CercaContext.Provider>
  )
}
