import { formatMonto } from '../utils/cuenta'

export interface AsistenteCtx {
  nombre?: string
  saldoARS?: number
  saldoUSD?: number | null
  alias?: string | null
  cbu?: string | null
}

export interface AsistenteReply {
  text: string
  href?: string
  hrefLabel?: string
}

export const SUGERENCIAS = [
  '¿Cómo transfiero?',
  'Mi saldo',
  'Pagar con QR',
  'Dólares',
  'Reservas',
  'Monix Cerca',
] as const

interface Intent {
  id: string
  keywords: string[]
  phrases?: string[]
  answer: (ctx: AsistenteCtx) => AsistenteReply
}

function stripAccents(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '')
}

function normalize(value: string) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.?]/gu, ' ')
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

function maskCbu(cbu: string) {
  const digits = cbu.replace(/\D/g, '')
  if (digits.length < 4) return 'disponible en Inicio'
  return `termina en ${digits.slice(-4)}`
}

function saludo(ctx: AsistenteCtx) {
  return ctx.nombre ? `Hola ${ctx.nombre}` : 'Hola'
}

const INTENTS: Intent[] = [
  {
    id: 'saludo',
    keywords: ['hola', 'buenas', 'buen dia', 'buenos dias', 'hey', 'hi', 'holis', 'que tal'],
    phrases: ['como estas', 'que podes hacer', 'quien sos'],
    answer: (ctx) => ({
      text: `${saludo(ctx)}, soy Moni, el asistente de Monix. Preguntame por transferencias, QR, dólares, reservas o lo que necesites. Te respondo al toque.`,
    }),
  },
  {
    id: 'gracias',
    keywords: ['gracias', 'thanks', 'genial', 'perfecto', 'ok', 'dale'],
    answer: () => ({
      text: 'De nada. Si necesitás otra cosa, escribime o tocá una sugerencia.',
    }),
  },
  {
    id: 'saldo',
    keywords: ['saldo', 'plata', 'dinero', 'disponible', 'tengo'],
    phrases: ['cuanto tengo', 'mi saldo', 'ver saldo', 'cuanta plata'],
    answer: (ctx) => {
      if (ctx.saldoARS == null) {
        return {
          text: 'Tu saldo está en Inicio. Abrí el ojo para ver CBU y alias.',
          href: '/dashboard',
          hrefLabel: 'Ir a Inicio',
        }
      }
      const usd =
        ctx.saldoUSD != null
          ? ` En dólares tenés ${formatMonto(ctx.saldoUSD, 'USD')}.`
          : ''
      return {
        text: `${ctx.nombre ? `${ctx.nombre}, t` : 'T'}enés ${formatMonto(ctx.saldoARS, 'ARS')} disponibles en pesos.${usd}`,
        href: '/dashboard',
        hrefLabel: 'Ver en Inicio',
      }
    },
  },
  {
    id: 'cbu_alias',
    keywords: ['cbu', 'cvu', 'alias', 'datos', 'cuenta'],
    phrases: ['mi cbu', 'mi alias', 'copiar cbu', 'numero de cuenta'],
    answer: (ctx) => {
      const alias = ctx.alias ? `Tu alias es ${ctx.alias}.` : 'El alias se ve y se cambia en Perfil.'
      const cbu = ctx.cbu ? ` Tu CBU ${maskCbu(ctx.cbu)}.` : ''
      return {
        text: `${alias}${cbu} En Inicio tocá el ojo para copiarlos.`,
        href: '/dashboard',
        hrefLabel: 'Ver datos',
      }
    },
  },
  {
    id: 'transferir',
    keywords: ['transferir', 'transferencia', 'enviar', 'mandar', 'giro'],
    phrases: ['enviar dinero', 'mandar plata', 'como transfiero', 'hacer una transferencia'],
    answer: () => ({
      text: 'En Transferir buscá por CBU o alias, elegí el monto y confirmá. También podés usar contactos recientes. Las 24 hs, al instante.',
      href: '/transferir',
      hrefLabel: 'Ir a Transferir',
    }),
  },
  {
    id: 'depositar',
    keywords: ['depositar', 'deposito', 'cargar', 'acreditar', 'ingresar'],
    phrases: ['cargar plata', 'ingresar dinero', 'hacer un deposito'],
    answer: () => ({
      text: 'En Depositar elegís la cuenta (pesos o dólares) y el monto. Se acredita al toque en tu saldo.',
      href: '/depositar',
      hrefLabel: 'Ir a Depositar',
    }),
  },
  {
    id: 'historial',
    keywords: ['historial', 'movimientos', 'comprobante', 'pdf', 'extracto'],
    phrases: ['ultimo movimiento', 'ver movimientos', 'bajar comprobante'],
    answer: () => ({
      text: 'En Historial están todas las operaciones. Tocá una para ver el detalle y descargar el comprobante en PDF.',
      href: '/historial',
      hrefLabel: 'Ir a Historial',
    }),
  },
  {
    id: 'pagar_qr',
    keywords: ['qr', 'cobrar', 'cobro', 'escanear'],
    phrases: ['pagar con qr', 'cobrar con qr', 'codigo qr'],
    answer: () => ({
      text: 'El botón QR del centro abre la cámara para pagar. En Pagar tenés tu código para cobrar: podés dejarlo abierto o ponerle un monto. El NFC de la tarjeta está en Mis Tarjetas.',
      href: '/pagar',
      hrefLabel: 'Abrir QR',
    }),
  },
  {
    id: 'nfc',
    keywords: ['nfc', 'contactless', 'acercar', 'tap'],
    phrases: ['pago nfc', 'pagar acercando', 'sin contacto'],
    answer: () => ({
      text: 'El pago acercando el celular o el sticker NFC está en Mis Tarjetas. El QR para cobrar y pagar quedó en Pagar, separado.',
      href: '/tarjeta',
      hrefLabel: 'Mis Tarjetas',
    }),
  },
  {
    id: 'cerca',
    keywords: ['cerca', 'bluetooth', 'radio', 'personas'],
    phrases: ['monix cerca', 'transferir cerca', 'alguien cerca'],
    answer: () => ({
      text: 'Monix Cerca detecta otro celular con la app cerca tuyo (Bluetooth o NFC). Ves el nombre y el alias, y transferís al toque. Nunca se transmite tu CBU.',
      href: '/cerca',
      hrefLabel: 'Abrir Monix Cerca',
    }),
  },
  {
    id: 'dolares',
    keywords: ['dolar', 'dolares', 'usd', 'divisa', 'cotizacion', 'blue'],
    phrases: ['comprar dolares', 'vender dolares', 'cambio de dolares'],
    answer: () => ({
      text: 'En Compra y Venta USD operás con la cotización oficial. Elegís comprar o vender, ves el total en pesos y confirmás.',
      href: '/dolares',
      hrefLabel: 'Ir a Dólares',
    }),
  },
  {
    id: 'reservas',
    keywords: ['reserva', 'reservas', 'ahorro', 'interes', 'rendimiento'],
    phrases: ['separar plata', 'hacer rendir', 'plazo fijo'],
    answer: () => ({
      text: 'En Reservas apartás plata de tu saldo y genera interés diario. Podés ingresar o retirar cuando quieras.',
      href: '/reservas',
      hrefLabel: 'Ir a Reservas',
    }),
  },
  {
    id: 'tarjeta',
    keywords: ['tarjeta', 'debit', 'cvv', 'congelar', 'freeze', 'limites'],
    phrases: ['congelar tarjeta', 'pausar tarjeta', 'datos de la tarjeta'],
    answer: () => ({
      text: 'En Mis Tarjetas ves débito en pesos y dólares, podés congelarla, activar NFC y consultar límites. Los datos sensibles se muestran solo si los pedís.',
      href: '/tarjeta',
      hrefLabel: 'Ver tarjetas',
    }),
  },
  {
    id: 'contactos',
    keywords: ['contacto', 'contactos', 'agenda', 'favorito', 'favoritos'],
    phrases: ['agregar contacto', 'guardar destinatario'],
    answer: () => ({
      text: 'En Contactos guardás destinatarios frecuentes. Después aparecen al transferir para no volver a buscar el alias.',
      href: '/contactos',
      hrefLabel: 'Ir a Contactos',
    }),
  },
  {
    id: 'promos',
    keywords: ['promo', 'promos', 'descuento', 'oferta', 'ofertas', '2x1'],
    answer: () => ({
      text: 'Hay descuentos vigentes: supermercados, cine 2x1, viajes e indumentaria. Las condiciones están en cada promo.',
      href: '/promos',
      hrefLabel: 'Ver promociones',
    }),
  },
  {
    id: 'cashback',
    keywords: ['cashback', 'devolucion', 'devolver'],
    phrases: ['me devuelven', 'porcentaje de devolucion'],
    answer: () => ({
      text: 'El cashback te devuelve un porcentaje en comercios adheridos: hasta 8% en mercadoMONIX, 5% en combustible los fines de semana y 3% en gastronomía.',
      href: '/cashback',
      hrefLabel: 'Ver cashback',
    }),
  },
  {
    id: 'financiacion',
    keywords: ['cuota', 'cuotas', 'financiar', 'financiacion', 'plan'],
    phrases: ['pagar en cuotas', 'sin interes'],
    answer: () => ({
      text: 'Hay planes de 3 cuotas sin interés (hasta $50.000), 6 y 12 cuotas a tasa fija. Podés simular el valor de cada cuota.',
      href: '/financiacion',
      hrefLabel: 'Simular cuotas',
    }),
  },
  {
    id: 'mercado',
    keywords: ['mercado', 'mercadomonix', 'tienda', 'shopping', 'producto', 'comprar'],
    phrases: ['comprar online', 'envio full'],
    answer: () => ({
      text: 'mercadoMONIX es la tienda de la app: envío full, cuotas y cashback en productos seleccionados. Pagás con tu saldo Monix.',
      href: '/mercado-monix',
      hrefLabel: 'Entrar a mercadoMONIX',
    }),
  },
  {
    id: 'cuentas',
    keywords: ['cuentas', 'pesos', 'ars'],
    phrases: ['cuenta en dolares', 'cuenta en pesos', 'mis cuentas'],
    answer: () => ({
      text: 'Tenés cuenta en pesos y, si está creada, en dólares. En Cuentas ves saldos, CBU y alias de cada una.',
      href: '/cuentas',
      hrefLabel: 'Ver cuentas',
    }),
  },
  {
    id: 'perfil',
    keywords: ['perfil', 'email', 'telefono', 'contrasena', 'password', 'clave', 'foto'],
    phrases: ['cambiar alias', 'cambiar contrasena', 'editar perfil'],
    answer: () => ({
      text: 'En Perfil editás email, teléfono, foto, alias y contraseña. El alias se valida para que no esté repetido.',
      href: '/perfil',
      hrefLabel: 'Ir a Perfil',
    }),
  },
  {
    id: 'seguridad',
    keywords: ['seguro', 'seguridad', 'privacidad', 'datos', 'proteger'],
    answer: () => ({
      text: 'Tu sesión está protegida. No compartas CBU completo ni la clave. Podés congelar la tarjeta al instante si la perdés.',
      href: '/tarjeta',
      hrefLabel: 'Congelar tarjeta',
    }),
  },
  {
    id: 'tema',
    keywords: ['oscuro', 'claro', 'tema', 'dark', 'modo'],
    phrases: ['modo oscuro', 'cambiar tema'],
    answer: () => ({
      text: 'El interruptor de sol/luna está arriba a la derecha, junto a las notificaciones. Cambia entre claro y oscuro.',
    }),
  },
  {
    id: 'ayuda',
    keywords: ['ayuda', 'help', 'opciones', 'podes', 'hacer'],
    phrases: ['que podes hacer', 'como funciona', 'necesito ayuda'],
    answer: () => ({
      text: 'Puedo ayudarte con transferir, depositar, QR, NFC, dólares, reservas, tarjetas, promos, cashback y mercadoMONIX. Preguntame en criollo.',
    }),
  },
]

const FALLBACK: AsistenteReply = {
  text: 'No encontré eso todavía. Probá con: transferir, saldo, QR, dólares, reservas o Monix Cerca.',
}

export function responder(pregunta: string, ctx: AsistenteCtx = {}): AsistenteReply {
  const q = normalize(pregunta)
  if (!q) {
    return { text: 'Escribí tu consulta o tocá una sugerencia.' }
  }

  let best: { score: number; intent: Intent } | null = null

  for (const intent of INTENTS) {
    let score = 0
    for (const phrase of intent.phrases ?? []) {
      if (containsTerm(q, phrase)) score += 8
    }
    for (const keyword of intent.keywords) {
      if (containsTerm(q, keyword)) score += keyword.length >= 5 ? 3 : 2
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { score, intent }
    }
  }

  if (!best || best.score < 2) return FALLBACK
  return best.intent.answer(ctx)
}

export function mensajeBienvenida(ctx: AsistenteCtx): AsistenteReply {
  return {
    text: `${saludo(ctx)}, soy Moni. Consultas rápidas sobre tu cuenta, sin vueltas. ¿En qué te ayudo?`,
  }
}
