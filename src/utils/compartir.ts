import toast from 'react-hot-toast'
import type { Cuenta, Persona } from '../types'

export type ResultadoCompartir = 'compartido' | 'copiado' | 'cancelado' | 'error'

/**
 * Abre el menú de compartir del teléfono (WhatsApp, mail, mensajes...) con un
 * texto. Donde no existe (la mayoría de las compus), lo copia al portapapeles
 * y avisa. Llamar directo desde el handler del click: el navegador sólo deja
 * abrir el menú si viene de un toque del usuario.
 */
export async function compartirTexto({ titulo, texto, url }: { titulo: string; texto: string; url?: string }): Promise<ResultadoCompartir> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: titulo, text: texto, ...(url ? { url } : {}) })
      return 'compartido'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelado'
      // Algunos navegadores tienen share pero lo rechazan (NotAllowedError,
      // contexto no seguro): cae al portapapeles igual que en desktop.
    }
  }
  try {
    await navigator.clipboard.writeText(url ? `${texto}\n${url}` : texto)
    toast.success('Copiado. Pegalo donde quieras compartirlo')
    return 'copiado'
  } catch {
    toast.error('No se pudo compartir')
    return 'error'
  }
}

/** Mensaje con los datos para que otra persona nos transfiera. */
export function textoDatosCuenta(cuenta: Cuenta, persona: Persona | null): string {
  const lineas = [
    'Mis datos para transferirme:',
    persona ? `Titular: ${persona.nombre} ${persona.apellido}` : null,
    'Banco: Monix',
    `Cuenta: Caja de ahorro en ${cuenta.moneda === 'USD' ? 'dólares (USD)' : 'pesos'}`,
    cuenta.cbu ? `CBU: ${cuenta.cbu}` : null,
    cuenta.alias ? `Alias: ${cuenta.alias}` : null,
  ]
  return lineas.filter(Boolean).join('\n')
}
