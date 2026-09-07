import { useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useCuentaStore } from '../store/cuentaStore'
import { listarTransacciones } from '../services/bancoCentral'

export function useSyncTransferenciasEntrantes() {
  const { cuentas, updateSaldoCuenta, triggerRefresh } = useCuentaStore()
  const syncingRef = useRef(false)

  // string estable para el dependency array — cuentas cambia de referencia en cada fetch
  const cuentaIds = cuentas.map((c) => c.id).join(',')

  const sync = useCallback(async () => {
    if (cuentas.length === 0 || syncingRef.current) return
    syncingRef.current = true

    try {
      const transacciones = await listarTransacciones(1440)
      // Cada CBU es de una cuenta puntual (ARS o USD) — se matchea por CBU y se
      // acredita esa cuenta específica, así que una misma pasada cubre ambas monedas.
      const porCbu = new Map(cuentas.map((c) => [c.cbu, c]))
      const entrantes = transacciones.filter(
        t => t.estado === 'aprobada' && porCbu.has(t.cbuDestino),
      )

      let procesadas = 0

      for (const t of entrantes) {
        const cuentaDestino = porCbu.get(t.cbuDestino)
        if (!cuentaDestino) continue

        const { data: existente } = await supabase
          .from('movimientos')
          .select('id')
          .eq('bc_transaccion_id', t._id)
          .maybeSingle()
        if (existente) continue

        // Saltar transferencias Monix→Monix (ya registradas por TransferPage)
        const { data: cuentaInterna } = await supabase
          .from('cuentas')
          .select('id')
          .eq('cbu', t.cbuOrigen)
          .maybeSingle()
        if (cuentaInterna) continue

        const { data: cuentaActual } = await supabase
          .from('cuentas')
          .select('saldo')
          .eq('id', cuentaDestino.id)
          .single()
        if (!cuentaActual) continue

        const nuevoSaldo = cuentaActual.saldo + t.importe

        const { error: errSaldo } = await supabase
          .from('cuentas')
          .update({ saldo: nuevoSaldo })
          .eq('id', cuentaDestino.id)
        if (errSaldo) continue

        const { error: errMov } = await supabase.from('movimientos').insert({
          cuenta_id: cuentaDestino.id,
          tipo: 'transferencia_entrada',
          monto: t.importe,
          saldo_resultante: nuevoSaldo,
          bc_transaccion_id: t._id,
          banco_codigo_origen: t.bankCodeOrigen,
          destinatario_nombre: t.personaOrigen.nombre,
          destinatario_apellido: t.personaOrigen.apellido,
          destinatario_dni: t.personaOrigen.dni ?? null,
          destino_cbu: t.personaOrigen.cbu,
          destino_alias: t.personaOrigen.alias ?? null,
        })

        if (!errMov) {
          updateSaldoCuenta(cuentaDestino.id, nuevoSaldo)
          procesadas++
        }
      }

      if (procesadas > 0) triggerRefresh()
    } catch (e) {
      console.error('Error al sincronizar transferencias entrantes:', e)
    } finally {
      syncingRef.current = false
    }
  }, [cuentaIds])

  useEffect(() => {
    sync()
    const interval = setInterval(sync, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [sync])

  return { sync }
}
