type ClaseValor = string | false | null | undefined

/** Une clases descartando los valores falsos. Alcanza para los componentes de Kokonut UI. */
export function cn(...clases: ClaseValor[]): string {
  return clases.filter(Boolean).join(' ')
}
