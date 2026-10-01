import {
  onVozNativa,
  radioCapabilities,
  startVozNativa,
  stopVozNativa,
} from '../native/monixRadio'

interface RecogResult {
  isFinal: boolean
  0: { transcript: string }
}

interface Recog {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((ev: { results: ArrayLike<RecogResult> }) => void) | null
  onend: (() => void) | null
  onerror: ((ev: { error: string }) => void) | null
  start: () => void
  abort: () => void
}

type RecogCtor = new () => Recog

function ctorVoz(): RecogCtor | null {
  const w = window as Window & {
    SpeechRecognition?: RecogCtor
    webkitSpeechRecognition?: RecogCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function soportaVozMoni() {
  return typeof window !== 'undefined' && (radioCapabilities().native || Boolean(ctorVoz()))
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** El reconocedor a veces entrega la misma frase dos veces pegada. */
export function colapsarRepeticion(texto: string): string {
  const words = texto.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (words.length < 2) return words.join(' ')
  const normWords = words.map((word) => normalize(word))
  for (let size = 1; size <= Math.floor(normWords.length / 2); size++) {
    if (normWords.length % size !== 0) continue
    const reps = normWords.length / size
    if (reps < 2) continue
    const block = normWords.slice(0, size).join(' ')
    let igual = true
    for (let r = 1; r < reps; r++) {
      if (normWords.slice(r * size, (r + 1) * size).join(' ') !== block) {
        igual = false
        break
      }
    }
    if (igual) return words.slice(0, size).join(' ')
  }
  return words.join(' ')
}

/** Misma frase aunque cambien mayúsculas o acentos. */
export function mismaFrase(a: string, b: string) {
  const left = normalize(a)
  const right = normalize(b)
  return Boolean(left) && left === right
}

/** Lo que se oyó es el texto que acaba de decir Moni, no una pregunta nueva. */
export function esEcoDe(dicho: string, oido: string) {
  const a = normalize(dicho)
  const b = normalize(oido)
  if (a.length < 12 || b.length < 12) return false
  const corto = Math.min(a.length, b.length)
  const largo = Math.max(a.length, b.length)
  if ((a.includes(b) || b.includes(a)) && corto / largo >= 0.55) return true
  const wa = new Set(a.split(' ').filter((w) => w.length > 2))
  const wb = b.split(' ').filter((w) => w.length > 2)
  if (wb.length < 5 || wa.size < 5) return false
  const hits = wb.filter((w) => wa.has(w)).length
  return hits / wb.length >= 0.75
}

const DESPERTAR = [
  /\bok(?:ey|ay|i)?\s*moni(?:x)?\b/,
  /\bhola\s*moni(?:x)?\b/,
  /\bche\s*moni(?:x)?\b/,
  /\beh\s*moni(?:x)?\b/,
]

/** El resto es lo dicho después del último «okey Moni», no del primero. */
export function extraerDespertar(texto: string): { woke: boolean; resto: string } {
  const t = normalize(texto)
  let found: { index: number; length: number } | null = null
  for (const re of DESPERTAR) {
    for (const m of t.matchAll(new RegExp(re.source, 'g'))) {
      if (m.index == null) continue
      if (!found || m.index >= found.index) found = { index: m.index, length: m[0].length }
    }
  }
  if (!found) return { woke: false, resto: t }
  return { woke: true, resto: t.slice(found.index + found.length).trim() }
}

function unirResultados(
  results: ArrayLike<RecogResult>,
  soloUltimo: boolean,
): { texto: string; isFinal: boolean } {
  const n = results.length
  if (n === 0) return { texto: '', isFinal: false }
  const last = results[n - 1]
  const isFinal = Boolean(last?.isFinal)
  if (soloUltimo) return { texto: (last?.[0]?.transcript ?? '').trim(), isFinal }
  const partes: string[] = []
  for (let i = 0; i < n; i++) {
    const piece = (results[i]?.[0]?.transcript ?? '').trim()
    if (!piece) continue
    const prev = partes[partes.length - 1]
    if (prev && mismaFrase(prev, piece)) continue
    const junto = partes.join(' ')
    if (junto && (mismaFrase(junto, piece) || normalize(junto).endsWith(normalize(piece)))) continue
    partes.push(piece)
  }
  return { texto: partes.join(' ').trim(), isFinal }
}

/** Devuelve cuántos milisegundos va a estar hablando, para no escuchar esa voz. */
export function hablar(texto: string): number {
  if (typeof window === 'undefined' || !window.speechSynthesis) return 0
  const limpio = texto.replace(/→/g, '.').replace(/\s+/g, ' ').trim()
  if (!limpio) return 0
  const u = new SpeechSynthesisUtterance(limpio)
  u.lang = 'es-AR'
  u.rate = 1.04
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
  return Math.min(20000, 700 + limpio.length * 58)
}

export function callar() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
}

export class VozMoni {
  private rec: Recog | null = null
  private vivo = false
  private modo: 'wake' | 'dictado' = 'wake'
  private timer: number | null = null
  private dictadoTimer: number | null = null
  private dictadoBuf = ''
  private nativo = false
  private unsub: { remove: () => Promise<void> } | null = null
  private sordoHasta = 0
  private ultimoNorm = ''
  private ultimoAt = 0
  private ecoNorm = ''
  private ecoHasta = 0

  constructor(
    private readonly onWake: (resto: string) => void,
    private readonly onDictado: (texto: string, final: boolean) => void,
    private readonly onBloqueado?: () => void,
  ) {}

  get activo() {
    return this.vivo
  }

  escucharWake() {
    this.modo = 'wake'
    this.arrancar()
  }

  escucharDictado() {
    this.modo = 'dictado'
    this.arrancar()
  }

  parar() {
    this.vivo = false
    if (this.timer != null) {
      window.clearTimeout(this.timer)
      this.timer = null
    }
    if (this.dictadoTimer != null) {
      window.clearTimeout(this.dictadoTimer)
      this.dictadoTimer = null
    }
    this.dictadoBuf = ''
    this.sordoHasta = 0
    this.ecoNorm = ''
    this.ecoHasta = 0
    if (this.nativo) {
      this.nativo = false
      void this.unsub?.remove()
      this.unsub = null
      void stopVozNativa()
    }
    try {
      this.rec?.abort()
    } catch {
      /* ya estaba parado */
    }
    this.rec = null
  }

  /** Mientras Moni habla, o justo después de enviar, no se toma esa voz como pregunta. */
  enmudecer(ms: number) {
    if (ms <= 0) return
    this.sordoHasta = Math.max(this.sordoHasta, Date.now() + ms)
    this.dictadoBuf = ''
    if (this.dictadoTimer != null) {
      window.clearTimeout(this.dictadoTimer)
      this.dictadoTimer = null
    }
  }

  /** Ignora lo que se parezca a `texto` mientras suena y un instante después. */
  ignorarEco(texto: string, ms: number) {
    const n = normalize(texto)
    if (n) {
      this.ecoNorm = n
      this.ecoHasta = Date.now() + ms + 1800
    }
    this.enmudecer(ms)
  }

  private sordo() {
    return Date.now() < this.sordoHasta
  }

  private esRepetido(texto: string) {
    const n = normalize(texto)
    if (!n || n !== this.ultimoNorm) return false
    return Date.now() - this.ultimoAt < 8000
  }

  private recordar(texto: string) {
    this.ultimoNorm = normalize(texto)
    this.ultimoAt = Date.now()
    this.enmudecer(1000)
  }

  private esEco(texto: string) {
    if (!this.ecoNorm || Date.now() > this.ecoHasta) return false
    return esEcoDe(this.ecoNorm, texto) || mismaFrase(this.ecoNorm, texto)
  }

  /** Si el teléfono reenvió la frase anterior pegada adelante, queda solo lo nuevo. */
  private recortarPrefijo(texto: string) {
    if (!this.ultimoNorm || Date.now() - this.ultimoAt > 12000) return texto
    const words = texto.split(/\s+/).filter(Boolean)
    const normWords = words.map((word) => normalize(word))
    const prev = this.ultimoNorm.split(' ')
    if (prev.length === 0 || normWords.length <= prev.length) return texto
    for (let i = 0; i < prev.length; i++) {
      if (normWords[i] !== prev[i]) return texto
    }
    return words.slice(prev.length).join(' ')
  }

  private preparar(texto: string) {
    const colapsado = colapsarRepeticion(texto.trim())
    if (!colapsado) return ''
    const { woke, resto } = extraerDespertar(colapsado)
    if (!woke) return this.recortarPrefijo(colapsado).trim()
    const pregunta = this.recortarPrefijo(colapsarRepeticion(resto)).trim()
    if (pregunta) return pregunta
    if (colapsado.split(/\s+/).length <= 3) return colapsado
    return ''
  }

  private flushDictado() {
    if (this.dictadoTimer != null) {
      window.clearTimeout(this.dictadoTimer)
      this.dictadoTimer = null
    }
    const t = this.dictadoBuf.trim()
    this.dictadoBuf = ''
    if (!t) return
    if (this.sordo() || this.esRepetido(t) || this.esEco(t)) {
      this.onDictado('', false)
      return
    }
    this.recordar(t)
    this.onDictado(t, true)
  }

  private programarDictado(texto: string, isFinal: boolean) {
    this.dictadoBuf = texto
    this.onDictado(texto, false)
    if (this.dictadoTimer != null) window.clearTimeout(this.dictadoTimer)
    this.dictadoTimer = window.setTimeout(() => {
      this.dictadoTimer = null
      this.flushDictado()
    }, isFinal ? 450 : 1400)
  }

  private manejarTexto(texto: string, isFinal: boolean) {
    if (this.sordo()) return
    const limpio = texto.trim()
    if (!limpio) return
    if (this.modo === 'wake') {
      const { woke, resto } = extraerDespertar(colapsarRepeticion(limpio))
      if (!woke || !isFinal) return
      const pregunta = this.recortarPrefijo(colapsarRepeticion(resto)).trim()
      if (pregunta && (this.esRepetido(pregunta) || this.esEco(pregunta))) return
      if (pregunta) this.recordar(pregunta)
      this.onWake(pregunta)
      return
    }
    const util = this.preparar(limpio)
    if (!util || this.esEco(util) || this.esRepetido(util)) {
      if (isFinal) this.onDictado('', false)
      return
    }
    this.programarDictado(util, isFinal)
  }

  private arrancar() {
    if (radioCapabilities().native) {
      void this.arrancarNativo()
      return
    }
    this.arrancarWeb()
  }

  private async arrancarNativo() {
    this.vivo = true
    if (this.nativo) return
    this.nativo = true
    try {
      this.unsub = await onVozNativa((texto, isFinal) => {
        if (!this.vivo) return
        this.manejarTexto(texto, isFinal)
      })
      await startVozNativa()
    } catch {
      this.nativo = false
      void this.unsub?.remove()
      this.unsub = null
      this.arrancarWeb()
    }
  }

  private arrancarWeb() {
    const Ctor = ctorVoz()
    if (!Ctor) return
    this.vivo = true
    const anterior = this.rec
    this.rec = null
    try {
      anterior?.abort()
    } catch {
      /* ignore */
    }

    const rec = new Ctor()
    rec.lang = 'es-AR'
    rec.continuous = this.modo === 'wake'
    rec.interimResults = true
    rec.maxAlternatives = 3
    rec.onresult = (ev) => {
      const { texto, isFinal } = unirResultados(ev.results, this.modo === 'wake')
      if (!texto) return
      this.manejarTexto(texto, isFinal)
    }
    rec.onerror = (ev) => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        this.vivo = false
        this.onBloqueado?.()
      }
    }
    rec.onend = () => {
      if (!this.vivo || this.rec !== rec) return
      if (this.modo === 'dictado') {
        if (this.dictadoBuf && this.dictadoTimer == null) this.flushDictado()
        return
      }
      this.timer = window.setTimeout(() => {
        this.timer = null
        if (this.vivo) this.arrancar()
      }, 220)
    }
    this.rec = rec
    try {
      rec.start()
    } catch {
      /* start duplicado */
    }
  }
}
