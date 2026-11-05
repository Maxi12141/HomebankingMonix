import type { Movimiento, Reserva } from '../types'
import {
  CUENTA_PRUEBA_ARS_ID,
  CUENTA_PRUEBA_USD_ID,
  SALDO_INICIAL_ARS,
  SALDO_INICIAL_USD,
  TASA_PRUEBA_ARS,
  type EstadoPrueba,
} from '../utils/bancoSimulado'
import { ESTADO_PRUEBA_KEY, hace, leerEstadoPrueba } from './modoPrueba'

function movimientosPrueba(): Movimiento[] {
  const lista: Movimiento[] = [
    {
      id: 'demo-mov-1',
      cuenta_id: CUENTA_PRUEBA_ARS_ID,
      tipo: 'transferencia_salida',
      moneda: 'ARS',
      monto: 6_200,
      saldo_resultante: 162_300,
      descripcion: 'Supermercado del barrio',
      cuenta_destino_id: null,
      destinatario_nombre: 'Super',
      destinatario_apellido: 'Norte',
      destinatario_dni: null,
      destino_cbu: '0000003100011111111111',
      destino_alias: 'super.norte.mp',
      bc_transaccion_id: null,
      banco_codigo_origen: null,
      created_at: hace(0, 18),
    },
    {
      id: 'demo-mov-2',
      cuenta_id: CUENTA_PRUEBA_ARS_ID,
      tipo: 'transferencia_entrada',
      moneda: 'ARS',
      monto: 18_500,
      saldo_resultante: 168_500,
      descripcion: 'De María Gómez',
      cuenta_destino_id: null,
      destinatario_nombre: 'María',
      destinatario_apellido: 'Gómez',
      destinatario_dni: null,
      destino_cbu: null,
      destino_alias: null,
      bc_transaccion_id: null,
      banco_codigo_origen: null,
      created_at: hace(1, 15),
    },
    {
      id: 'demo-mov-3',
      cuenta_id: CUENTA_PRUEBA_ARS_ID,
      tipo: 'deposito',
      moneda: 'ARS',
      monto: 150_000,
      saldo_resultante: 150_000,
      descripcion: 'Bono de bienvenida',
      cuenta_destino_id: null,
      destinatario_nombre: null,
      destinatario_apellido: null,
      destinatario_dni: null,
      destino_cbu: null,
      destino_alias: null,
      bc_transaccion_id: null,
      banco_codigo_origen: null,
      created_at: hace(0, 9),
    },
    {
      id: 'demo-mov-4',
      cuenta_id: CUENTA_PRUEBA_USD_ID,
      tipo: 'deposito',
      moneda: 'USD',
      monto: 120.5,
      saldo_resultante: 120.5,
      descripcion: 'Saldo de muestra',
      cuenta_destino_id: null,
      destinatario_nombre: null,
      destinatario_apellido: null,
      destinatario_dni: null,
      destino_cbu: null,
      destino_alias: null,
      bc_transaccion_id: null,
      banco_codigo_origen: null,
      created_at: hace(2, 11),
    },
  ]
  return lista.sort((a, b) => b.created_at.localeCompare(a.created_at))
}

/** Un mes y el anterior con motivos variados, para que el historial y las estadísticas tengan qué mostrar. */
function gastosPrueba(): Movimiento[] {
  const hoy = new Date()
  const fila = (mesesAtras: number, dia: number, motivo: string, nombre: string, monto: number): Movimiento => ({
    id: `demo-gasto-${mesesAtras}-${motivo}`,
    cuenta_id: CUENTA_PRUEBA_ARS_ID,
    tipo: 'transferencia_salida',
    moneda: 'ARS',
    monto,
    saldo_resultante: null,
    descripcion: motivo,
    cuenta_destino_id: null,
    destinatario_nombre: nombre,
    destinatario_apellido: null,
    destinatario_dni: null,
    destino_cbu: null,
    destino_alias: null,
    bc_transaccion_id: null,
    banco_codigo_origen: null,
    created_at: new Date(
      hoy.getFullYear(),
      hoy.getMonth() - mesesAtras,
      mesesAtras === 0 ? Math.min(dia, hoy.getDate()) : dia,
      12,
    ).toISOString(),
  })
  return [
    fila(0, 1, 'Alquiler', 'Inmobiliaria Centro', 95_000),
    fila(0, 2, 'Compra', 'Almacén Don Pepe', 62_400),
    fila(0, 3, 'Salud', 'Farmacia Norte', 22_000),
    fila(0, 4, 'Transporte', 'Carga SUBE', 18_200),
    fila(0, 5, 'Regalo', 'Sofía', 15_000),
    fila(0, 6, 'Suscripción', 'Música', 9_800),
    fila(1, 1, 'Alquiler', 'Inmobiliaria Centro', 95_000),
    fila(1, 8, 'Compra', 'Almacén Don Pepe', 71_000),
    fila(1, 12, 'Servicio', 'Internet', 24_500),
    fila(1, 15, 'Transporte', 'Carga SUBE', 21_000),
    fila(1, 20, 'Suscripción', 'Música', 9_800),
    fila(1, 24, 'Salud', 'Farmacia Norte', 8_000),
  ]
}

function estadoInicial(): EstadoPrueba {
  return {
    saldoArs: SALDO_INICIAL_ARS,
    saldoUsd: SALDO_INICIAL_USD,
    saldoReserva: 25_000,
    movimientos: [...movimientosPrueba(), ...gastosPrueba()].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    prestamos: [],
  }
}

export function guardarEstadoPrueba(estado: EstadoPrueba) {
  sessionStorage.setItem(ESTADO_PRUEBA_KEY, JSON.stringify(estado))
}

export function estadoPrueba(): EstadoPrueba {
  const guardado = leerEstadoPrueba()
  if (guardado) return guardado
  const inicial = estadoInicial()
  guardarEstadoPrueba(inicial)
  return inicial
}

export function reservaPrueba(): Reserva {
  return {
    id: '00000000-0000-4000-8000-0000000000b1',
    cuenta_id: CUENTA_PRUEBA_ARS_ID,
    saldo: estadoPrueba().saldoReserva,
    tasa_anual: TASA_PRUEBA_ARS,
    ultima_interes_at: hace(0, 8),
    created_at: hace(3, 8),
  }
}
