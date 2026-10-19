// Lee un monto escrito por una persona en Argentina: el punto separa miles y la
// coma separa decimales ("1.500" es mil quinientos, "1.500,75" lleva centavos).
// También acepta el punto como decimal cuando no puede ser separador de miles
// ("1500.5", "0.75"), porque así lo escriben algunos teclados numéricos.
// Devuelve NaN si el texto no es un monto válido o tiene más de 2 decimales.
export function parseMonto(texto: string): number {
  const s = texto.replace(/[\s$]/g, '')
  if (!s) return NaN

  let normalizado: string
  if (s.includes(',')) {
    // Coma decimal: los puntos sólo pueden ser de miles, en grupos de 3.
    if (!/^\d{1,3}(\.\d{3})*,\d{1,2}$|^\d+,\d{1,2}$/.test(s)) return NaN
    normalizado = s.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.500" o "12.345.678": separadores de miles.
    normalizado = s.replace(/\./g, '')
  } else if (/^\d+(\.\d{1,2})?$/.test(s)) {
    // "1500", "1500.5" o "0.75": punto decimal.
    normalizado = s
  } else {
    return NaN
  }

  return Number(normalizado)
}
