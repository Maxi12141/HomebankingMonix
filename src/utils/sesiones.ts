/** "Chrome en Android": lo justo para que cada persona reconozca su dispositivo. */
export function nombreDispositivo(userAgent: string | null): string {
  const ua = userAgent ?? ''
  if (!ua) return 'Dispositivo sin identificar'

  const sistema = /iPhone/.test(ua) ? 'iPhone'
    : /iPad/.test(ua) ? 'iPad'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Macintosh/.test(ua) ? 'Mac'
    : /Linux/.test(ua) ? 'Linux'
    : null

  const navegador = /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /Edg(e|A|iOS)?\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Firefox|FxiOS/.test(ua) ? 'Firefox'
    : /Chrome|CriOS/.test(ua) ? 'Chrome'
    : /Safari/.test(ua) ? 'Safari'
    : null

  if (navegador && sistema) return `${navegador} en ${sistema}`
  return navegador ?? sistema ?? 'Dispositivo sin identificar'
}

export function haceCuanto(fecha: string, ahora: Date = new Date()): string {
  const minutos = Math.floor((ahora.getTime() - new Date(fecha).getTime()) / 60_000)
  if (minutos < 1) return 'recién'
  if (minutos < 60) return `hace ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`
  const dias = Math.floor(horas / 24)
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`
}

export type TipoDispositivo = 'Celular' | 'Tablet' | 'Computadora'

export function tipoDispositivo(userAgent: string | null): TipoDispositivo | null {
  const ua = userAgent ?? ''
  if (/iPad|Tablet/.test(ua)) return 'Tablet'
  if (/iPhone|Android.*Mobile|Mobile.*Android/.test(ua)) return 'Celular'
  if (/Android/.test(ua)) return 'Tablet'
  if (/Windows|Macintosh|Linux|CrOS/.test(ua)) return 'Computadora'
  return null
}

export function fechaYHora(fecha: string): string {
  return new Date(fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
}

export const INACTIVIDAD_MAXIMA_MS = 15 * 60_000
const ACTIVIDAD_KEY = 'monix_ultima_actividad'
const MARCAR_CADA_MS = 10_000
let ultimaMarca = 0

export function marcarActividad() {
  const ahora = Date.now()
  if (ahora - ultimaMarca < MARCAR_CADA_MS) return
  ultimaMarca = ahora
  try {
    localStorage.setItem(ACTIVIDAD_KEY, String(ahora))
  } catch {
    /* modo privado: sin marca no se cierra por inactividad */
  }
}

export function leerUltimaActividad(): number | null {
  try {
    const valor = Number(localStorage.getItem(ACTIVIDAD_KEY))
    return valor > 0 ? valor : null
  } catch {
    return null
  }
}

export function inactividadVencida(ultima: number | null, ahora: number, conBiometria: boolean): boolean {
  if (conBiometria || ultima === null) return false
  return ahora - ultima >= INACTIVIDAD_MAXIMA_MS
}
