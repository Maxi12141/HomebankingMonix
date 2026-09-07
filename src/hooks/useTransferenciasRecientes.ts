import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export interface TransferenciaReciente {
  nombre: string
  apellido: string
  cbu: string
  alias: string | null
  fecha: string
}

/** Transferencias recientes hechas DESDE la cuenta indicada — cada cuenta (ARS/USD) tiene las suyas. */
export function useTransferenciasRecientes(cuentaId: string | undefined, limit = 6): TransferenciaReciente[] {
  const [recientes, setRecientes] = useState<TransferenciaReciente[]>([])

  useEffect(() => {
    if (!cuentaId) {
      setRecientes([])
      return
    }

    supabase
      .from('movimientos')
      .select('destinatario_nombre, destinatario_apellido, destino_cbu, destino_alias, created_at')
      .eq('cuenta_id', cuentaId)
      .eq('tipo', 'transferencia_salida')
      .not('destino_cbu', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!data) return
        const seen = new Set<string>()
        const unique: TransferenciaReciente[] = []
        for (const row of data) {
          if (!row.destino_cbu || seen.has(row.destino_cbu)) continue
          seen.add(row.destino_cbu)
          unique.push({
            nombre: row.destinatario_nombre ?? '',
            apellido: row.destinatario_apellido ?? '',
            cbu: row.destino_cbu,
            alias: row.destino_alias,
            fecha: row.created_at,
          })
          if (unique.length >= limit) break
        }
        setRecientes(unique)
      })
  }, [cuentaId, limit])

  return recientes
}
