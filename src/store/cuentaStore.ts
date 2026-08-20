import { create } from 'zustand'
import type { Cuenta } from '../types'

interface CuentaState {
  cuenta: Cuenta | null
  cuentas: Cuenta[]
  refreshTick: number
  setCuenta: (cuenta: Cuenta | null) => void
  setCuentas: (cuentas: Cuenta[]) => void
  updateSaldo: (saldo: number) => void
  updateSaldoCuenta: (cuentaId: string, saldo: number) => void
  triggerRefresh: () => void
  clear: () => void
}

export const useCuentaStore = create<CuentaState>((set) => ({
  cuenta: null,
  cuentas: [],
  refreshTick: 0,
  setCuenta: (cuenta) => set({ cuenta }),
  setCuentas: (cuentas) => set({ cuentas }),
  updateSaldo: (saldo) =>
    set((state) => state.cuenta ? { cuenta: { ...state.cuenta, saldo } } : {}),
  updateSaldoCuenta: (cuentaId, saldo) =>
    set((state) => ({
      cuentas: state.cuentas.map((c) => (c.id === cuentaId ? { ...c, saldo } : c)),
      cuenta: state.cuenta?.id === cuentaId ? { ...state.cuenta, saldo } : state.cuenta,
    })),
  triggerRefresh: () => set((state) => ({ refreshTick: state.refreshTick + 1 })),
  clear: () => set({ cuenta: null, cuentas: [], refreshTick: 0 }),
}))
