export interface GastosDelMes {
  total: number
  categorias: { categoria: string; total: number; porcentaje: number }[]
  totalMesAnterior: number
}

const SIN_DATOS = 'En Mis gastos ves en qué se fue tu dinero cada mes, ordenado por concepto. Este mes todavía no tenés gastos registrados.'

// Sobre la pregunta ya normalizada: minúsculas y sin tildes.
const PALABRAS_POR_CATEGORIA: [string, RegExp][] = [
  ['Vivienda', /alquiler|expensa|vivienda/],
  ['Compras y servicios', /compra|servicio|factura|suscripcion|impuesto|seguro|mercadomonix|tienda/],
  ['Educación y salud', /educacion|salud|arancel/],
  ['Transporte y viajes', /transporte|viaje/],
  ['Regalos y compartidos', /regalo|compartido|donacion/],
  ['Finanzas', /prestamo|cuota|deuda|finanza|ahorro|inversion/],
  ['Pagos con QR', /\bqr\b/],
  ['Pagos de trabajo', /sueldo|honorario|trabajo|viatico/],
  ['Varios', /\bvarios\b/],
]

export function respuestaGastos(q: string, g: GastosDelMes | null | undefined, fmt: (monto: number) => string): string {
  if (g === undefined) return 'Estoy trayendo tus gastos del mes. Probá de nuevo en unos segundos o abrí Mis gastos.'
  if (!g) return SIN_DATOS

  const hablaDelMesPasado = /mes pasado|mes anterior/.test(q)
  if (hablaDelMesPasado || /compar|mas que|menos que/.test(q)) {
    if (g.totalMesAnterior === 0) return `El mes pasado no registraste gastos. Este mes llevás ${fmt(g.total)}.`
    const diferencia = g.total - g.totalMesAnterior
    const cierre = diferencia === 0 ? 'Vas igual.' : `Vas ${fmt(Math.abs(diferencia))} ${diferencia > 0 ? 'arriba' : 'abajo'}.`
    return `El mes pasado gastaste ${fmt(g.totalMesAnterior)} y este mes llevás ${fmt(g.total)}. ${cierre}`
  }

  const pedida = PALABRAS_POR_CATEGORIA.find(([, palabras]) => palabras.test(q))?.[0]
  if (pedida) {
    const fila = g.categorias.find((c) => c.categoria === pedida)
    return fila
      ? `En ${pedida} llevás ${fmt(fila.total)} este mes: el ${fila.porcentaje}% de tus gastos.`
      : `Este mes no tenés gastos en ${pedida}.`
  }

  const mayor = g.categorias[0]
  if (!mayor) return SIN_DATOS
  return `Este mes gastaste ${fmt(g.total)}. Lo que más pesó fue ${mayor.categoria}: ${fmt(mayor.total)}.`
}
