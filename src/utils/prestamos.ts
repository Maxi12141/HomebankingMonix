// Reglas de negocio de Préstamos, inspiradas en cómo operan bancos argentinos
// reales (Banco Nación, BBVA, Macro, sep 2026): tasa base ajustada por la
// situación en la Central de Deudores del BCRA, bonificación de tasa y de
// monto máximo para quien cobra el sueldo en la entidad, y tope de cuota
// sobre el ingreso declarado (25-35% según banco, el mismo rango que usan
// Banco Nación y el resto del mercado).

export type ColorNivel = 'mint' | 'amber' | 'red'

export interface NivelCrediticio {
  situacion: number
  label: string
  color: ColorNivel
  ajusteTasa: number
  montoMax: number
  cuotasMax: number
  disponible: boolean
  descripcion: string
}

export const TNA_BASE = 85
export const BONUS_SUELDO_PUNTOS = 12
export const MAX_MONTO_MULT_SUELDO = 1.5
export const RATIO_CUOTA_INGRESO = 0.3
export const RATIO_CUOTA_INGRESO_SUELDO = 0.35

export const NIVELES: Record<number, NivelCrediticio> = {
  1: {
    situacion: 1, label: 'Normal', color: 'mint', ajusteTasa: 0,
    montoMax: 8_000_000, cuotasMax: 24, disponible: true,
    descripcion: 'Cumplís tus compromisos en tiempo y forma. Accedés a la mejor tasa y al plazo más largo.',
  },
  2: {
    situacion: 2, label: 'Riesgo bajo', color: 'mint', ajusteTasa: 8,
    montoMax: 4_000_000, cuotasMax: 18, disponible: true,
    descripcion: 'Estás en seguimiento especial, sin atrasos graves. Tasa levemente más alta.',
  },
  3: {
    situacion: 3, label: 'Riesgo medio', color: 'amber', ajusteTasa: 18,
    montoMax: 1_200_000, cuotasMax: 12, disponible: true,
    descripcion: 'Tenés deudas atrasadas entre 90 y 180 días informadas en el sistema financiero.',
  },
  4: {
    situacion: 4, label: 'Riesgo alto', color: 'red', ajusteTasa: 30,
    montoMax: 300_000, cuotasMax: 6, disponible: true,
    descripcion: 'Atrasos de 180 a 365 días. Acceso muy limitado, solo montos bajos a corto plazo.',
  },
  5: {
    situacion: 5, label: 'Irrecuperable', color: 'red', ajusteTasa: 0,
    montoMax: 0, cuotasMax: 0, disponible: false,
    descripcion: 'Deudas de más de 365 días sin regularizar. Por ahora no podés acceder a un préstamo.',
  },
}

export function nivelPorSituacion(situacion: number): NivelCrediticio {
  return NIVELES[situacion] ?? NIVELES[1]
}

export interface OfertaPrestamo {
  nivel: NivelCrediticio
  tna: number
  montoMax: number
  cuotasMax: number
  ratioIngreso: number
}

/** Oferta disponible para la persona: tasa, monto y plazo máximo ya con los ajustes aplicados. */
export function calcularOferta(situacion: number, sueldoAcreditado: boolean): OfertaPrestamo {
  const nivel = nivelPorSituacion(situacion)
  const tna = Math.max(TNA_BASE + nivel.ajusteTasa - (sueldoAcreditado ? BONUS_SUELDO_PUNTOS : 0), 0)
  const montoMax = Math.round(nivel.montoMax * (sueldoAcreditado ? MAX_MONTO_MULT_SUELDO : 1))
  const ratioIngreso = sueldoAcreditado ? RATIO_CUOTA_INGRESO_SUELDO : RATIO_CUOTA_INGRESO
  return { nivel, tna, montoMax, cuotasMax: nivel.cuotasMax, ratioIngreso }
}

function roundMoney(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Cuota fija por sistema francés (el estándar de mercado en préstamos personales). */
export function calcularCuota(monto: number, tna: number, cuotas: number): number {
  if (monto <= 0 || cuotas <= 0) return 0
  const i = tna / 100 / 12
  if (i === 0) return roundMoney(monto / cuotas)
  const factor = Math.pow(1 + i, cuotas)
  return roundMoney((monto * i * factor) / (factor - 1))
}

// Tabla de amortización (sistema francés): en cada cuota, la parte de interés
// se calcula sobre el saldo de capital pendiente al inicio del período y la
// parte de amortización es el resto de la cuota fija — a medida que avanzan
// los períodos, baja el interés y sube la amortización de capital hasta
// cancelar la deuda. Términos estándar del sistema (economipedia.com,
// acierto.com, sep 2026): "cuota de interés", "cuota de amortización" y
// "saldo pendiente" (o "capital pendiente").
export interface FilaAmortizacion {
  numero: number
  cuota: number
  interes: number
  amortizacion: number
  saldoPendiente: number
}

export function calcularTablaAmortizacion(monto: number, tna: number, cuotas: number): FilaAmortizacion[] {
  if (monto <= 0 || cuotas <= 0) return []
  const cuotaFija = calcularCuota(monto, tna, cuotas)
  const i = tna / 100 / 12
  let saldo = monto
  const filas: FilaAmortizacion[] = []

  for (let n = 1; n <= cuotas; n++) {
    const interes = roundMoney(saldo * i)
    // La última cuota ajusta el redondeo acumulado para que el saldo cierre en $0.
    const amortizacion = n === cuotas ? saldo : roundMoney(cuotaFija - interes)
    saldo = roundMoney(Math.max(saldo - amortizacion, 0))
    const cuota = n === cuotas ? roundMoney(amortizacion + interes) : cuotaFija
    filas.push({ numero: n, cuota, interes, amortizacion: roundMoney(amortizacion), saldoPendiente: saldo })
  }

  return filas
}

export function addMonths(isoOrMs: string | number, months: number): string {
  const d = typeof isoOrMs === 'string' ? new Date(isoOrMs) : new Date(isoOrMs)
  d.setMonth(d.getMonth() + months)
  return d.toISOString()
}
