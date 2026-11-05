import type { Movimiento, Prestamo } from '../types'

// El banco de prueba: lo que hace el servidor con una cuenta real, pero sobre un
// estado que vive en el navegador. Nunca toca la base. Las descripciones son las
// mismas del servidor para que Inicio, Historial y Mis gastos las traten igual.

export const CUENTA_PRUEBA_ARS_ID = '00000000-0000-4000-8000-0000000000a1'
export const CUENTA_PRUEBA_USD_ID = '00000000-0000-4000-8000-0000000000a2'
export const TASA_PRUEBA_ARS = 32
export const TASA_PRUEBA_USD = 2
export const SALDO_INICIAL_ARS = 162_300
export const SALDO_INICIAL_USD = 120.5

export interface EstadoPrueba {
  saldoArs: number
  saldoUsd: number
  saldoReserva: number
  movimientos: Movimiento[]
  prestamos: Prestamo[]
}

export interface DestinoEjemplo {
  nombre: string
  apellido: string
  dni: string
  cbu: string
  alias: string
}

export const DESTINOS_EJEMPLO: DestinoEjemplo[] = [
  { nombre: 'María', apellido: 'Gómez', dni: '35111222', cbu: '0000003100011111111112', alias: 'maria.gomez.monix' },
  { nombre: 'Juan', apellido: 'Pérez', dni: '30333444', cbu: '0000003100022222222223', alias: 'juan.perez.monix' },
]

export function destinoEjemplo(texto: string): DestinoEjemplo | null {
  const buscado = texto.trim().toLowerCase()
  return DESTINOS_EJEMPLO.find((d) => d.alias === buscado || d.cbu === buscado) ?? null
}

const redondear = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

function validar(monto: number) {
  if (!Number.isFinite(monto) || monto <= 0) throw new Error('Monto inválido')
}

function exigirSaldo(disponible: number, monto: number) {
  if (monto > disponible) throw new Error('Saldo insuficiente')
}

function movimiento(
  datos: Pick<Movimiento, 'cuenta_id' | 'tipo' | 'moneda' | 'monto' | 'saldo_resultante' | 'descripcion'> & Partial<Movimiento>,
): Movimiento {
  return {
    id: crypto.randomUUID(),
    cuenta_destino_id: null,
    destinatario_nombre: null,
    destinatario_apellido: null,
    destinatario_dni: null,
    destino_cbu: null,
    destino_alias: null,
    bc_transaccion_id: null,
    banco_codigo_origen: null,
    created_at: new Date().toISOString(),
    ...datos,
  }
}

export function moverReserva(estado: EstadoPrueba, modo: 'ingresar' | 'retirar', monto: number): EstadoPrueba {
  validar(monto)
  exigirSaldo(modo === 'ingresar' ? estado.saldoArs : estado.saldoReserva, monto)
  const signo = modo === 'ingresar' ? 1 : -1
  const saldoArs = redondear(estado.saldoArs - signo * monto)
  return {
    ...estado,
    saldoArs,
    saldoReserva: redondear(estado.saldoReserva + signo * monto),
    movimientos: [
      movimiento({
        cuenta_id: CUENTA_PRUEBA_ARS_ID,
        tipo: modo === 'ingresar' ? 'extraccion' : 'deposito',
        moneda: 'ARS',
        monto,
        saldo_resultante: saldoArs,
        descripcion: modo === 'ingresar' ? 'Reserva|Ingreso a ahorro MONIX' : 'Reserva|Retiro de ahorro MONIX',
      }),
      ...estado.movimientos,
    ],
  }
}

export function convertirMoneda(
  estado: EstadoPrueba,
  modo: 'comprar' | 'vender',
  montoUsd: number,
  montoArs: number,
  descripcion: string,
): EstadoPrueba {
  validar(montoUsd)
  validar(montoArs)
  if (modo === 'comprar') exigirSaldo(estado.saldoArs, montoArs)
  else exigirSaldo(estado.saldoUsd, montoUsd)

  const saldoArs = redondear(estado.saldoArs + (modo === 'comprar' ? -montoArs : montoArs))
  const saldoUsd = redondear(estado.saldoUsd + (modo === 'comprar' ? montoUsd : -montoUsd))
  return {
    ...estado,
    saldoArs,
    saldoUsd,
    movimientos: [
      movimiento({
        cuenta_id: CUENTA_PRUEBA_ARS_ID,
        tipo: modo === 'comprar' ? 'extraccion' : 'deposito',
        moneda: 'ARS',
        monto: montoArs,
        saldo_resultante: saldoArs,
        descripcion,
      }),
      movimiento({
        cuenta_id: CUENTA_PRUEBA_USD_ID,
        tipo: modo === 'comprar' ? 'deposito' : 'extraccion',
        moneda: 'USD',
        monto: montoUsd,
        saldo_resultante: saldoUsd,
        descripcion,
      }),
      ...estado.movimientos,
    ],
  }
}

export function pedirPrestamo(
  estado: EstadoPrueba,
  datos: { monto: number; cuotas: number; cuota: number; tna: number; sueldoAcreditado: boolean },
): EstadoPrueba {
  validar(datos.monto)
  const ahora = new Date()
  const proxima = new Date(ahora)
  proxima.setMonth(proxima.getMonth() + 1)
  const saldoArs = redondear(estado.saldoArs + datos.monto)
  return {
    ...estado,
    saldoArs,
    prestamos: [
      {
        id: crypto.randomUUID(),
        cuenta_id: CUENTA_PRUEBA_ARS_ID,
        monto: datos.monto,
        cuotas_totales: datos.cuotas,
        cuotas_pagadas: 0,
        cuota_monto: datos.cuota,
        tna: datos.tna,
        situacion_bcra: 1,
        sueldo_acreditado: datos.sueldoAcreditado,
        estado: 'activo',
        proxima_cuota_at: proxima.toISOString(),
        created_at: ahora.toISOString(),
      },
      ...estado.prestamos,
    ],
    movimientos: [
      movimiento({
        cuenta_id: CUENTA_PRUEBA_ARS_ID,
        tipo: 'deposito',
        moneda: 'ARS',
        monto: datos.monto,
        saldo_resultante: saldoArs,
        descripcion: 'Préstamo otorgado',
      }),
      ...estado.movimientos,
    ],
  }
}

export function transferir(
  estado: EstadoPrueba,
  datos: {
    moneda: 'ARS' | 'USD'
    monto: number
    descripcion: string
    nombre: string
    apellido: string
    dni: string | null
    cbu: string
    alias: string | null
  },
): EstadoPrueba {
  validar(datos.monto)
  const enPesos = datos.moneda === 'ARS'
  exigirSaldo(enPesos ? estado.saldoArs : estado.saldoUsd, datos.monto)
  const saldo = redondear((enPesos ? estado.saldoArs : estado.saldoUsd) - datos.monto)
  return {
    ...estado,
    saldoArs: enPesos ? saldo : estado.saldoArs,
    saldoUsd: enPesos ? estado.saldoUsd : saldo,
    movimientos: [
      movimiento({
        cuenta_id: enPesos ? CUENTA_PRUEBA_ARS_ID : CUENTA_PRUEBA_USD_ID,
        tipo: 'transferencia_salida',
        moneda: datos.moneda,
        monto: datos.monto,
        saldo_resultante: saldo,
        descripcion: datos.descripcion,
        destinatario_nombre: datos.nombre,
        destinatario_apellido: datos.apellido,
        destinatario_dni: datos.dni,
        destino_cbu: datos.cbu,
        destino_alias: datos.alias,
      }),
      ...estado.movimientos,
    ],
  }
}

const interesDelMes = (saldo: number, tasaAnual: number) =>
  redondear(saldo * (Math.pow(1 + tasaAnual / 100 / 365, 30) - 1))

export interface ResumenMes {
  intereses: number
  cuotasPagadas: number
  cuotasAtrasadas: number
}

/** Lo que en una cuenta real tarda un mes: acredita intereses y cobra una cuota de cada préstamo. */
export function simularMes(estado: EstadoPrueba): { estado: EstadoPrueba; resumen: ResumenMes } {
  const nuevos: Movimiento[] = []
  const interesArs = interesDelMes(estado.saldoArs, TASA_PRUEBA_ARS)
  const interesUsd = interesDelMes(estado.saldoUsd, TASA_PRUEBA_USD)
  const interesReserva = interesDelMes(estado.saldoReserva, TASA_PRUEBA_ARS)

  let saldoArs = redondear(estado.saldoArs + interesArs)
  const saldoUsd = redondear(estado.saldoUsd + interesUsd)
  const saldoReserva = redondear(estado.saldoReserva + interesReserva)

  if (interesArs > 0) {
    nuevos.push(movimiento({
      cuenta_id: CUENTA_PRUEBA_ARS_ID, tipo: 'deposito', moneda: 'ARS', monto: interesArs, saldo_resultante: saldoArs, descripcion: 'Rendimiento de Reserva',
    }))
  }
  if (interesReserva > 0) {
    nuevos.push(movimiento({
      cuenta_id: CUENTA_PRUEBA_ARS_ID, tipo: 'deposito', moneda: 'ARS', monto: interesReserva, saldo_resultante: saldoReserva, descripcion: 'Rendimiento de Reserva',
    }))
  }
  if (interesUsd > 0) {
    nuevos.push(movimiento({
      cuenta_id: CUENTA_PRUEBA_USD_ID, tipo: 'deposito', moneda: 'USD', monto: interesUsd, saldo_resultante: saldoUsd, descripcion: 'Rendimiento de Reserva',
    }))
  }

  let cuotasPagadas = 0
  let cuotasAtrasadas = 0
  const prestamos = estado.prestamos.map((p) => {
    if (p.estado !== 'activo') return p
    if (p.cuota_monto > saldoArs) {
      cuotasAtrasadas++
      return p
    }
    saldoArs = redondear(saldoArs - p.cuota_monto)
    const pagadas = p.cuotas_pagadas + 1
    cuotasPagadas++
    nuevos.push(movimiento({
      cuenta_id: CUENTA_PRUEBA_ARS_ID,
      tipo: 'extraccion',
      moneda: 'ARS',
      monto: p.cuota_monto,
      saldo_resultante: saldoArs,
      descripcion: `Cuota préstamo ${pagadas}/${p.cuotas_totales}`,
    }))
    const proxima = new Date(p.proxima_cuota_at)
    proxima.setMonth(proxima.getMonth() + 1)
    return {
      ...p,
      cuotas_pagadas: pagadas,
      proxima_cuota_at: proxima.toISOString(),
      estado: pagadas >= p.cuotas_totales ? ('pagado' as const) : ('activo' as const),
    }
  })

  return {
    estado: { ...estado, saldoArs, saldoUsd, saldoReserva, prestamos, movimientos: [...nuevos.reverse(), ...estado.movimientos] },
    resumen: { intereses: redondear(interesArs + interesReserva), cuotasPagadas, cuotasAtrasadas },
  }
}
