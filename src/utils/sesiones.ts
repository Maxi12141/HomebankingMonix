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
