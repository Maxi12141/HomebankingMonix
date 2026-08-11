import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useCuentaStore } from '../store/cuentaStore'

export interface TransferenciaReciente {
  nombre: string
  apellido: string
  cbu: string
  alias: string | null
  fecha: string
}

export function useTransferenciasRecientes(limit = 6): TransferenciaReciente[] {
  const { cuenta } = useCuentaStore()
  const [recientes, setRecientes] = useState<TransferenciaReciente[]>([])

  useEffect(() => {
    if (!cuenta?.id) return

    supabase
      .from('movimientos')
      .select('destinatario_nombre, destinatario_apellido, destino_cbu, destino_alias, created_at')
      .eq('cuenta_id', cuenta.id)
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
  }, [cuenta?.id, limit])

  return recientes
}
