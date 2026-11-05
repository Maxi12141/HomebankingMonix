import { CUENTA_PRUEBA_ARS_ID, CUENTA_PRUEBA_USD_ID, convertirMoneda, moverReserva, pedirPrestamo, simularMes, transferir, type EstadoPrueba, type ResumenMes } from '../utils/bancoSimulado'
import { useCuentaStore } from '../store/cuentaStore'
import { estadoPrueba, guardarEstadoPrueba } from './estadoPrueba'

function aplicar(nuevo: EstadoPrueba) {
  guardarEstadoPrueba(nuevo)
  const store = useCuentaStore.getState()
  store.updateSaldoCuenta(CUENTA_PRUEBA_ARS_ID, nuevo.saldoArs)
  store.updateSaldoCuenta(CUENTA_PRUEBA_USD_ID, nuevo.saldoUsd)
  store.triggerRefresh()
}

export function moverReservaPrueba(modo: 'ingresar' | 'retirar', monto: number) {
  aplicar(moverReserva(estadoPrueba(), modo, monto))
}

export function convertirMonedaPrueba(modo: 'comprar' | 'vender', montoUsd: number, montoArs: number, descripcion: string) {
  aplicar(convertirMoneda(estadoPrueba(), modo, montoUsd, montoArs, descripcion))
}

export function pedirPrestamoPrueba(datos: Parameters<typeof pedirPrestamo>[1]) {
  aplicar(pedirPrestamo(estadoPrueba(), datos))
}

export function transferirPrueba(datos: Parameters<typeof transferir>[1]) {
  aplicar(transferir(estadoPrueba(), datos))
}

export function simularMesPrueba(): ResumenMes {
  const { estado, resumen } = simularMes(estadoPrueba())
  aplicar(estado)
  return resumen
}
