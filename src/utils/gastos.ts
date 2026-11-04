import type { Movimiento } from '../types'

export const MOTIVOS_GRUPOS: { grupo: string; items: string[] }[] = [
  { grupo: 'General', items: ['Varios', 'Gastos compartidos', 'Regalo', 'Donación'] },
  {
    grupo: 'Vivienda',
    items: ['Alquiler', 'Expensas', 'Cuota', 'Depósito en garantía', 'Mantenimiento'],
  },
  {
    grupo: 'Trabajo e ingresos',
    items: ['Sueldo', 'Haberes', 'Jornal', 'Honorarios', 'Viáticos', 'Aguinaldo'],
  },
  {
    grupo: 'Comercio y servicios',
    items: [
      'Factura',
      'Servicio',
      'Mercadería',
      'Compra',
      'Venta',
      'Seguro',
      'Suscripción',
      'Impuestos',
    ],
  },
  {
    grupo: 'Educación y salud',
    items: ['Aranceles', 'Educación', 'Salud'],
  },
  {
    grupo: 'Finanzas',
    items: ['Préstamo', 'Deuda', 'Reintegro', 'Ahorro', 'Inversión'],
  },
  {
    grupo: 'Otros',
    items: ['Transporte', 'Viajes', 'Comisiones'],
  },
]

export const CATEGORIA_VARIOS = 'Varios'

const CATEGORIA_POR_GRUPO: Record<string, string> = {
  Vivienda: 'Vivienda',
  'Trabajo e ingresos': 'Pagos de trabajo',
  'Comercio y servicios': 'Compras y servicios',
  'Educación y salud': 'Educación y salud',
  Finanzas: 'Finanzas',
}

const CATEGORIA_POR_MOTIVO: Record<string, string> = {
  Varios: CATEGORIA_VARIOS,
  'Gastos compartidos': 'Regalos y compartidos',
  Regalo: 'Regalos y compartidos',
  Donación: 'Regalos y compartidos',
  Transporte: 'Transporte y viajes',
  Viajes: 'Transporte y viajes',
  Comisiones: 'Compras y servicios',
  mercadoMONIX: 'Compras y servicios',
  'Pago QR': 'Pagos con QR',
}

for (const { grupo, items } of MOTIVOS_GRUPOS) {
  for (const motivo of items) {
    CATEGORIA_POR_MOTIVO[motivo] ??= CATEGORIA_POR_GRUPO[grupo]
  }
}

// Mover dinero entre lo propio no es gastarlo: reservas, metas y compra de dólares siguen siendo tuyos.
const NO_SON_GASTO = new Set(['Reserva', 'Meta común', 'Compra de USD', 'Venta de USD'])

/** Categoría de un movimiento, o null si no es un gasto en pesos. */
export function categoriaDeGasto(mov: Movimiento, cuentasPropias: ReadonlySet<string>): string | null {
  if (mov.moneda !== 'ARS') return null
  if (mov.tipo !== 'extraccion' && mov.tipo !== 'transferencia_salida') return null
  if (mov.cuenta_destino_id && cuentasPropias.has(mov.cuenta_destino_id)) return null

  const descripcion = mov.descripcion ?? ''
  const motivo = descripcion.split('|')[0].trim()
  if (NO_SON_GASTO.has(motivo)) return null
  if (motivo.startsWith('Cuota préstamo')) return 'Finanzas'
  return CATEGORIA_POR_MOTIVO[motivo] ?? CATEGORIA_VARIOS
}

export interface CategoriaGasto {
  categoria: string
  total: number
  porcentaje: number
  movimientos: Movimiento[]
}

export interface ResumenGastos {
  total: number
  categorias: CategoriaGasto[]
}

function redondear(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Gastos de un mes (0 = enero) por categoría, de mayor a menor. */
export function resumenGastos(
  movimientos: Movimiento[],
  cuentasPropias: ReadonlySet<string>,
  anio: number,
  mes: number,
): ResumenGastos {
  const porCategoria = new Map<string, Movimiento[]>()
  for (const mov of movimientos) {
    const fecha = new Date(mov.created_at)
    if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes) continue
    const categoria = categoriaDeGasto(mov, cuentasPropias)
    if (!categoria) continue
    porCategoria.set(categoria, [...(porCategoria.get(categoria) ?? []), mov])
  }

  const filas = [...porCategoria].map(([categoria, movs]) => ({
    categoria,
    movimientos: movs,
    total: redondear(movs.reduce((suma, m) => suma + m.monto, 0)),
  }))
  const total = redondear(filas.reduce((suma, f) => suma + f.total, 0))

  return {
    total,
    categorias: filas
      .map((f) => ({ ...f, porcentaje: total > 0 ? Math.round((f.total / total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total),
  }
}
