import { useState, useEffect } from 'react'
import { getBankName } from '../services/bancoCentral'
import type { Movimiento } from '../types'

export function useBankNames(movimientos: Movimiento[]): Record<number, string> {
  const [bankNames, setBankNames] = useState<Record<number, string>>({})

  useEffect(() => {
    const codes = [
      ...new Set(
        movimientos
          .map((m) => m.banco_codigo_origen)
          .filter((c): c is number => c !== null),
      ),
    ]

    if (codes.length === 0) return

    // Only fetch codes we don't have yet
    const pending = codes.filter((c) => !(c in bankNames))
    if (pending.length === 0) return

    Promise.all(
      pending.map((code) =>
        getBankName(code)
          .then((name) => ({ code, name }))
          .catch(() => ({ code, name: `Banco #${code}` })),
      ),
    ).then((results) => {
      setBankNames((prev) => {
        const next = { ...prev }
        for (const { code, name } of results) next[code] = name
        return next
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movimientos])

  return bankNames
}
