import { useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useCuentaStore } from '../store/cuentaStore'
import { listarTransacciones } from '../services/bancoCentral'

// Candado de módulo, no por instancia: la sync corre desde PageWrapper y
// también desde la pantalla del QR mientras espera un pago. Dos pasadas en
// paralelo podían acreditar dos veces la misma transferencia (el chequeo de
// bc_transaccion_id y el insert no son atómicos).
let enCurso: Promise<void> | null = null

/**
 * Trae del Banco Central las transferencias entrantes de las últimas 24 h y
 * acredita las que todavía no están en movimientos. Si ya hay una pasada
 * corriendo, espera esa en vez de arrancar otra.
 */
export function sincronizarTransferenciasEntrantes(): Promise<void> {
  if (!enCurso) {
    enCurso = sincronizar().finally(() => { enCurso = null })
  }
  return enCurso
}

async function sincronizar() {
  const { cuentas, updateSaldoCuenta, triggerRefresh } = useCuentaStore.getState()
  if (cuentas.length === 0) return

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

        // Saltar transferencias Monix→Monix (ya registradas por TransferPage) — un select
        // directo a cuentas ajenas lo bloquea RLS en silencio, por eso usa un RPC dedicado.
        const { data: esInterna } = await supabase.rpc('es_cuenta_interna', { p_cbu: t.cbuOrigen })
        if (esInterna) continue

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
    }
}

export function useSyncTransferenciasEntrantes() {
  // string estable para el dependency array — cuentas cambia de referencia en cada fetch
  const cuentaIds = useCuentaStore((s) => s.cuentas.map((c) => c.id).join(','))

  useEffect(() => {
    if (!cuentaIds) return
    void sincronizarTransferenciasEntrantes()
    const interval = setInterval(() => { void sincronizarTransferenciasEntrantes() }, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [cuentaIds])

  return { sync: sincronizarTransferenciasEntrantes }
}
