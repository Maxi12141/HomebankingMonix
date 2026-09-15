import { create } from 'zustand'
import type { Cuenta } from '../types'

interface CuentaState {
  cuenta: Cuenta | null
  cuentas: Cuenta[]
  // Distingue "todavía no llegó la primera respuesta de fetchCuentas" de
  // "llegó (con éxito, vacía o con error)" — sin esto, un fetch que falla
  // deja cuentas en [] para siempre y no hay forma de saber si es un estado
  // transitorio o definitivo (ver useMovimientos.ts).
  cuentasLoaded: boolean
  refreshTick: number
  setCuenta: (cuenta: Cuenta | null) => void
  setCuentas: (cuentas: Cuenta[]) => void
  setCuentasLoaded: (loaded: boolean) => void
  updateSaldo: (saldo: number) => void
  updateSaldoCuenta: (cuentaId: string, saldo: number) => void
  triggerRefresh: () => void
  clear: () => void
}

export const useCuentaStore = create<CuentaState>((set) => ({
  cuenta: null,
  cuentas: [],
  cuentasLoaded: false,
  refreshTick: 0,
  setCuenta: (cuenta) => set({ cuenta }),
  setCuentas: (cuentas) => set({ cuentas }),
  setCuentasLoaded: (cuentasLoaded) => set({ cuentasLoaded }),
  updateSaldo: (saldo) =>
    set((state) => state.cuenta ? { cuenta: { ...state.cuenta, saldo } } : {}),
  updateSaldoCuenta: (cuentaId, saldo) =>
    set((state) => ({
      cuentas: state.cuentas.map((c) => (c.id === cuentaId ? { ...c, saldo } : c)),
      cuenta: state.cuenta?.id === cuentaId ? { ...state.cuenta, saldo } : state.cuenta,
    })),
  triggerRefresh: () => set((state) => ({ refreshTick: state.refreshTick + 1 })),
  clear: () => set({ cuenta: null, cuentas: [], cuentasLoaded: false, refreshTick: 0 }),
}))
