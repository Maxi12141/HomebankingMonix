import {
  SUGERENCIAS,
  TOPICS,
  type AsistenteCtx,
  type AsistenteReply,
  type Topic,
} from './asistenteConocimiento'

export { SUGERENCIAS }
export type { AsistenteCtx, AsistenteReply }

export interface AsistenteOpts {
  lastTopicId?: string
  turn?: number
}

const STOP = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'en', 'y', 'o', 'u', 'a',
  'que', 'me', 'te', 'se', 'mi', 'mis', 'tu', 'tus', 'su', 'al', 'lo', 'le', 'les', 'por', 'para', 'con',
  'como', 'mas', 'muy', 'ya', 'si', 'quiero', 'queria', 'necesito', 'saber', 'sobre',
  'puedo', 'podes', 'puede', 'podria', 'hacer', 'hago', 'hacemos', 'esta', 'este', 'esto',
  'esa', 'ese', 'eso', 'hay', 'tiene', 'tengo', 'vos', 'soy', 'ser', 'the', 'and', 'for', 'are',
])

const SEGUIMIENTO =
  /^(y |ok |dale |entonces |bueno |claro |si |sip |bien )?(eso|eso como|como hago|como era|como es|y eso|mas info|mas detalles|explicame|contame|contame mas|y ahora|en serio|cuanto|cuanto es|cuanto sale|cuanto cuesta|es gratis|sirve|funciona|donde|en donde|y el|y la|y los|dale)$/

function stripAccents(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '')
}

function normalize(value: string) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function containsTerm(haystack: string, term: string) {
  const t = normalize(term)
  if (!t) return false
  if (t.includes(' ')) return haystack.includes(t)
  return new RegExp(`(?:^|\\s)${escapeRegExp(t)}(?:$|\\s)`).test(` ${haystack} `)
}

function tokenize(q: string) {
  return q.split(' ').filter((t) => t.length > 1 && !STOP.has(t))
}

function similar(a: string, b: string) {
  if (a === b) return true
  if (a.length < 4 || b.length < 4) return false
  if (a.includes(b) || b.includes(a)) return true
  return a.slice(0, 5) === b.slice(0, 5) && Math.min(a.length, b.length) >= 5
}

function hashPick(seed: string, salt: number, size: number) {
  let h = (salt + 1) * 2654435761
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 1597334677)
  return Math.abs(h) % size
}

function pick(texts: string[], seed: string, salt = 0) {
  return texts[hashPick(seed, salt, texts.length)] ?? texts[0]
}

function esSeguimiento(q: string) {
  if (SEGUIMIENTO.test(q)) return true
  const words = q.split(' ').filter(Boolean)
  return words.length <= 4 && /^(y|ok|dale|entonces|bueno|claro|si|sip|eso|como|donde|cuanto|mas|y eso)/.test(q)
}

function scoreTopic(q: string, tokens: string[], topic: Topic) {
  let score = 0
  for (const phrase of topic.phrases) {
    const p = normalize(phrase)
    if (p && containsTerm(q, p)) score += 8 + Math.min(p.length, 24)
  }
  let exactKeyword = false
  for (const keyword of topic.keywords) {
    const k = normalize(keyword)
    if (containsTerm(q, k)) {
      score += k.length >= 5 ? 5 : 3
      exactKeyword = true
    }
  }
  if (!exactKeyword) {
    for (const keyword of topic.keywords) {
      const k = normalize(keyword)
      if (tokens.some((t) => similar(t, k))) score += k.length >= 5 ? 4 : 2
    }
  }
  for (const extra of topic.extra) {
    const e = normalize(extra)
    if (containsTerm(q, e) || tokens.some((t) => similar(t, e))) score += 2
  }
  for (const weak of topic.weak ?? []) {
    if (containsTerm(q, weak)) score += 1
  }
  return score
}

function elegirTexto(texts: string[], q: string, turn: number) {
  if (/^(como|donde|quiero|necesito|puedo|podes|comprar|vender|abrir|pedir|activar|congelar|pagar|transferir|olvide)/.test(q)) return texts[0]
  return pick(texts, q, turn)
}

function replyFrom(topic: Topic, ctx: AsistenteCtx, seed: string, turn: number): AsistenteReply {
  const texts = topic.answers(ctx)
  return {
    text: elegirTexto(texts, seed, turn),
    href: topic.href,
    hrefLabel: topic.hrefLabel,
    topicId: topic.id,
  }
}

const FALLBACKS_BANCO = [
  'Puedo ayudarte con cualquier cosa de Monix: saldo, transferencias, QR, dólares, reservas, préstamos, débito, promos, cashback o mercadoMONIX. Preguntame más puntual.',
  'No te seguí del todo. Probá con el producto: “préstamo”, “alias”, “congelar tarjeta”, “TNA de reservas”, “comprar dólares”…',
  'Decime qué querés hacer en el banco (enviar plata, pedir crédito, pagar con QR, hacer rendir el saldo) y te armo el paso a paso.',
]

const FALLBACKS_AFUERA = [
  'Soy el asistente de Monix, así que voy mejor con lo del banco. Preguntame por tu cuenta, un producto o cómo hacer una operación.',
  'Eso queda afuera de Monix. Si es de tu caja, tarjetas, préstamos o pagos, tirame la consulta y te la resuelvo.',
  'Me centro en el homebanking. ¿Hace falta transferir, ver un límite, un CBU, un préstamo o una promo?',
]

const BANCO_HINT =
  /saldo|plata|peso|dolar|cuenta|transfer|cbu|cvu|alias|tarjeta|qr|nfc|prestam|reserva|ahorro|depos|pago|pagar|promos|cashback|cuota|financi|mercado|cerca|huella|clave|sesion|comision|horario|bono|cajero|debito|credito|monix|banco|cotiz|tna|interes/

function vacia(): AsistenteReply {
  return { text: pick(['Escribí tu consulta o tocá una sugerencia.', 'Tirame la duda, aunque sea en criollo.', '¿Saldo, transferir, préstamo, QR? Lo que necesites.'], 'vacia', Date.now() % 9) }
}

export function responder(pregunta: string, ctx: AsistenteCtx = {}, opts: AsistenteOpts = {}): AsistenteReply {
  const q = normalize(pregunta)
  if (!q) return vacia()

  const tokens = tokenize(q)
  const turn = opts.turn ?? 0
  const ranked = TOPICS.map((topic, index) => ({
    topic,
    index,
    score: scoreTopic(q, tokens, topic),
  }))

  if (opts.lastTopicId && esSeguimiento(q)) {
    const prev = ranked.find((r) => r.topic.id === opts.lastTopicId)
    if (prev) prev.score += 8
  }

  ranked.sort((a, b) => b.score - a.score || a.index - b.index)

  const best = ranked[0]
  const second = ranked[1]
  const compuesta = / y | o |ademas|tambien/.test(q)

  if (best && best.score >= 4) {
    if (
      compuesta &&
      second &&
      second.score >= 8 &&
      second.score >= best.score - 3 &&
      second.topic.id !== best.topic.id
    ) {
      const a = replyFrom(best.topic, ctx, q, turn)
      const bTexts = second.topic.answers(ctx)
      return {
        ...a,
        text: `${a.text}\n\n${pick(bTexts, q, turn + 1)}`,
      }
    }
    return replyFrom(best.topic, ctx, q, turn)
  }

  if (best && best.score >= 2) {
    return replyFrom(best.topic, ctx, q, turn)
  }

  if (BANCO_HINT.test(q) && best && best.score > 0) {
    const near = ranked.filter((r) => r.score > 0).slice(0, 2)
    const hint = near.map((r) => r.topic.hrefLabel ?? r.topic.id).join(' o ')
    return {
      ...replyFrom(best.topic, ctx, q, turn),
      text: `${pick(best.topic.answers(ctx), q, turn)} Si no era eso, capaz buscabas ${hint}.`,
    }
  }

  return {
    text: pick(BANCO_HINT.test(q) ? FALLBACKS_BANCO : FALLBACKS_AFUERA, q, turn),
  }
}

export function mensajeBienvenida(ctx: AsistenteCtx): AsistenteReply {
  const h = new Date().getHours()
  const momento = h < 12 ? 'Buen día' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
  const nombre = ctx.nombre ? ` ${ctx.nombre}` : ''
  const texts = [
    `${momento}${nombre}, soy Moni. Preguntame lo que sea de tu cuenta Monix: te respondo al toque.`,
    `Hola${nombre}. Soy Moni, el asistente del banco. Transferencias, préstamos, dólares, QR, lo que se te ocurra.`,
    `${ctx.nombre ? `Hola ${ctx.nombre}` : 'Hola'}, soy Moni. No hace falta un menú: escribí la duda como la dirías a un amigo.`,
  ]
  return { text: pick(texts, `${momento}${nombre}`, h) }
}
