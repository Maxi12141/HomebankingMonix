import { TOPICS, type AsistenteCtx, type AsistenteReply, type Topic } from './asistenteConocimiento'
import { consultar, intencionConPlata, jergaAPlata, normalizar } from './asistenteConsultas'
import { SUGERENCIAS, mensajeBienvenida } from './asistenteBienvenida'

export { SUGERENCIAS, mensajeBienvenida }
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

// Charla suelta: no tiene sentido "seguir" con ella.
const SIN_CONTINUACION = new Set(['gracias', 'saludo', 'ayuda'])

const SEGUIMIENTO =
  /^(y |ok |dale |entonces |bueno |claro |si |sip |bien )?(eso|eso como|como hago|como era|como es|y eso|mas info|mas detalles|explicame|contame|contame mas|y ahora|en serio|cuanto|cuanto es|cuanto sale|cuanto cuesta|es gratis|sirve|funciona|donde|en donde|y el|y la|y los|dale)$/

const normalize = normalizar

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
  if (Math.min(a.length, b.length) >= 5 && (a.includes(b) || b.includes(a))) return true
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
  const texts = topic.answers(ctx, seed)
  return {
    text: elegirTexto(texts, seed, turn),
    href: topic.href,
    hrefLabel: topic.hrefLabel,
    topicId: topic.id,
  }
}

// ── Cuando conviene frenar en vez de adivinar ──────────────────────────────

const EJEMPLOS = '“¿cuánto tengo en Reservas?”, “mi último movimiento” o “¿cómo transfiero?”'

const FALLBACKS_BANCO = [
  `No te seguí del todo. Probá con algo más puntual, por ejemplo ${EJEMPLOS}.`,
  `Prefiero no adivinar. Decime qué producto o qué dato querés (saldo, cuota, alias, TNA, tarjeta…) y te respondo.`,
  `Eso no me quedó claro. Escribilo de otra forma: ${EJEMPLOS}.`,
]

const FALLBACKS_AFUERA = [
  'Soy el asistente de Monix, así que voy mejor con lo del banco. Preguntame por tu cuenta, un producto o cómo hacer una operación.',
  'Eso queda afuera de Monix. Si es de tu caja, tarjetas, préstamos o pagos, tirame la consulta y te la resuelvo.',
  'Me centro en el homebanking. ¿Hace falta ver un saldo, una cuota, un límite o un alias?',
]

const BANCO_HINT =
  /saldo|plata|dinero|peso|dolar|cuenta|transfer|cbu|cvu|alias|tarjeta|qr|prestam|reserva|ahorro|depos|pago|pagar|promos|cashback|cuota|financi|mercado|meta|huella|clave|sesion|comision|horario|bono|cajero|debito|credito|monix|banco|cotiz|tna|interes|movimiento/

const NOMBRE_TEMA: Record<string, string> = {
  saldo: 'tu saldo',
  cbu_alias: 'tu alias o CBU',
  transferir: 'transferencias',
  depositar: 'depósitos',
  gastos: 'tus gastos',
  historial: 'tu historial',
  pagar_qr: 'pagos con QR',
  metas: 'metas comunes',
  dolares: 'dólares',
  reservas: 'Reservas',
  tarjeta: 'tu tarjeta',
  congelar: 'congelar la tarjeta',
  limites: 'límites de la tarjeta',
  contactos: 'contactos',
  promos: 'promos',
  cashback: 'cashback',
  mercado: 'mercadoMONIX',
  cuentas: 'tus cuentas',
  cuenta_usd: 'la cuenta en dólares',
  prestamos: 'préstamos',
  sueldo: 'cobrar el sueldo en Monix',
  perfil: 'tu perfil',
  huella: 'la huella',
  seguridad: 'seguridad',
  costos: 'comisiones',
  horarios: 'horarios',
  bono: 'el bono de bienvenida',
  cajero: 'sacar efectivo',
  login: 'iniciar sesión',
  'dos-pasos': 'verificación en dos pasos',
  sesiones: 'sesiones abiertas',
}

const SIGLAS_SIN_VOCAL = new Set(['qr', 'cbu', 'cvu', 'tna', 'dni', 'pin', 'cvv', 'ars', 'atm', 'pdf', 'nfc', 'mp', 'ya', 'mps', 'ctm'])

function pareceRuido(q: string) {
  if (q.length < 2) return true
  if (/(.)\1{3,}/.test(q)) return true
  if (/[^aeiouy\s\d]{5,}/.test(q)) return true
  const palabras = q.split(' ').filter(Boolean)
  if (palabras.length === 0) return true
  const sinVocal = palabras.filter((w) => w.length >= 3 && !/[aeiou]/.test(w) && !SIGLAS_SIN_VOCAL.has(w))
  if (sinVocal.length > 0 && sinVocal.length >= palabras.length / 2) return true
  return /^[\d\s]+$/.test(q)
}

const ACK = /^(?:ok|okey|okis|oka|listo|bueno|genial|perfecto|joya|barbaro|buenisimo|entendido|ya esta|todo bien|excelente)$/

const PIDE_SECRETO =
  /\b(?:dame|dime|decime|pasame|mostrame|mandame|cual es|ver|recordame)\b.*\b(?:clave|contrasena|password|cvv|pin|token|codigo de seguridad|codigos? de recuperacion)\b/

const OTRA_PERSONA = /\bcuant[oa] (?:plata |dinero )?(?:tiene|tienen|gana|ganan)\b/

const ACCION =
  /^(?:(?:por favor|porfa|podes|podrias|puedes|quiero que|necesito que)\s+)*(transferi(?:me|le|les)?|mandale|mandame|manda|envia(?:le|me)?|enviale|pagale|pagame|paga|comprame|compra|vendeme|vende|depositame|deposita|saca(?:me)?|retira(?:me)?|congela(?:me|la)?|descongela(?:la)?|cambia(?:me)?|cambiame|borra(?:me)?|elimina(?:me)?|anula|cancela|pedime|activa(?:me|la)?|abri(?:me)?|aproba|vota)\b/

function soloLectura(q: string): AsistenteReply | null {
  const m = q.match(ACCION)
  if (!m) return null
  const verbo = m[1]
  let href: string | undefined
  let hrefLabel: string | undefined
  let donde = ''
  if (/^(?:transferi|manda|envia|pagale|pagame|paga)/.test(verbo)) {
    href = '/transferir'; hrefLabel = 'Ir a Transferir'; donde = 'Transferir'
  } else if (/dolar|usd|verdes/.test(q) && /^(?:compra|vende)/.test(verbo)) {
    href = '/dolares'; hrefLabel = 'Ir a Dólares'; donde = 'Dólares'
  } else if (/^deposit/.test(verbo)) {
    href = '/depositar'; hrefLabel = 'Ir a Depositar'; donde = 'Depositar'
  } else if (/congela/.test(verbo)) {
    href = '/tarjeta'; hrefLabel = 'Ver tarjetas'; donde = 'Mis Tarjetas'
  } else if (/^pedime/.test(verbo) || /prestamo/.test(q)) {
    href = '/prestamos'; hrefLabel = 'Ir a Préstamos'; donde = 'Préstamos'
  } else if (/reserva/.test(q)) {
    href = '/reservas'; hrefLabel = 'Ir a Reservas'; donde = 'Reservas'
  } else if (/alias|clave|contrasena|mail|email|foto|huella|biometria/.test(q)) {
    href = '/perfil'; hrefLabel = 'Ir a Perfil'; donde = 'Perfil'
  }
  return {
    text: `Yo solo consulto: no puedo mover plata ni cambiar nada por vos.${donde ? ` Lo hacés vos desde ${donde}; si querés, te explico el paso a paso.` : ' Si me decís qué querés lograr, te explico cómo hacerlo en la app.'}`,
    href,
    hrefLabel,
    topicId: 'solo-lectura',
  }
}

function aclarar(ranked: { topic: Topic; score: number }[], q: string, turn: number): AsistenteReply {
  const cercanos = ranked.filter((r) => r.score > 0).slice(0, 2).map((r) => NOMBRE_TEMA[r.topic.id] ?? r.topic.hrefLabel ?? r.topic.id)
  if (cercanos.length === 0) return { text: pick(FALLBACKS_BANCO, q, turn) }
  const pregunta = cercanos.length === 2 ? `${cercanos[0]} o ${cercanos[1]}` : cercanos[0]
  return {
    text: `No estoy seguro de haberte entendido. ¿Es sobre ${pregunta}? Probá con otras palabras, por ejemplo ${EJEMPLOS}.`,
  }
}

function vacia(): AsistenteReply {
  return { text: pick(['Escribí tu consulta o tocá una sugerencia.', 'Tirame la duda, aunque sea en criollo.', '¿Saldo, cuota, movimientos, QR? Lo que necesites.'], 'vacia', Date.now() % 9) }
}

export function responder(pregunta: string, ctx: AsistenteCtx = {}, opts: AsistenteOpts = {}): AsistenteReply {
  const q = jergaAPlata(normalize(pregunta))
  if (!q) return vacia()

  const turn = opts.turn ?? 0

  if (q.split(' ').length > 40) {
    return { text: 'Es mucha información junta. Partila en una pregunta corta y te respondo preciso.' }
  }
  if (PIDE_SECRETO.test(q)) {
    return {
      text: 'Por seguridad yo no manejo claves, CVV ni códigos, y Monix nunca te los pide por chat. Los datos de tu tarjeta los ves vos en Mis Tarjetas.',
      href: '/tarjeta',
      hrefLabel: 'Ver tarjetas',
      topicId: 'seguridad',
    }
  }
  if (OTRA_PERSONA.test(q) && !/\bmonix\b/.test(q)) {
    return { text: 'Solo puedo consultar tus propios datos. No tengo acceso a las cuentas de otras personas.' }
  }
  const accion = soloLectura(q)
  if (accion) return accion
  if (pareceRuido(q)) {
    return { text: `No te entendí. Escribilo de otra forma, por ejemplo ${EJEMPLOS}.` }
  }

  if (ACK.test(q)) {
    const gracias = TOPICS.find((t) => t.id === 'gracias')
    if (gracias) return replyFrom(gracias, ctx, q, turn)
  }

  const datos = consultar(q, ctx, opts.lastTopicId)
  if (datos) return datos

  const tokens = tokenize(q)
  const ranked = TOPICS.map((topic, index) => ({
    topic,
    index,
    score: scoreTopic(q, tokens, topic),
  }))

  // El tema anterior solo ayuda cuando la pregunta sola no alcanza ("y eso?", "como"). Si ya
  // nombra algo propio ("donde deposito"), manda lo que dice, no lo que veníamos hablando.
  const mejorPropio = Math.max(0, ...ranked.map((r) => r.score))
  if (opts.lastTopicId && mejorPropio < 3 && esSeguimiento(q)) {
    const prev = ranked.find((r) => r.topic.id === opts.lastTopicId)
    if (prev && !SIN_CONTINUACION.has(prev.topic.id)) prev.score += 8
  }

  const intencion = intencionConPlata(q)
  if (intencion) {
    const t = ranked.find((r) => r.topic.id === intencion)
    if (t) t.score += 14
  }

  ranked.sort((a, b) => b.score - a.score || a.index - b.index)

  // "plata" suelta empuja al saldo solo si de verdad pregunta cuánto hay y no nombra otro producto.
  const preguntaPlata = /\b(saldo|plata|dinero|pesos|cuanto tengo|mi sueldo|el sueldo|decime cuanto|decime mi saldo)\b/.test(q)
    && /\b(cuanto|cuanta|saldo|decime)\b/.test(q)
    && !/\b(cobro|acreditar|paquete|nomina|haberes|reserva|reservas|dolar|dolares|usd|prestamo|meta|metas|rendir|rinde|invertir|ahorrar)\b/.test(q)
  if (preguntaPlata) {
    const saldo = ranked.find((r) => r.topic.id === 'saldo')
    if (saldo) saldo.score += 14
    ranked.sort((a, b) => b.score - a.score || a.index - b.index)
  }

  const best = ranked[0]
  const second = ranked[1]
  const compuesta = / y | o |ademas|tambien/.test(q)

  if (best && best.score >= 3) {
    if (
      best.score >= 4 &&
      compuesta &&
      second &&
      second.score >= 8 &&
      second.score >= best.score - 3 &&
      second.topic.id !== best.topic.id
    ) {
      const a = replyFrom(best.topic, ctx, q, turn)
      const bTexts = second.topic.answers(ctx, q)
      return {
        ...a,
        text: `${a.text}\n\n${pick(bTexts, q, turn + 1)}`,
      }
    }
    return replyFrom(best.topic, ctx, q, turn)
  }

  // Coincidencia débil: antes se contestaba igual con el tema más parecido; ahora se pregunta.
  if (best && best.score > 0 && BANCO_HINT.test(q)) return aclarar(ranked, q, turn)

  return {
    text: pick(BANCO_HINT.test(q) ? FALLBACKS_BANCO : FALLBACKS_AFUERA, q, turn),
  }
}
