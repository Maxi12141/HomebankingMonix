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

const DESPERTAR = [
  /\bok(?:ey|ay|i)?\s*moni(?:x)?\b/,
  /\bhola\s*moni(?:x)?\b/,
  /\bche\s*moni(?:x)?\b/,
  /\beh\s*moni(?:x)?\b/,
]

export function extraerDespertar(texto: string): { woke: boolean; resto: string } {
  const t = normalize(texto)
  for (const re of DESPERTAR) {
    const m = t.match(re)
    if (m && m.index != null) {
      return { woke: true, resto: t.slice(m.index + m[0].length).trim() }
    }
  }
  return { woke: false, resto: t }
}

export function hablar(texto: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  const limpio = texto.replace(/→/g, '.').replace(/\s+/g, ' ').trim()
  if (!limpio) return
  const u = new SpeechSynthesisUtterance(limpio)
  u.lang = 'es-AR'
  u.rate = 1.04
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
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
  private nativo = false
  private unsub: { remove: () => Promise<void> } | null = null

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

  private manejarTexto(texto: string, isFinal: boolean) {
    const limpio = texto.trim()
    if (!limpio) return
    if (this.modo === 'wake') {
      const { woke, resto } = extraerDespertar(limpio)
      if (woke && isFinal) this.onWake(resto)
      return
    }
    this.onDictado(limpio, isFinal)
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
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1
    rec.onresult = (ev) => {
      const last = ev.results[ev.results.length - 1]
      if (!last) return
      const texto = last[0]?.transcript?.trim() ?? ''
      if (!texto) return
      if (this.modo === 'wake') {
        const { woke, resto } = extraerDespertar(texto)
        if (woke && last.isFinal) this.onWake(resto)
        return
      }
      this.onDictado(texto, last.isFinal)
    }
    rec.onerror = (ev) => {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        this.vivo = false
        this.onBloqueado?.()
      }
    }
    rec.onend = () => {
      if (!this.vivo || this.rec !== rec) return
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
