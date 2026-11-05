import type { AsistenteCtx, AsistenteReply } from './asistenteConocimiento'

// Lo único de Moni que hace falta antes de abrir el chat. El motor de respuestas
// (asistente.ts) pesa bastante más y se carga recién cuando la persona abre a Moni.

export const SUGERENCIAS = [
  'Mi saldo',
  '¿Cuánto tengo en Reservas?',
  'Mi último movimiento',
  '¿Cuándo vence mi cuota?',
  '¿Cómo transfiero?',
  'Dólar hoy',
  'Préstamos',
  'Pagar con QR',
] as const

function pick(texts: string[], seed: string, salt = 0) {
  let h = (salt + 1) * 2654435761
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 1597334677)
  return texts[Math.abs(h) % texts.length] ?? texts[0]
}

export function mensajeBienvenida(ctx: Pick<AsistenteCtx, 'nombre'>): AsistenteReply {
  const h = new Date().getHours()
  const momento = h < 12 ? 'Buen día' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
  const nombre = ctx.nombre ? ` ${ctx.nombre}` : ''
  const texts = [
    `${momento}${nombre}, soy Moni. Preguntame por tu cuenta (saldo, reservas, cuotas, movimientos) o cómo hacer algo: te respondo al toque.`,
    `Hola${nombre}. Soy Moni. Consulto tus saldos, movimientos, reservas y préstamos, y te explico cualquier producto del banco.`,
    `${ctx.nombre ? `Hola ${ctx.nombre}` : 'Hola'}, soy Moni. Escribí la duda como se la dirías a un amigo. Yo solo consulto: no muevo plata.`,
  ]
  return { text: pick(texts, `${momento}${nombre}`, h) }
}
