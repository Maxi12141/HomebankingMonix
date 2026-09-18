import { formatMonto } from '../utils/cuenta'

export interface AsistenteCtx {
  nombre?: string
  saldoARS?: number
  saldoUSD?: number | null
  tieneUsd?: boolean
  alias?: string | null
  cbu?: string | null
  saldoReserva?: number | null
  tasaReserva?: number | null
}

export interface AsistenteReply {
  text: string
  href?: string
  hrefLabel?: string
  topicId?: string
}

export interface Topic {
  id: string
  href?: string
  hrefLabel?: string
  phrases: string[]
  keywords: string[]
  extra: string[]
  weak?: string[]
  answers: (ctx: AsistenteCtx) => string[]
}

export const SUGERENCIAS = [
  '¿Cómo transfiero?',
  'Mi saldo',
  'Préstamos',
  'Pagar con QR',
  'Dólares',
  'Reservas',
  'Monix Cerca',
  'Cashback',
] as const

function nom(ctx: AsistenteCtx) {
  return ctx.nombre ? `${ctx.nombre}` : ''
}

function hola(ctx: AsistenteCtx) {
  return ctx.nombre ? `Hola ${ctx.nombre}` : 'Hola'
}

function maskCbu(cbu: string) {
  const digits = cbu.replace(/\D/g, '')
  if (digits.length < 4) return 'disponible en Inicio'
  return `termina en ${digits.slice(-4)}`
}

function saldoTexto(ctx: AsistenteCtx) {
  if (ctx.saldoARS == null) return null
  const usd =
    ctx.tieneUsd && ctx.saldoUSD != null
      ? ` En dólares tenés ${formatMonto(ctx.saldoUSD, 'USD')}.`
      : ''
  return { ars: formatMonto(ctx.saldoARS, 'ARS'), usd }
}

export const TOPICS: Topic[] = [
  {
    id: 'saludo',
    phrases: ['como estas', 'quien sos', 'quien eres', 'que tal', 'buenas tardes', 'buenas noches', 'buen dia'],
    keywords: ['hola', 'holis', 'buenas', 'hey', 'hi', 'hello', 'moni'],
    extra: ['asistente', 'bot', 'ayuda'],
    answers: (ctx) => [
      `${hola(ctx)}, soy Moni, el asistente de Monix. Preguntame lo que quieras de tu cuenta: transferencias, préstamos, dólares, QR, reservas, tarjetas…`,
      `${hola(ctx)}. Estoy para lo de Monix. Decime qué necesitás y te digo el paso a paso, no un texto genérico.`,
      `Buenas${nom(ctx) ? `, ${nom(ctx)}` : ''}. Soy Moni. Puedo explicarte cualquier producto del banco y, si hace falta, te dejo el atajo para ir ahí.`,
    ],
  },
  {
    id: 'gracias',
    phrases: ['muy amable', 'te agradezco', 'buenisimo', 'buenísimo'],
    keywords: ['gracias', 'thanks', 'genial', 'perfecto', 'joya', 'groso'],
    extra: ['okey', 'okis'],
    weak: ['ok', 'dale', 'listo'],
    answers: () => [
      'De nada. Si se te ocurre otra duda del banco, tirame la pregunta.',
      'Cuando quieras. Puedo seguir con préstamos, tarjetas, dólares o lo que falte.',
      'Dale. Estoy acá si necesitás el paso a paso de alguna operación.',
    ],
  },
  {
    id: 'ayuda',
    phrases: ['que podes hacer', 'que podes responder', 'necesito ayuda', 'como funciona monix', 'en que me ayudas'],
    keywords: ['ayuda', 'help', 'opciones', 'menu', 'funciones'],
    extra: ['sabes', 'consultas'],
    answers: () => [
      'Sé de todo Monix: saldo, CBU/alias, transferir, depositar, historial, QR, NFC, Cerca, dólares, reservas, préstamos, tarjetas, contactos, promos, cashback, financiación, mercadoMONIX, perfil, huella y seguridad. Preguntame concreto.',
      'Podés preguntarme cómo hacer algo, cuánto cuesta, límites, tasas o qué pantalla usar. Por ejemplo: “¿cómo pido un préstamo?” o “¿qué TNA tiene Reservas?”.',
      'No hace falta que uses las sugerencias. Escribí en criollo: “quiero mandar plata”, “se me perdió la tarjeta”, “rinde el ahorro?”. Te respondo con el producto de Monix que corresponde.',
    ],
  },
  {
    id: 'que_es',
    phrases: ['que es monix', 'que es el banco', 'banco digital', 'homebanking', 'que es este banco'],
    keywords: ['homebanking', 'fintech', 'billetera'],
    extra: ['entidad', 'neobank'],
    weak: ['monix', 'banco'],
    answers: () => [
      'Monix es un banco digital: caja de ahorro en pesos (y otra en dólares si la abrís), transferencias 24 hs, QR/NFC, préstamos, reservas con interés, débito y marketplace propio.',
      'Es tu homebanking: ves el saldo, movés plata, pagás, pedís crédito y hacés rendir un bolsillo de ahorro. Todo desde la app, sin sucursal.',
      'Monix concentra cuenta, tarjeta de débito, pagos, dólar oficial, préstamos personales y beneficios (promos, cashback, financiación) en un solo lugar.',
    ],
  },
  {
    id: 'saldo',
    href: '/dashboard',
    hrefLabel: 'Ver en Inicio',
    phrases: [
      'cuanto tengo', 'mi saldo', 'ver saldo', 'cuanta plata', 'plata disponible', 'dinero disponible',
      'decime mi saldo', 'decime el saldo', 'decime cuanto tengo', 'cuanto hay', 'mi sueldo', 'cuanto sueldo',
    ],
    keywords: ['saldo', 'disponible', 'plata', 'dinero', 'pesos'],
    extra: ['cuanto', 'hay', 'queda', 'pesos'],
    weak: ['tengo'],
    answers: (ctx) => {
      const s = saldoTexto(ctx)
      if (!s) {
        return [
          'Tu saldo está en Inicio. Ahí ves cuánto tenés en pesos.',
          'Abrí Inicio para ver el saldo de tu caja en pesos.',
        ]
      }
      const n = nom(ctx)
      return [
        `${n ? `${n}, t` : 'T'}enés ${s.ars} disponibles en pesos.${s.usd}`,
        `Saldo en caja de ahorro: ${s.ars}.${s.usd} Se actualiza al toque cuando entra o sale una transferencia.`,
        `Ahora mismo hay ${s.ars} en tu cuenta en pesos.${s.usd} Si apartaste plata en Reservas, eso no suma acá.`,
      ]
    },
  },
  {
    id: 'cbu_alias',
    href: '/dashboard',
    hrefLabel: 'Ver datos',
    phrases: ['mi cbu', 'mi alias', 'copiar cbu', 'numero de cuenta', 'datos de la cuenta', 'cual es mi alias', 'cual es mi cbu'],
    keywords: ['cbu', 'cvu', 'alias'],
    extra: ['copiar', 'compartir', 'acreditar', 'recibir'],
    weak: ['datos', 'cuenta', 'numero'],
    answers: (ctx) => {
      const alias = ctx.alias ? `Tu alias es ${ctx.alias}.` : 'El alias se ve y se cambia en Perfil.'
      const cbu = ctx.cbu ? ` Tu CBU ${maskCbu(ctx.cbu)}.` : ''
      return [
        `${alias}${cbu} En Inicio tocá el ojo para copiarlos. Nunca hace falta dar el CBU completo por chat.`,
        `${alias}${cbu} Para recibir plata, compartí el alias. El CBU de 22 dígitos también está en Cuentas.`,
        `${alias}${cbu} Si querés cambiar el alias, andá a Perfil: se valida para que no esté repetido.`,
      ]
    },
  },
  {
    id: 'transferir',
    href: '/transferir',
    hrefLabel: 'Ir a Transferir',
    phrases: ['enviar dinero', 'mandar plata', 'como transfiero', 'hacer una transferencia', 'enviar plata', 'giro al instante'],
    keywords: ['transferir', 'transferencia', 'transfiero', 'enviar', 'mandar', 'destinatario'],
    extra: ['cbu', 'alias', 'motivo', 'inmediata', '24', 'amigo', 'familiar', 'servicio', 'factura'],
    weak: ['giro'],
    answers: () => [
      'En Transferir buscá por CBU (22 dígitos) o alias, cargá el monto, elegí un motivo y confirmá. Llega al instante, las 24 hs, sin comisión.',
      'Paso a paso: Transferir → CBU o alias → monto → motivo (obligatorio) → mensaje opcional → confirmar. Si ya está en Contactos, lo elegís y listo.',
      'Las transferencias son inmediatas a cuentas Monix y a otros bancos vía CBU/alias. Si la persona está al lado, Monix Cerca evita pasar el CBU.',
    ],
  },
  {
    id: 'depositar',
    href: '/depositar',
    hrefLabel: 'Ir a Depositar',
    phrases: ['cargar plata', 'ingresar dinero', 'hacer un deposito', 'acreditar fondos'],
    keywords: ['depositar', 'deposito', 'cargar', 'acreditar', 'ingresar'],
    extra: ['fondos', 'caja', 'cargar saldo'],
    answers: () => [
      'En Depositar elegís la cuenta (pesos o dólares) y el monto. Se acredita al toque y queda en el historial.',
      'Para sumar saldo: menú Depositar, cuenta destino, monto y confirmás. No es una transferencia de otro banco: es una acreditación en tu propia caja.',
      'Si te tienen que mandar plata de afuera, no uses Depositar: compartí tu alias o CBU y que te transfieran.',
    ],
  },
  {
    id: 'historial',
    href: '/historial',
    hrefLabel: 'Ir a Historial',
    phrases: ['ultimo movimiento', 'ver movimientos', 'bajar comprobante', 'descargar pdf', 'extracto de cuenta'],
    keywords: ['historial', 'movimientos', 'comprobante', 'pdf', 'extracto', 'actividad'],
    extra: ['filtro', 'fecha', 'entrada', 'salida'],
    answers: () => [
      'En Historial están las operaciones (hasta 100). Filtrás por entradas/salidas, texto o fechas. Tocá una para el detalle y el PDF.',
      'El comprobante se descarga desde el detalle de cada movimiento: monto, contraparte, motivo y banco de origen.',
      'Inicio muestra los últimos 5 movimientos. El listado completo, con búsqueda, está en Historial.',
    ],
  },
  {
    id: 'pagar_qr',
    href: '/pagar',
    hrefLabel: 'Abrir QR',
    phrases: ['pagar con qr', 'cobrar con qr', 'codigo qr', 'escanear qr', 'mostrar qr'],
    keywords: ['qr', 'cobrar', 'cobro', 'escanear'],
    extra: ['camara', 'comercio', 'codigo'],
    weak: ['pagar', 'pago'],
    answers: () => [
      'En Pagar mostrás tu QR para cobrar (podés ponerle monto) o tocás “Escanear para pagar”. El botón QR del centro de la barra también abre esto.',
      'Para cobrar: Pagar → tu código. Para pagar: escaneá el QR del otro. El cobro vence a los pocos minutos si nadie paga.',
      'QR es para cobros entre personas o comercios. El pago acercando el celular o el sticker NFC está en Mis Tarjetas, aparte.',
    ],
  },
  {
    id: 'nfc',
    href: '/tarjeta',
    hrefLabel: 'Mis Tarjetas',
    phrases: ['pago nfc', 'pagar acercando', 'sin contacto', 'contactless', 'sticker nfc'],
    keywords: ['nfc', 'contactless', 'acercar', 'tap', 'chip'],
    extra: ['sticker', 'hce', 'pos'],
    answers: () => [
      'El pago contactless se activa en Mis Tarjetas. En Android podés grabar un sticker NFC; en iPhone se muestra un QR de la tarjeta porque no se escribe el chip desde la app.',
      'Activá “pago contactless” en Mis Tarjetas. Si la tarjeta está congelada, el NFC no sirve hasta que la descongeles.',
      'NFC y QR no son lo mismo: NFC/sticker en Mis Tarjetas; QR para cobrar o escanear, en Pagar.',
    ],
  },
  {
    id: 'cerca',
    href: '/cerca',
    hrefLabel: 'Abrir Monix Cerca',
    phrases: ['monix cerca', 'transferir cerca', 'alguien cerca', 'personas cerca'],
    keywords: ['cerca', 'bluetooth', 'radio', 'proximidad'],
    extra: ['ble', 'fondo', 'visible', 'token'],
    weak: ['personas'],
    answers: () => [
      'Monix Cerca detecta otro celular con la app cerca tuyo (Bluetooth o NFC). Ves nombre y alias, y transferís al toque. Nunca se transmite tu CBU.',
      'Activá “Visible aunque cierre la app” para que te encuentren en segundo plano (mejor con la APK). El código que se publica rota y no es tu CBU.',
      'Si estás al lado de alguien con Monix, Cerca es más rápido que dictar el alias. En el navegador suele hacer falta NFC (Chrome Android); Bluetooth de fondo pide la app instalada.',
    ],
  },
  {
    id: 'dolares',
    href: '/dolares',
    hrefLabel: 'Ir a Dólares',
    phrases: ['comprar dolares', 'vender dolares', 'cambio de dolares', 'compra venta usd', 'tipo de cambio'],
    keywords: ['dolar', 'dolares', 'usd', 'divisa', 'cotizacion', 'blue', 'oficial'],
    extra: ['mep', 'billete', 'cambio'],
    answers: () => [
      'En Compra y Venta USD operás con la cotización oficial (no blue). Comprar usa el precio vendedor; vender, el comprador. Hace falta tener caja en pesos y en dólares.',
      'Elegís comprar o vender, ponés el monto en USD, ves el total en pesos y confirmás. Se debita una cuenta y se acredita la otra al toque.',
      'La cotización se refresca sola. Si todavía no abriste la caja en USD, hacelo desde Cuentas: no pide situación crediticia.',
    ],
  },
  {
    id: 'reservas',
    href: '/reservas',
    hrefLabel: 'Ir a Reservas',
    phrases: ['separar plata', 'hacer rendir', 'plazo fijo', 'bolsillo de ahorro', 'interes diario', 'tna reserva'],
    keywords: ['reserva', 'reservas', 'ahorro', 'interes', 'rendimiento', 'tna'],
    extra: ['compuesto', 'retirar', 'ingresar', '32', 'rendir', 'rinde', 'invertir'],
    answers: (ctx) => {
      const tasa = ctx.tasaReserva ?? 32
      const enReserva =
        ctx.saldoReserva != null
          ? ` Ahora tenés ${formatMonto(ctx.saldoReserva, 'ARS')} apartados.`
          : ''
      return [
        `Reservas es un bolsillo aparte de tu saldo. Rinde interés diario compuesto, TNA ${tasa}%. Podés ingresar o retirar cuando quieras.${enReserva}`,
        `No es un plazo fijo: el dinero no queda inmovilizado. Lo movés desde Reservas y el interés se acredita solo (día a día). TNA ${tasa}%.${enReserva}`,
        `La plata en Reservas deja de estar “disponible” para gastar hasta que la retires. El rendimiento aparece como movimiento “Rendimiento de Reserva”.${enReserva}`,
      ]
    },
  },
  {
    id: 'tarjeta',
    href: '/tarjeta',
    hrefLabel: 'Ver tarjetas',
    phrases: ['datos de la tarjeta', 'tarjeta de debito', 'ver cvv', 'numero de tarjeta'],
    keywords: ['tarjeta', 'debit', 'debito', 'cvv', 'pan', 'visa'],
    extra: ['plastico', 'virtual', 'dorso'],
    answers: () => [
      'En Mis Tarjetas tenés débito en pesos y, si abriste USD, en dólares. Podés girarla, ver datos, congelarla y activar NFC. Los números sensibles solo se muestran si los pedís.',
      'Es débito Visa virtual (y sticker NFC si lo grabás). No hay tarjeta de crédito Monix: para cuotas usá Financiación o mercadoMONIX.',
      'Si la perdés, congelala al instante en Mis Tarjetas. Después la descongelás desde la misma pantalla.',
    ],
  },
  {
    id: 'congelar',
    href: '/tarjeta',
    hrefLabel: 'Congelar tarjeta',
    phrases: ['congelar tarjeta', 'pausar tarjeta', 'bloquear tarjeta', 'perdi la tarjeta', 'me robaron'],
    keywords: ['congelar', 'freeze', 'bloquear', 'pausar', 'perdida', 'robo'],
    extra: ['descongelar', 'activar', 'inhabilitar'],
    answers: () => [
      'En Mis Tarjetas está Congelar. Corta compras y NFC al toque. Cuando esté segura, la descongelás ahí mismo.',
      'Si sospechás un uso raro: congelá la tarjeta y mirá Historial. Monix no te va a pedir el CVV por chat ni por mail.',
    ],
  },
  {
    id: 'limites',
    href: '/tarjeta',
    hrefLabel: 'Ver límites',
    phrases: ['limites de la tarjeta', 'tope de compra', 'limite diario', 'cuanto puedo gastar', 'limites de la debito', 'limites diarios', 'tope de cajero'],
    keywords: ['limites', 'limite', 'tope', 'cajeros', 'atm'],
    extra: ['comercios', 'online', 'extraccion'],
    answers: () => [
      'Límites diarios de la débito en pesos: $250.000 en comercios, $80.000 en cajeros y $150.000 online. En dólares: US$ 1.500 / 500 / 1.000.',
      'Los topes de la tarjeta están en Mis Tarjetas (son informativos). Las transferencias por CBU/alias no usan esos límites de débito.',
    ],
  },
  {
    id: 'contactos',
    href: '/contactos',
    hrefLabel: 'Ir a Contactos',
    phrases: ['agregar contacto', 'guardar destinatario', 'agenda de contactos'],
    keywords: ['contacto', 'contactos', 'agenda', 'favorito', 'favoritos'],
    extra: ['apodo', 'destinatario', 'guardado'],
    answers: () => [
      'En Contactos guardás destinatarios frecuentes. Después aparecen al transferir para no volver a buscar el alias.',
      'Después de una transferencia exitosa podés agregarlo a la agenda. También editás el apodo o lo borrás cuando quieras.',
    ],
  },
  {
    id: 'promos',
    href: '/promos',
    hrefLabel: 'Ver promociones',
    phrases: ['ver promociones', 'descuentos vigentes', 'ofertas monix'],
    keywords: ['promo', 'promos', 'descuento', 'oferta', 'ofertas', '2x1'],
    extra: ['cine', 'super', 'viaje', 'indumentaria', 'shopping'],
    answers: () => [
      'Ofertas vigentes: 10% en supermercados (tope $8.000, un uso por semana), 2x1 en cines lun-jue, 30% en viajes (mín. $80.000, 1 cuota) y 15% en indumentaria el finde (tope $15.000).',
      'En Promos tocás cada oferta para ver condiciones y activarla. Se pagan con tarjeta Monix o mostrando el QR, según la promo.',
      'Las promos no se acumulan entre sí. Activá la que vas a usar y leé vigencia y tope antes de comprar.',
    ],
  },
  {
    id: 'cashback',
    href: '/cashback',
    hrefLabel: 'Ver cashback',
    phrases: ['me devuelven', 'porcentaje de devolucion', 'plata de vuelta'],
    keywords: ['cashback', 'devolucion', 'devolver', 'reintegro'],
    extra: ['porcentaje', 'adheridos', 'combustible', 'gastronomia'],
    answers: () => [
      'Cashback en adheridos: 8% en mercadoMONIX, 5% en Estaciones Full, 4% en shoppings partners y 3% en Restós MONIX. En Cashback simulás cuánto te devolverían.',
      'La devolución se calcula sobre el monto de la compra en comercios del programa. mercadoMONIX es el que más rinde (8%).',
    ],
  },
  {
    id: 'financiacion',
    href: '/financiacion',
    hrefLabel: 'Simular cuotas',
    phrases: ['pagar en cuotas', 'sin interes', 'financiar compra', 'plan de cuotas'],
    keywords: ['cuota', 'cuotas', 'financiar', 'financiacion', 'plan'],
    extra: ['tasa', 'mensual'],
    answers: () => [
      'Planes de financiación: 3 cuotas sin interés hasta $50.000; 6 cuotas al 2,5% mensual (hasta $250.000); 12 cuotas al 3,2% mensual (hasta $800.000). Simulás la cuota en Financiación.',
      'No es un préstamo personal: es para financiar un monto. El préstamo (plata en tu caja, con TNA según BCRA) está en Préstamos.',
    ],
  },
  {
    id: 'mercado',
    href: '/mercado-monix',
    hrefLabel: 'Entrar a mercadoMONIX',
    phrases: ['comprar online', 'envio full', 'tienda monix', 'marketplace'],
    keywords: ['mercado', 'mercadomonix', 'tienda', 'shopping', 'producto', 'catalogo'],
    extra: ['tecnologia', 'moda', 'hogar', 'gaming', 'envio'],
    weak: ['comprar'],
    answers: () => [
      'mercadoMONIX es la tienda de la app: tecnología, moda, hogar, deportes, belleza, gaming y automotriz. Pagás con tu saldo en pesos. Muchos tienen envío gratis y cuotas.',
      'Buscás, filtrás por categoría y comprás. Se debita tu caja en pesos y queda el movimiento. El banner del Inicio te lleva ahí.',
      'En mercadoMONIX el cashback es 8%. Si no te alcanza el saldo, depositá o usá un préstamo antes de comprar.',
    ],
  },
  {
    id: 'cuentas',
    href: '/cuentas',
    hrefLabel: 'Ver cuentas',
    phrases: ['mis cuentas', 'caja de ahorro', 'cuenta en pesos', 'ver cajas'],
    keywords: ['cuentas', 'cajas'],
    extra: ['ars', 'pesos', 'titular'],
    weak: ['cuenta'],
    answers: () => [
      'Al registrarte se abre una caja de ahorro en pesos, con CBU y alias. En Cuentas ves saldos y datos de cada caja, incluida la de dólares si la pediste.',
      'Cada cuenta tiene su CBU y alias. La de pesos es la que usa transferencias, QR, reservas y préstamos. La de USD es para compra/venta y débito en dólares.',
    ],
  },
  {
    id: 'cuenta_usd',
    href: '/cuentas',
    hrefLabel: 'Abrir cuenta USD',
    phrases: ['cuenta en dolares', 'abrir dolares', 'caja usd', 'abrir usd'],
    keywords: ['usd'],
    extra: ['abrir', 'solicitar', 'segunda'],
    answers: () => [
      'La caja en dólares se pide en Cuentas, sin mirar tu situación crediticia. Después podés comprar/vender USD y ver la débito en dólares.',
      'No hace falta ser cliente “sueldo” ni tener préstamo. En Cuentas → solicitar cuenta USD. El CBU/alias de esa caja es distinto al de pesos.',
    ],
  },
  {
    id: 'prestamos',
    href: '/prestamos',
    hrefLabel: 'Ir a Préstamos',
    phrases: ['pedir prestamo', 'credito personal', 'simular prestamo', 'cuanto me prestan', 'tasa del prestamo'],
    keywords: ['prestamo', 'prestamos', 'credito', 'desembolso'],
    extra: ['frances', 'tna', 'bcra', 'situacion', 'cuotas', 'ingreso', 'sueldo', 'deudores', 'mora', 'prestan'],
    answers: () => [
      'En Préstamos simulás el monto y las cuotas (3 a 24, según tu situación). Antes, en Perfil, declarás el ingreso mensual. Si da ok, el desembolso cae en tu caja en pesos.',
      'Es un préstamo personal en pesos, cuota fija (sistema francés). La TNA parte de 85% y se ajusta por tu situación en la Central de Deudores (1 a 5). Situación 1: hasta $8.000.000 en 24 cuotas.',
      'Si cobrás el sueldo en Monix (lo marcás en Perfil) hay 12 puntos menos de TNA y 50% más de tope. Situación 5 (irrecuperable) no habilita préstamo nuevo. Las cuotas se debitan solas cada mes. La cuota no puede pasar el 30% del ingreso (35% con sueldo en Monix).',
    ],
  },
  {
    id: 'sueldo',
    href: '/perfil',
    hrefLabel: 'Ir a Perfil',
    phrases: ['cobro el sueldo', 'acreditar sueldo', 'paquete sueldo', 'bonificacion sueldo', 'sueldo en monix'],
    keywords: ['haberes', 'nomina'],
    extra: ['acreditar', 'ingreso', 'declarar', 'cobro'],
    answers: () => [
      'En Perfil está “Cobro mi sueldo en Monix” y el ingreso mensual. Eso mejora el préstamo: más monto, mejor tasa y la cuota puede llegar al 35% del ingreso.',
      'El sueldo acreditado no abre productos extra por sí solo: cambia las condiciones de Préstamos. El ingreso declarado es obligatorio para solicitar uno.',
    ],
  },
  {
    id: 'perfil',
    href: '/perfil',
    hrefLabel: 'Ir a Perfil',
    phrases: ['cambiar alias', 'cambiar contrasena', 'editar perfil', 'cambiar foto', 'mis datos'],
    keywords: ['perfil', 'email', 'telefono', 'contrasena', 'password', 'clave', 'foto', 'avatar'],
    extra: ['editar', 'mail', 'celular'],
    answers: () => [
      'En Perfil editás email, teléfono, foto (hasta 2 MB), alias, contraseña, ingreso mensual y si cobrás el sueldo acá.',
      'El alias se valida para que no esté repetido. La contraseña nueva pide la actual. La foto queda en este dispositivo.',
    ],
  },
  {
    id: 'huella',
    href: '/perfil',
    hrefLabel: 'Activar huella',
    phrases: ['activar huella', 'desbloqueo biometrico', 'face id', 'huella digital'],
    keywords: ['huella', 'biometria', 'fingerprint', 'biometrica', 'face'],
    extra: ['lock', 'desbloqueo', 'dedo'],
    answers: () => [
      'En Perfil activás el desbloqueo con huella (o biometría del celular). Al volver a la app te pide validar; si falla, usás la contraseña.',
      'La huella no reemplaza el login: protege la sesión ya abierta en este dispositivo. Se prende y se apaga desde Perfil.',
    ],
  },
  {
    id: 'seguridad',
    href: '/tarjeta',
    hrefLabel: 'Congelar tarjeta',
    phrases: ['es seguro', 'proteger cuenta', 'privacidad de datos', 'me hackearon'],
    keywords: ['seguro', 'seguridad', 'privacidad', 'proteger', 'phishing', 'estafa'],
    extra: ['clave', 'cvv', 'sesion'],
    answers: () => [
      'No compartas CBU completo, CVV ni la clave. Monix nunca te los pide por chat. Si algo raro: cambiá la contraseña en Perfil y congelá la tarjeta.',
      'La sesión está protegida; en el celular podés sumar huella. Cerrá sesión desde el menú si el teléfono no es tuyo.',
    ],
  },
  {
    id: 'tema',
    phrases: ['modo oscuro', 'modo claro', 'cambiar tema', 'dark mode'],
    keywords: ['oscuro', 'claro', 'tema', 'dark', 'luna', 'sol'],
    extra: ['apariencia', 'night'],
    weak: ['modo'],
    answers: () => [
      'El interruptor de sol/luna está arriba a la derecha, junto a las notificaciones. El tema queda guardado.',
      'Modo claro u oscuro: ícono del sol o la luna en el header. No afecta saldos ni operaciones.',
    ],
  },
  {
    id: 'costos',
    phrases: ['hay comisiones', 'cuanto cuesta', 'es gratis', 'gastos de mantenimiento', 'cobra algo'],
    keywords: ['comision', 'comisiones', 'gratis', 'costo', 'costos', 'mantenimiento', 'cargo'],
    extra: ['precio', 'tarifa', 'arancel'],
    answers: () => [
      'Abrir la cuenta, transferir, depositar, QR, Cerca y el débito no tienen comisión en Monix. El costo aparece en productos con tasa: Reservas rinde (TNA 32%); préstamos y financiación sí tienen interés.',
      'No hay mantenimiento ni comisión por transferencia. Comprar dólares usa la diferencia compra/venta de la cotización oficial. El préstamo tiene TNA según tu situación BCRA.',
    ],
  },
  {
    id: 'horarios',
    phrases: ['las 24 horas', 'hasta que hora', 'fines de semana', 'feriados', 'cuando opera'],
    keywords: ['horario', 'horarios', '24', 'inmediato', 'instante', 'feriado'],
    extra: ['sabado', 'domingo', 'noche'],
    answers: () => [
      'Transferencias, depósitos, QR, dólares y reservas operan las 24 hs, todos los días. No hay cutoff de “horario bancario”.',
      'Podés mover plata de madrugada o el domingo. Las cuotas del préstamo se debitan según la fecha, no según si es hábil.',
    ],
  },
  {
    id: 'bono',
    href: '/dashboard',
    hrefLabel: 'Ir a Inicio',
    phrases: ['bono de bienvenida', 'regalo al registrarme', 'plata inicial'],
    keywords: ['bono', 'bienvenida', 'regalo', 'obsequio'],
    extra: ['150000', 'nuevo'],
    answers: () => [
      'Al registrarte por primera vez hay un bono de bienvenida de $150.000 acreditado en tu caja en pesos. Lo ves en Inicio.',
      'El bono es de $150.000 y aparece al crear la cuenta. No es un préstamo: es saldo para operar.',
    ],
  },
  {
    id: 'notificaciones',
    phrases: ['avisos de transferencia', 'campanita', 'me avisa cuando'],
    keywords: ['notificacion', 'notificaciones', 'aviso', 'alertas', 'campana'],
    extra: ['toast', 'badge', 'entrante'],
    answers: () => [
      'La campanita del header avisa depósitos y transferencias entrantes, con badge si hay sin leer. También sale un toast al momento.',
      'Las notificaciones son de movimientos de tu cuenta. No reemplazan el mail: mirá la campana cuando operes.',
    ],
  },
  {
    id: 'app',
    phrases: ['hay aplicacion', 'instalar android', 'apk monix', 'funciona en el celular'],
    keywords: ['app', 'apk', 'android', 'ios', 'iphone', 'celular', 'aplicacion'],
    extra: ['nativa', 'capacitor', 'bluetooth'],
    answers: () => [
      'Monix corre en el navegador y como app Android. En el teléfono tenés NFC, huella y Monix Cerca por Bluetooth de fondo. En iPhone el contactless se resuelve con QR de la tarjeta.',
      'Si querés Cerca en segundo plano y grabar el sticker NFC, usá la APK. En la web igual transferís, pagás con QR y ves el banco completo.',
    ],
  },
  {
    id: 'registro',
    phrases: ['crear cuenta', 'como me registro', 'abrir cuenta monix'],
    keywords: ['registro', 'registrarme', 'alta', 'dni'],
    extra: ['nombre', 'apellido', 'email', 'nacimiento'],
    answers: () => [
      'En Registrarme cargás nombre, apellido, DNI, email, teléfono, dirección, fecha de nacimiento y una clave de al menos 6 caracteres. Se abre la caja en pesos y llega el bono de $150.000.',
      'Hace falta un email real para el acceso. El DNI se usa también para consultar tu situación crediticia si pedís un préstamo.',
    ],
  },
  {
    id: 'login',
    phrases: ['iniciar sesion', 'entrar a la cuenta', 'recordarme', 'olvide la clave', 'olvide mi contrasena', 'recuperar contrasena'],
    keywords: ['login', 'ingresar', 'sesion', 'entrar'],
    extra: ['remember', 'acceso'],
    answers: () => [
      'En Iniciar sesión usás el email y la contraseña. Si olvidaste la clave y ya estás adentro, cambiala en Perfil (pide la actual). Desde afuera no hay recupero por mail.',
      'Podés marcar recordar datos en este dispositivo. Si ya hay sesión, vas directo a Inicio.',
    ],
  },
  {
    id: 'cajero',
    href: '/tarjeta',
    hrefLabel: 'Ver tarjeta',
    phrases: ['sacar plata', 'extraer efectivo', 'cajero automatico', 'retiro en efectivo'],
    keywords: ['cajero', 'efectivo', 'extraccion', 'atm', 'billete'],
    extra: ['retiro', 'sucursal'],
    answers: () => [
      'Desde la app no hay “extraer efectivo”. Para sacar plata de Reservas, usá Reservas → retirar (vuelve a tu saldo). El débito informa un tope de cajero de $80.000 diarios.',
      'Monix no tiene sucursales. Movés el dinero por transferencia, QR o débito. Si necesitás efectivo, transferí a una cuenta con la que puedas extraer.',
    ],
  },
  {
    id: 'no_tiene',
    phrases: ['transferencia internacional', 'cuenta corriente', 'tarjeta de credito', 'cheques', 'inversiones bolsa', 'acciones', 'plazo fijo uva', 'sucursal fisica'],
    keywords: ['swift', 'western', 'cheque', 'cheques', 'bolsa', 'acciones', 'uva', 'sucursal', 'internacional'],
    extra: ['exterior', 'internacional', 'broker'],
    answers: () => [
      'Monix no tiene sucursal, cheques, cuenta corriente, tarjeta de crédito ni transferencias al exterior (SWIFT). Sí: caja de ahorro, débito, transferencias CBU/alias 24 hs, préstamos personales, reservas, QR y dólar oficial.',
      'Si buscás crédito, el producto es Préstamos (plata en tu caja) o Financiación (cuotas). La tarjeta Monix es débito. El “plazo fijo” más parecido es Reservas: rendís y podés retirar cuando quieras.',
    ],
  },
  {
    id: 'soporte',
    phrases: ['hablar con alguien', 'atencion al cliente', 'telefono del banco', 'reclamo'],
    keywords: ['soporte', 'reclamo', 'atencion', 'humano'],
    extra: ['whatsapp', 'mail', 'contacto'],
    answers: () => [
      'Soy Moni, el canal de consultas de la app. Para operaciones: usá Historial, congelá la tarjeta o cambiá la clave en Perfil. No hay sucursal ni línea telefónica de este homebanking.',
      'Si es un movimiento que no reconocés: Historial + congelar débito. Si es cómo usar un producto, preguntame por el nombre (préstamo, QR, Cerca, etc.).',
    ],
  },
]
