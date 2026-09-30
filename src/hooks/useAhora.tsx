import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../store/authStore'
import { useCuenta } from './useCuenta'
import { AhoraPrompt } from '../components/AhoraPrompt'
import {
  cobrosEntrantes,
  pagarCobroAhora,
  rechazarCobroAhora,
  type CobroAhora,
} from '../services/ahora'
import { formatMonto } from '../utils/cuenta'

export function AhoraProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthStore()
  const { refreshCuenta } = useCuenta()
  const [entrante, setEntrante] = useState<CobroAhora | null>(null)
  const [pagando, setPagando] = useState(false)
  const [error, setError] = useState('')
  const refreshRef = useRef(refreshCuenta)
  refreshRef.current = refreshCuenta

  const cargar = useCallback(async () => {
    if (!user) {
      setEntrante(null)
      return
    }
    try {
      const rows = await cobrosEntrantes()
      setEntrante(rows[0] ?? null)
    } catch {
      /* si la base todavía no tiene la función, no tapar el banco */
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    void cargar()
    const timer = window.setInterval(() => void cargar(), 3000)
    let channel: ReturnType<typeof supabase.channel> | null = null
    try {
      channel = supabase
        .channel(`ahora-in-${user.id}-${Math.random().toString(36).slice(2, 8)}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'cobros_ahora',
          filter: `pagador_persona_id=eq.${user.id}`,
        }, () => { void cargar() })
        .subscribe()
    } catch (err) {
      console.error('No se pudo escuchar Monix Ahora:', err)
    }
    return () => {
      window.clearInterval(timer)
      const ch = channel
      window.setTimeout(() => {
        if (ch) void supabase.removeChannel(ch)
      }, 400)
    }
  }, [user, cargar])

  async function pagar() {
    if (!entrante || pagando) return
    setPagando(true)
    setError('')
    try {
      const pagado = await pagarCobroAhora(entrante.id)
      setEntrante(null)
      await refreshRef.current()
      toast.success(`Pagaste ${formatMonto(pagado.monto, 'ARS')} a ${pagado.nombre}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo pagar')
      void cargar()
    } finally {
      setPagando(false)
    }
  }

  async function rechazar() {
    if (!entrante || pagando) return
    setPagando(true)
    setError('')
    try {
      await rechazarCobroAhora(entrante.id)
      setEntrante(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo rechazar')
      void cargar()
    } finally {
      setPagando(false)
    }
  }

  return (
    <>
      {children}
      {entrante && entrante.estado === 'pendiente' && (
        <AhoraPrompt
          cobro={entrante}
          pagando={pagando}
          error={error}
          onPagar={() => { void pagar() }}
          onRechazar={() => { void rechazar() }}
        />
      )}
    </>
  )
}
