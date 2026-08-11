import { create } from 'zustand'
import type { Cuenta } from '../types'

interface CuentaState {
  cuenta: Cuenta | null
  refreshTick: number
  setCuenta: (cuenta: Cuenta | null) => void
  updateSaldo: (saldo: number) => void
  triggerRefresh: () => void
  clear: () => void
}

export const useCuentaStore = create<CuentaState>((set) => ({
  cuenta: null,
  refreshTick: 0,
  setCuenta: (cuenta) => set({ cuenta }),
  updateSaldo: (saldo) =>
    set((state) => state.cuenta ? { cuenta: { ...state.cuenta, saldo } } : {}),
  triggerRefresh: () => set((state) => ({ refreshTick: state.refreshTick + 1 })),
  clear: () => set({ cuenta: null, refreshTick: 0 }),
}))
