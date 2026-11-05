import type { AsistenteCtx, AsistenteReply, MovimientoCtx, PrestamoCtx } from './asistenteConocimiento'

// Preguntas sobre los datos de la persona ("¿cuánto tengo en Reservas?", "¿cuándo vence mi cuota?").
// Va antes de los temas fijos de asistenteConocimiento: si reconoce la intención y tiene el dato,
// contesta con el número en una línea; si no la reconoce, devuelve null y siguen los temas.
// Moni es de solo lectura: nada de acá escribe ni mueve plata.

export function normalizar(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const FMT_ARS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })
const FMT_USD = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pesos = (n: number) => FMT_ARS.format(n)
const dolares = (n: number) => `US$${FMT_USD.format(n)}`
const plata = (n: number, moneda: 'ARS' | 'USD') => (moneda === 'USD' ? dolares(n) : pesos(n))

const RE = {
  reserva: /\breservas?\b|\bbolsillo\b|\bapartad[oa]s?\b|\bahorr(?:o|os|ado|ados)\b/,
  usd: /\b(?:dolar|dolares|usd|verdes)\b/,
  pesos: /\b(?:pesos|ars)\b/,
  prestamo: /\bprestamos?\b|\bprestan\b|\bprestar\b|\bprestame\b|\bcuotas?\b|\bdeuda\b|\bdebo\b|\badeudo\b|\bcredito\b/,
  meta: /\bmetas?\b|\bpool\b|\bfondo grupal\b/,
  tarjeta: /\btarjetas?\b|\bdebito\b/,
  cantidad: /\b(?:cuanto|cuanta|cuantos|cuantas|saldo|tengo|tenemos|hay|queda|quedan|total|disponible|monto)\b/,
  personal: /\b(?:mi|mis|me|tengo|debo|pago|pague|llevo|tenemos)\b|\bla cuota\b/,
  rinde: /\b(?:rind\w*|rendimiento\w*|gane|ganando|ganancia\w*|interes\w*|genera\w*|tna|tasa)\b/,
  cuando: /\b(?:cuando|proxima|proximo|vence|vencen|vencimiento|fecha)\b/,
  ultimo: /\b(?:ultim[oa]s?|reciente|recientes)\b/,
  entrada:
    /\b(?:recibi|recibido|recibio|ingreso|ingresos|ingresaron|cobre|cobrado|entro|entraron|acreditaron|llego|llegaron)\b|\bme (?:mandaron|transfirieron|depositaron|enviaron|pagaron)\b/,
  salida:
    /\b(?:transferi|transferido|mande|mandado|envie|enviado|enviaste|pague|pagado|salio|salieron|retire|extraje)\b|\b(?:transferencias?|pagos?|envios?) (?:hice|envie|mande)\b/,
  movimiento: /\b(?:movimientos?|operacion|operaciones|transaccion|transacciones|actividad)\b/,
  transferencia: /\btransferencias?\b/,
  deposito: /\bdepositos?\b/,
  cotizacion:
    /\b(?:cotiza\w*|precio|vale|valen|valor|oficial|compra|venta|hoy|sale|salen|cuesta|cuestan|esta|vend\w*|recibir\w*)\b|\ba cuanto\b/,
  explicacion:
    /^(?:como|donde|que es|que son|para que|por que|se puede|que significa|cual es la diferencia|quien)\b/,
  congelada: /\b(?:congelad[oa]|bloquead[oa]|activ[oa]|habilitad[oa]|funciona)\b/,
  total: /\b(?:en total|total|patrimonio|entre todo|todo junto|todo lo que tengo)\b/,
  debo: /\b(?:debo|deuda|adeudo|adeudado)\b/,
  faltan: /\b(?:falta|faltan|quedan|restan|me quedan)\b/,
  oferta:
    /\b(?:prestan|prestar|pedir|aprueban|maximo|puedo pedir|me dan)\b|\bhasta cuanto\b/,
}

const MOTIVOS_INTERNOS = new Set(['Reserva', 'Meta común', 'Compra de USD', 'Venta de USD'])
const ESPERA = 'Estoy trayendo ese dato. Probá de nuevo en un momento'

const has = (re: RegExp, q: string) => re.test(q)
const reply = (text: string, kind: string, href?: string, hrefLabel?: string): AsistenteReply => ({
  text,
  href,
  hrefLabel,
  topicId: `consulta:${kind}`,
})

function esperando(href: string, label: string, kind: string): AsistenteReply {
  return reply(`${ESPERA} o mirá ${label.toLowerCase()}.`, kind, href, label)
}

function diaCorto(iso: string, ahora: Date) {
  const f = new Date(iso)
  const dias = Math.round((inicioDia(ahora) - inicioDia(f)) / 86_400_000)
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'ayer'
  const base = f.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
  return `el ${base}`
}

function inicioDia(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function vencimiento(iso: string, ahora: Date) {
  const f = new Date(iso)
  const dias = Math.round((inicioDia(f) - inicioDia(ahora)) / 86_400_000)
  const base = f.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
  if (dias < 0) return `el ${base} (ya pasó la fecha)`
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'mañana'
  return `el ${base} (en ${dias} días)`
}

// ── Período ────────────────────────────────────────────────────────────────

interface Periodo {
  desde: number
  hasta: number
  nombre: string
}

function periodoDe(q: string, ahora: Date): Periodo {
  const hoy = inicioDia(ahora)
  if (/\bhoy\b/.test(q)) return { desde: hoy, hasta: hoy + 86_400_000, nombre: 'hoy' }
  if (/\b(?:ayer)\b/.test(q)) return { desde: hoy - 86_400_000, hasta: hoy, nombre: 'ayer' }
  if (/\bsemana\b/.test(q)) return { desde: hoy - 6 * 86_400_000, hasta: hoy + 86_400_000, nombre: 'en los últimos 7 días' }
  if (/mes pasado|mes anterior/.test(q)) {
    return {
      desde: new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1).getTime(),
      hasta: new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime(),
      nombre: 'el mes pasado',
    }
  }
  return {
    desde: new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime(),
    hasta: new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1).getTime(),
    nombre: 'este mes',
  }
}

// ── Movimientos ────────────────────────────────────────────────────────────

const esEntrada = (m: MovimientoCtx) => m.tipo === 'deposito' || m.tipo === 'transferencia_entrada'
const esRendimiento = (m: MovimientoCtx) => m.motivo.startsWith('Rendimiento')
const esInterno = (m: MovimientoCtx) => MOTIVOS_INTERNOS.has(m.motivo)

function contraparteMencionada(q: string, movs: MovimientoCtx[]): string | null {
  const nombres = new Set(movs.map((m) => m.contraparte).filter((n): n is string => Boolean(n)))
  for (const nombre of nombres) {
    const partes = normalizar(nombre).split(' ').filter((t) => t.length >= 3)
    if (partes.some((t) => new RegExp(`(?:^|\\s)${t}(?:$|\\s)`).test(q))) return nombre
  }
  return null
}

function describir(m: MovimientoCtx, ahora: Date) {
  const monto = plata(m.monto, m.moneda)
  const cuando = diaCorto(m.fecha, ahora)
  const de = m.contraparte
  if (esRendimiento(m)) return `el rendimiento de Reservas, ${monto}, ${cuando}`
  if (m.tipo === 'transferencia_entrada') return `una transferencia recibida${de ? ` de ${de}` : ''} por ${monto}, ${cuando}`
  if (m.tipo === 'transferencia_salida') return `una transferencia${de ? ` a ${de}` : ''} por ${monto}, ${cuando}`
  if (m.tipo === 'deposito') return `un depósito de ${monto}, ${cuando}`
  return `un pago por ${monto}${m.motivo ? ` (${m.motivo})` : ''}, ${cuando}`
}

function reglaMovimientos(q: string, ctx: AsistenteCtx, ahora: Date): AsistenteReply | null {
  const entrada = has(RE.entrada, q)
  const salida = has(RE.salida, q)
  const generico = has(RE.movimiento, q) || has(RE.transferencia, q) || has(RE.deposito, q)
  if (!entrada && !salida && !generico) return null
  const ultimo = has(RE.ultimo, q)
  const cuenta = has(RE.cantidad, q) || /\bcuantas veces\b/.test(q)
  if (!ultimo && !cuenta) return null
  if (!ctx.movimientos) return esperando('/historial', 'Ir a Historial', 'mov')

  const moneda: 'ARS' | 'USD' = has(RE.usd, q) ? 'USD' : 'ARS'
  const quien = contraparteMencionada(q, ctx.movimientos)
  const soloTransf = has(RE.transferencia, q)
  const soloDep = has(RE.deposito, q) && !soloTransf

  const lista = ctx.movimientos.filter((m) => {
    if (m.moneda !== moneda) return false
    if (quien && m.contraparte !== quien) return false
    if (entrada && !salida && !esEntrada(m)) return false
    if (salida && !entrada && esEntrada(m)) return false
    if (soloTransf && !m.tipo.startsWith('transferencia')) return false
    if (soloDep && m.tipo !== 'deposito') return false
    return true
  })

  if (ultimo) {
    const filtrando = entrada || salida || soloTransf || soloDep || quien != null
    const m = lista.find((x) => !filtrando || !esInterno(x))
    if (!m) return reply('No encuentro movimientos así en tu historial reciente.', 'ultimo', '/historial', 'Ir a Historial')
    return reply(`Tu último movimiento${filtrando ? ' de ese tipo' : ''} fue ${describir(m, ahora)}.`, 'ultimo', '/historial', 'Ir a Historial')
  }

  const periodo = periodoDe(q, ahora)
  const enPeriodo = lista.filter((m) => {
    const t = new Date(m.fecha).getTime()
    return t >= periodo.desde && t < periodo.hasta && !esInterno(m) && !esRendimiento(m)
  })
  const verbo = entrada && !salida ? 'Recibiste' : salida && !entrada ? 'Enviaste' : 'Moviste'
  const kind = entrada && !salida ? 'recibido' : salida && !entrada ? 'enviado' : 'movido'
  const sust = soloTransf ? { singular: 'transferencia', plural: 'transferencias' } : soloDep ? { singular: 'depósito', plural: 'depósitos' } : { singular: 'movimiento', plural: 'movimientos' }

  if (/\bcuantas?\b|\bcuantos\b/.test(q) && !/\bcuanto\b/.test(q)) {
    const n = enPeriodo.length
    return reply(
      n === 0 ? `No registro ${sust.plural} así ${periodo.nombre}.` : `${n} ${n === 1 ? sust.singular : sust.plural} ${periodo.nombre}.`,
      kind, '/historial', 'Ir a Historial',
    )
  }

  if (enPeriodo.length === 0) {
    return reply(`No registro movimientos así ${periodo.nombre}${quien ? ` con ${quien}` : ''}.`, kind, '/historial', 'Ir a Historial')
  }
  const total = enPeriodo.reduce((s, m) => s + m.monto, 0)
  const n = enPeriodo.length
  return reply(
    `${verbo} ${plata(total, moneda)} ${periodo.nombre}${quien ? ` con ${quien}` : ''} (${n} ${n === 1 ? sust.singular : sust.plural}).`,
    kind, '/historial', 'Ir a Historial',
  )
}

// ── Reservas, saldos y dólares ─────────────────────────────────────────────

function rendimientoDelMes(ctx: AsistenteCtx, ahora: Date) {
  const desde = new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime()
  return (ctx.movimientos ?? [])
    .filter((m) => m.moneda === 'ARS' && esRendimiento(m) && new Date(m.fecha).getTime() >= desde)
    .reduce((s, m) => s + m.monto, 0)
}

function lineaReserva(ctx: AsistenteCtx) {
  const saldo = ctx.saldoReserva ?? 0
  if (saldo <= 0) return 'Todavía no tenés plata en Reservas.'
  const tasa = ctx.tasaReserva != null ? ` (TNA ${ctx.tasaReserva}%)` : ''
  return `Tenés ${pesos(saldo)} en Reservas${tasa}.`
}

function reglaReserva(q: string, ctx: AsistenteCtx, ahora: Date): AsistenteReply | null {
  const pideRinde = has(RE.rinde, q)
  if (ctx.saldoReserva === undefined) return esperando('/reservas', 'Ir a Reservas', 'reserva')
  const saldo = ctx.saldoReserva ?? 0

  if (pideRinde) {
    const tasa = ctx.tasaReserva ?? null
    if (saldo <= 0) {
      return reply(`Reservas rinde${tasa != null ? ` TNA ${tasa}%` : ''}, interés diario compuesto. Todavía no tenés plata ahí: ingresá desde Reservas y empieza a rendir.`, 'reserva', '/reservas', 'Ir a Reservas')
    }
    const diario = ctx.interesDiarioReserva
    const mes = rendimientoDelMes(ctx, ahora)
    const partes = [
      `Con ${pesos(saldo)} en Reservas${tasa != null ? ` (TNA ${tasa}%)` : ''} ganás ${diario != null ? `unos ${pesos(diario)} por día` : 'interés todos los días'}.`,
      mes > 0 ? `Este mes te acreditaron ${pesos(mes)} de rendimiento.` : '',
    ].filter(Boolean)
    return reply(partes.join(' '), 'reserva', '/reservas', 'Ir a Reservas')
  }

  const diario = ctx.interesDiarioReserva
  const extra = saldo > 0 && diario != null ? ` Rinde unos ${pesos(diario)} por día.` : ''
  return reply(`${lineaReserva(ctx)}${extra}`, 'reserva', '/reservas', 'Ir a Reservas')
}

function lineaUsd(ctx: AsistenteCtx) {
  if (!ctx.tieneUsd) return 'Todavía no abriste tu caja en dólares: la pedís en Cuentas.'
  const usd = ctx.saldoUSD ?? 0
  const eq = ctx.dolarOficial && usd > 0 ? ` Al oficial de hoy, vendidos serían unos ${pesos(usd * ctx.dolarOficial.compra)}.` : ''
  return `Tenés ${dolares(usd)} en dólares.${eq}`
}

function lineaPesos(ctx: AsistenteCtx) {
  return ctx.saldoARS == null ? null : `Tenés ${pesos(ctx.saldoARS)} disponibles en pesos.`
}

function reglaSaldos(q: string, ctx: AsistenteCtx, ahora: Date): AsistenteReply | null {
  const reserva = has(RE.reserva, q)
  const usd = has(RE.usd, q)
  const enPesos = has(RE.pesos, q)
  const total = has(RE.total, q)

  if (total && !(reserva && !usd)) {
    if (ctx.saldoARS == null) return esperando('/dashboard', 'Ir a Inicio', 'saldo')
    const enRes = ctx.saldoReserva ?? 0
    const suma = ctx.saldoARS + enRes
    const partes = [
      enRes > 0
        ? `En total tenés ${pesos(suma)} en pesos: ${pesos(ctx.saldoARS)} disponibles y ${pesos(enRes)} en Reservas.`
        : `En total tenés ${pesos(ctx.saldoARS)} en pesos.`,
      ctx.tieneUsd && (ctx.saldoUSD ?? 0) > 0 ? `Además, ${dolares(ctx.saldoUSD ?? 0)} en dólares.` : '',
    ].filter(Boolean)
    return reply(partes.join(' '), 'saldo', '/dashboard', 'Ver en Inicio')
  }

  if ((reserva || usd || enPesos) && has(RE.cantidad, q)) {
    if (reserva && !usd && !enPesos) return reglaReserva(q, ctx, ahora)
    const lineas: string[] = []
    if (enPesos || (!reserva && !usd)) {
      const p = lineaPesos(ctx)
      if (p) lineas.push(p)
    }
    if (reserva) {
      if (ctx.saldoReserva === undefined) return esperando('/reservas', 'Ir a Reservas', 'reserva')
      lineas.push(lineaReserva(ctx))
    }
    if (usd) lineas.push(lineaUsd(ctx))
    if (lineas.length === 0) return esperando('/dashboard', 'Ir a Inicio', 'saldo')
    return reply(lineas.join(' '), usd && !reserva && !enPesos ? 'usd' : 'saldo', usd ? '/cuentas' : '/dashboard', usd ? 'Ver cuentas' : 'Ver en Inicio')
  }
  return null
}

function reglaSaldoGeneral(q: string, ctx: AsistenteCtx): AsistenteReply | null {
  if (/\b(?:sueldo|cobro|acreditar|acreditado|alias|cbu|cvu|prestamo|promo|cashback)\b/.test(q)) return null
  const pregunta =
    /\bsaldo\b/.test(q) ||
    /\bcuanto (?:tengo|hay|me queda|dinero|plata|disponible)\b/.test(q) ||
    /\bcuanta (?:plata|guita|lana) (?:tengo|hay|me queda|disponible)\b/.test(q) ||
    /\b(?:plata|dinero) disponible\b/.test(q)
  if (!pregunta) return null
  if (ctx.saldoARS == null) return esperando('/dashboard', 'Ir a Inicio', 'saldo')
  const partes = [`Tenés ${pesos(ctx.saldoARS)} disponibles en pesos.`]
  if ((ctx.saldoReserva ?? 0) > 0) partes.push(`Más ${pesos(ctx.saldoReserva ?? 0)} en Reservas.`)
  if (ctx.tieneUsd && ctx.saldoUSD != null) partes.push(`Y ${dolares(ctx.saldoUSD)} en dólares.`)
  return reply(partes.join(' '), 'saldo', '/dashboard', 'Ver en Inicio')
}

// ── Cotización ─────────────────────────────────────────────────────────────

function numeroEn(q: string): number | null {
  const m = q.match(/\b\d+(?: \d{3})*\b/)
  if (!m) return null
  const n = Number(m[0].replace(/ /g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

function reglaCotizacion(q: string, ctx: AsistenteCtx): AsistenteReply | null {
  if (!has(RE.usd, q) || !has(RE.cotizacion, q)) return null
  if (/\b(?:tengo|mi saldo|mis dolares|cuanto (?:hay|queda))\b/.test(q)) return null
  const d = ctx.dolarOficial
  if (!d) {
    return reply('No pude traer la cotización ahora. La ves en vivo en Dólares.', 'cotizacion', '/dolares', 'Ir a Dólares')
  }
  const n = numeroEn(q)
  if (n != null) {
    const vende = /\b(?:vend\w*|recibo|me dan|me pagan)\b/.test(q)
    return reply(
      vende
        ? `Vendiendo ${dolares(n)} recibís ${pesos(n * d.compra)} (oficial a ${pesos(d.compra)}).`
        : `Comprar ${dolares(n)} te cuesta ${pesos(n * d.venta)} (oficial a ${pesos(d.venta)}).`,
      'cotizacion', '/dolares', 'Ir a Dólares',
    )
  }
  return reply(`Dólar oficial hoy: comprás a ${pesos(d.venta)} y vendés a ${pesos(d.compra)}.`, 'cotizacion', '/dolares', 'Ir a Dólares')
}

// ── Préstamos ──────────────────────────────────────────────────────────────

function lineaOferta(ctx: AsistenteCtx) {
  const o = ctx.oferta
  if (!o || o.montoMax <= 0) return ''
  return `Podés pedir hasta ${pesos(o.montoMax)} en hasta ${o.cuotasMax} cuotas, con TNA ${o.tna}%.`
}

function reglaPrestamos(q: string, ctx: AsistenteCtx, ahora: Date): AsistenteReply | null {
  if (!has(RE.prestamo, q) || !has(RE.personal, q)) return null
  const quiereOferta = has(RE.oferta, q) && !has(RE.debo, q)
  if (quiereOferta) {
    const o = lineaOferta(ctx)
    return reply(o || 'Tu oferta la ves al simular en Préstamos: depende de tu ingreso y tu situación.', 'prestamo', '/prestamos', 'Ir a Préstamos')
  }
  const pidePorMes = has(RE.cantidad, q) || has(RE.cuando, q) || has(RE.debo, q) || has(RE.faltan, q) || /\b(?:pago|cuota|tengo)\b/.test(q)
  if (!pidePorMes) return null
  if (!ctx.prestamos) return esperando('/prestamos', 'Ir a Préstamos', 'prestamo')

  const activos = ctx.prestamos.filter((p) => p.estado === 'activo')
  if (activos.length === 0) {
    const o = lineaOferta(ctx)
    return reply(`No tenés préstamos activos.${o ? ` ${o}` : ''}`, 'prestamo', '/prestamos', 'Ir a Préstamos')
  }
  return reply(detallePrestamos(q, activos, ahora), 'prestamo', '/prestamos', 'Ir a Préstamos')
}

function detallePrestamos(q: string, activos: PrestamoCtx[], ahora: Date) {
  const restantes = (p: PrestamoCtx) => p.cuotasTotales - p.cuotasPagadas
  const cuotasQueFaltan = activos.reduce((s, p) => s + restantes(p), 0)
  const porPagar = activos.reduce((s, p) => s + restantes(p) * p.cuotaMonto, 0)
  const mensual = activos.reduce((s, p) => s + p.cuotaMonto, 0)
  const proxima = [...activos].sort((a, b) => a.proximaCuota.localeCompare(b.proximaCuota))[0]
  const varios = activos.length > 1
  const sujeto = varios ? `Entre tus ${activos.length} préstamos` : 'En tu préstamo'

  if (has(RE.cuando, q)) {
    return `Tu próxima cuota${varios ? ' (la más cercana)' : ''} es de ${pesos(proxima.cuotaMonto)} y vence ${vencimiento(proxima.proximaCuota, ahora)}.`
  }
  if (has(RE.debo, q)) {
    return `${sujeto} te faltan pagar ${pesos(porPagar)} en ${cuotasQueFaltan} ${cuotasQueFaltan === 1 ? 'cuota' : 'cuotas'}.`
  }
  if (has(RE.faltan, q) || /\bcuantas cuotas\b/.test(q)) {
    return varios
      ? `${sujeto} te faltan ${cuotasQueFaltan} cuotas.`
      : `Te faltan ${restantes(activos[0])} de ${activos[0].cuotasTotales} cuotas (pagaste ${activos[0].cuotasPagadas}).`
  }
  if (/\b(?:cuota|pago por mes|por mes|mensual)\b/.test(q) && has(RE.cantidad, q)) {
    return `${varios ? 'Pagás' : 'Tu cuota es de'} ${pesos(mensual)} por mes${varios ? ` entre ${activos.length} préstamos` : ''}.`
  }
  return `Tenés ${varios ? `${activos.length} préstamos activos` : '1 préstamo activo'}: pagás ${pesos(mensual)} por mes y te faltan ${cuotasQueFaltan} cuotas. Próxima cuota ${vencimiento(proxima.proximaCuota, ahora)}.`
}

// ── Metas comunes ──────────────────────────────────────────────────────────

function reglaMetas(q: string, ctx: AsistenteCtx): AsistenteReply | null {
  if (!has(RE.meta, q) || !has(RE.personal, q)) return null
  if (!(has(RE.cantidad, q) || /\b(?:falta|faltan|aporte|junte|juntamos|estoy|mis metas|mi meta)\b/.test(q))) return null
  if (ctx.metas === undefined) return esperando('/metas', 'Abrir Metas comunes', 'meta')
  const abiertas = (ctx.metas ?? []).filter((m) => m.estado !== 'desembolsada')
  if (abiertas.length === 0) {
    return reply('No estás en ninguna meta común activa. Podés crear una o sumarte con un código en Metas comunes.', 'meta', '/metas', 'Abrir Metas comunes')
  }
  if (abiertas.length === 1) {
    const m = abiertas[0]
    const falta = m.objetivo != null ? Math.max(m.objetivo - m.saldo, 0) : null
    const objetivo = m.objetivo != null ? ` de ${pesos(m.objetivo)}${falta ? ` (faltan ${pesos(falta)})` : ' (¡objetivo cumplido!)'}` : ''
    return reply(`En «${m.titulo}» el grupo juntó ${pesos(m.saldo)}${objetivo}. Vos aportaste ${pesos(m.miAporte)}.`, 'meta', '/metas', 'Abrir Metas comunes')
  }
  const aportado = abiertas.reduce((s, m) => s + m.miAporte, 0)
  const lista = abiertas.slice(0, 3).map((m) => `«${m.titulo}» ${pesos(m.saldo)}`).join(', ')
  return reply(`Estás en ${abiertas.length} metas comunes y aportaste ${pesos(aportado)} en total. Pool de cada una: ${lista}${abiertas.length > 3 ? '…' : ''}.`, 'meta', '/metas', 'Abrir Metas comunes')
}

// ── Tarjeta ────────────────────────────────────────────────────────────────

function reglaTarjeta(q: string, ctx: AsistenteCtx): AsistenteReply | null {
  if (!has(RE.tarjeta, q) || !has(RE.congelada, q)) return null
  if (/\b(?:como|donde)\b/.test(q)) return null
  if (ctx.tarjetaCongelada === undefined) return null
  return reply(
    ctx.tarjetaCongelada
      ? 'Tu tarjeta de débito está congelada: no autoriza compras. La descongelás en Mis Tarjetas.'
      : 'Tu tarjeta de débito está activa. Si la perdés, la congelás al instante en Mis Tarjetas.',
    'tarjeta', '/tarjeta', 'Ver tarjetas',
  )
}

// ── Tipeos ─────────────────────────────────────────────────────────────────

// Palabras clave de las consultas. Un token que no está acá y se parece mucho a una de ellas
// (una letra de más, de menos o dada vuelta) se toma como un error de tipeo.
const VOCABULARIO = [
  'reserva', 'reservas', 'dolar', 'dolares', 'prestamo', 'prestamos', 'cuota', 'cuotas', 'saldo', 'cuanto', 'cuanta',
  'cuantos', 'cuantas', 'movimiento', 'movimientos', 'transferencia', 'transferencias', 'transferi', 'recibi',
  'ultimo', 'ultima', 'tarjeta', 'congelada', 'rinde', 'rendimiento', 'interes', 'meta', 'metas', 'vence',
  'proxima', 'debo', 'plata', 'dinero', 'pesos', 'total', 'tengo', 'deposito', 'mande', 'cotizacion', 'disponible',
]
const CONOCIDAS = new Set(VOCABULARIO)

function distancia(a: string, b: string) {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

function corregirPalabra(w: string) {
  if (w.length < 5 || CONOCIDAS.has(w)) return w
  const maximo = w.length >= 9 ? 2 : 1
  let mejor: string | null = null
  let mejorDist = maximo + 1
  let empate = false
  for (const v of VOCABULARIO) {
    if (Math.abs(v.length - w.length) > maximo) continue
    const dist = distancia(w, v)
    if (dist < mejorDist) {
      mejor = v
      mejorDist = dist
      empate = false
    } else if (dist === mejorDist && mejor && !v.startsWith(mejor) && !mejor.startsWith(v)) {
      // Singular y plural de lo mismo ("dolar" / "dolares") no cuentan como empate.
      empate = true
    }
  }
  return mejor && !empate ? mejor : w
}

export function corregirTipeos(q: string) {
  return q.split(' ').map(corregirPalabra).join(' ')
}

// ── Entrada ────────────────────────────────────────────────────────────────

const CONTINUACION: Record<string, string> = {
  recibido: 'cuanto recibi',
  enviado: 'cuanto transferi',
  movido: 'cuantos movimientos tuve',
  saldo: 'cuanto tengo',
  reserva: 'cuanto tengo',
  usd: 'cuanto tengo',
  ultimo: 'ultimo movimiento',
}

function conContinuacion(q: string, lastTopicId?: string): string {
  if (!lastTopicId?.startsWith('consulta:') || !/^y\b/.test(q) || q.split(' ').length > 6) return q
  const base = CONTINUACION[lastTopicId.slice('consulta:'.length)]
  return base ? `${base} ${q.replace(/^y\s+/, '')}` : q
}

/** Responde con datos de la persona, o null si no es una consulta de datos (o no hay cómo saberlo). */
export function consultar(
  qOriginal: string,
  ctx: AsistenteCtx,
  lastTopicId?: string,
  ahora: Date = new Date(),
): AsistenteReply | null {
  const q = corregirTipeos(conContinuacion(qOriginal, lastTopicId))
  if (!q || has(RE.explicacion, q)) return null
  if (/\b(?:gaste|gastos|gasto|gastado|gastando)\b/.test(q)) return null

  return (
    reglaCotizacion(q, ctx) ??
    reglaTarjeta(q, ctx) ??
    reglaPrestamos(q, ctx, ahora) ??
    reglaMetas(q, ctx) ??
    reglaMovimientos(q, ctx, ahora) ??
    reglaSaldos(q, ctx, ahora) ??
    (has(RE.rinde, q) && has(RE.personal, q) && !has(RE.prestamo, q) && !has(RE.usd, q) && !has(RE.tarjeta, q)
      ? reglaReserva(q, ctx, ahora)
      : null) ??
    reglaSaldoGeneral(q, ctx)
  )
}
