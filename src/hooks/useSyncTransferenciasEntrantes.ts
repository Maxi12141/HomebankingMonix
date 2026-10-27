import { useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useCuentaStore } from '../store/cuentaStore'
import { esModoPrueba } from '../lib/modoPrueba'

// Candado de módulo: la sync corre desde App (CuentasGlobales) y también desde
// la pantalla del QR mientras espera un pago. El servidor ya no acredita dos
// veces la misma transferencia; esto sólo evita llamadas repetidas a la vez.
let enCurso: Promise<void> | null = null

/**
 * Pide al servidor que acredite las transferencias entrantes de las últimas
 * 24 h que todavía no están en movimientos. Si ya hay una pasada
 * corriendo, espera esa en vez de arrancar otra.
 */
export function sincronizarTransferenciasEntrantes(): Promise<void> {
  if (!enCurso) {
    enCurso = sincronizar().finally(() => { enCurso = null })
  }
  return enCurso
}

// La consulta al Banco Central y el crédito los hace la Edge Function
// sincronizar-entrantes (S-1, docs/auditoria-2026-10.md): el navegador ya no
// puede escribir saldos, y así tampoco puede inventarse una transferencia.
async function sincronizar() {
  if (esModoPrueba()) return
  const { cuentas, triggerRefresh } = useCuentaStore.getState()
  if (cuentas.length === 0) return
  try {
    const { data, error } = await supabase.functions.invoke<{ acreditadas: number }>('sincronizar-entrantes', { method: 'POST' })
    if (error) throw error
    if ((data?.acreditadas ?? 0) > 0) triggerRefresh()
  } catch (e) {
    console.error('Error al sincronizar transferencias entrantes:', e)
  }
}

export function useSyncTransferenciasEntrantes() {
  // string estable para el dependency array — cuentas cambia de referencia en cada fetch
  const cuentaIds = useCuentaStore((s) => s.cuentas.map((c) => c.id).join(','))

  useEffect(() => {
    if (!cuentaIds) return
    // Con la app en segundo plano no se consulta al Banco Central: se ahorra
    // red y batería, y al volver se sincroniza en el acto.
    const sincronizarSiVisible = () => { if (!document.hidden) void sincronizarTransferenciasEntrantes() }
    sincronizarSiVisible()
    const interval = setInterval(sincronizarSiVisible, 2 * 60 * 1000)
    document.addEventListener('visibilitychange', sincronizarSiVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', sincronizarSiVisible)
    }
  }, [cuentaIds])

  return { sync: sincronizarTransferenciasEntrantes }
}
