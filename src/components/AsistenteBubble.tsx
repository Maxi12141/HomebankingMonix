import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, Bot, Mic, X } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useCuentaStore } from '../store/cuentaStore'
import { useTecladoInset } from '../hooks/useTecladoInset'
import {
  callar,
  hablar,
  soportaVozMoni,
  VozMoni,
} from '../lib/vozMoni'
import {
  SUGERENCIAS,
  mensajeBienvenida,
  responder,
  type AsistenteReply,
} from '../services/asistente'

interface ChatMsg {
  id: string
  role: 'bot' | 'user'
  text: string
  href?: string
  hrefLabel?: string
  topicId?: string
}

const STORAGE_KEY = 'monix-asistente-msgs'

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function fromReply(reply: AsistenteReply): ChatMsg {
  return {
    id: uid(),
    role: 'bot',
    text: reply.text,
    href: reply.href,
    hrefLabel: reply.hrefLabel,
    topicId: reply.topicId,
  }
}

function loadMessages(welcome: AsistenteReply): ChatMsg[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return [fromReply(welcome)]
    const parsed = JSON.parse(raw) as ChatMsg[]
    if (!Array.isArray(parsed) || parsed.length === 0) return [fromReply(welcome)]
    return parsed
  } catch {
    return [fromReply(welcome)]
  }
}

export function AsistenteBubble({ hidden = false }: { hidden?: boolean }) {
  const navigate = useNavigate()
  const { persona } = useAuthStore()
  const cuenta = useCuentaStore((s) => s.cuenta)
  const cuentas = useCuentaStore((s) => s.cuentas)
  const teclado = useTecladoInset()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [dictando, setDictando] = useState(false)
  const [wakeOn, setWakeOn] = useState(false)
  const [messages, setMessages] = useState<ChatMsg[]>(() =>
    loadMessages(mensajeBienvenida({ nombre: useAuthStore.getState().persona?.nombre })),
  )
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const vozRef = useRef<VozMoni | null>(null)
  const messagesRef = useRef(messages)
  const ctxRef = useRef({
    nombre: persona?.nombre,
    saldoARS: (cuentas.find((c) => c.moneda === 'ARS') ?? cuenta)?.saldo,
    saldoUSD: cuentas.find((c) => c.moneda === 'USD')?.saldo ?? null,
    alias: cuenta?.alias,
    cbu: cuenta?.cbu,
  })
  const wakeListo = useRef(false)

  messagesRef.current = messages
  ctxRef.current = {
    nombre: persona?.nombre,
    saldoARS: (cuentas.find((c) => c.moneda === 'ARS') ?? cuenta)?.saldo,
    saldoUSD: cuentas.find((c) => c.moneda === 'USD')?.saldo ?? null,
    alias: cuenta?.alias,
    cbu: cuenta?.cbu,
  }

  const tecladoAbierto = teclado > 80

  useEffect(() => {
    if (hidden) setOpen(false)
  }, [hidden])

  useEffect(() => {
    if (open) return
    if (!dictando) return
    setDictando(false)
    if (wakeListo.current) vozRef.current?.escucharWake()
  }, [open, dictando])

  useEffect(() => {
    if (messages.length === 0) return
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)))
  }, [messages])

  useEffect(() => {
    if (!open) return
    const node = listRef.current
    if (node) node.scrollTop = node.scrollHeight
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, messages])

  useEffect(() => {
    if (!soportaVozMoni()) return

    const voz = new VozMoni(
      (resto) => {
        setOpen(true)
        if (resto) {
          preguntar(resto, true)
          voz.escucharWake()
          setDictando(false)
          return
        }
        setDictando(true)
        setDraft('')
        voz.escucharDictado()
      },
      (texto, final) => {
        setDraft(texto)
        if (!final) return
        preguntar(texto, true)
        setDraft('')
        setDictando(false)
        voz.escucharWake()
      },
      () => {
        setWakeOn(false)
        setDictando(false)
      },
    )
    vozRef.current = voz

    const arrancar = () => {
      if (!wakeListo.current) return
      voz.escucharWake()
      setWakeOn(true)
    }
    const vis = () => {
      if (document.visibilityState === 'hidden') {
        callar()
        voz.parar()
        setWakeOn(false)
        setDictando(false)
        return
      }
      arrancar()
    }
    document.addEventListener('visibilitychange', vis)

    return () => {
      document.removeEventListener('visibilitychange', vis)
      voz.parar()
      vozRef.current = null
    }
  }, [])

  function preguntar(text: string, porVoz = false) {
    const trimmed = text.trim()
    if (!trimmed) return
    const hist = messagesRef.current
    const lastTopicId = [...hist].reverse().find((m) => m.role === 'bot')?.topicId
    const userMsg: ChatMsg = { id: uid(), role: 'user', text: trimmed }
    const botMsg = fromReply(responder(trimmed, ctxRef.current, { lastTopicId, turn: hist.length }))
    setMessages((prev) => [...prev, userMsg, botMsg])
    setDraft('')
    if (porVoz) hablar(botMsg.text)
  }

  function ask(text: string) {
    preguntar(text, false)
  }

  function go(href: string) {
    setOpen(false)
    navigate(href)
  }

  function toggleMic() {
    const voz = vozRef.current
    if (!voz) return
    wakeListo.current = true
    if (dictando) {
      setDictando(false)
      voz.escucharWake()
      setWakeOn(true)
      return
    }
    setOpen(true)
    setDictando(true)
    setDraft('')
    callar()
    voz.escucharDictado()
    setWakeOn(true)
  }

  function abrirChat() {
    setOpen(true)
    const voz = vozRef.current
    if (!voz || !soportaVozMoni()) return
    wakeListo.current = true
    voz.escucharWake()
    setWakeOn(true)
  }

  const bottom = tecladoAbierto
    ? teclado + 8
    : undefined

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.button
            type="button"
            aria-label="Cerrar asistente"
            className="fixed inset-0 z-[54] bg-transparent"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      <div
        className={`pointer-events-none fixed flex flex-col gap-2 ${
          open ? 'z-[55]' : 'z-40'
        } ${
          tecladoAbierto
            ? 'left-3 right-3 items-stretch'
            : 'right-3 md:right-6 items-end bottom-[calc(4.85rem+env(safe-area-inset-bottom))] md:bottom-6'
        }`}
        style={tecladoAbierto ? { bottom } : undefined}
      >
        <AnimatePresence>
          {open && (
            <motion.section
              role="dialog"
              aria-label="Asistente Monix"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              className={`pointer-events-auto ${tecladoAbierto ? 'w-full' : 'w-[min(20.5rem,calc(100vw-1.5rem))]'}`}
            >
              <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 dark:border-white/10 bg-white dark:bg-navy-card shadow-xl shadow-navy/10 dark:shadow-black/40">
              <header className="flex items-center gap-2 px-3 py-2 border-b border-slate-200/80 dark:border-white/10 shrink-0 bg-white dark:bg-navy-card">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-mint text-navy">
                  <Bot size={14} strokeWidth={2.2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-semibold text-navy dark:text-white leading-none">
                    Moni
                  </p>
                  <p className="font-body text-[10px] text-slate-secondary mt-0.5">
                    {dictando
                      ? 'Te escucho…'
                      : wakeOn
                        ? 'Decí «okey Moni»'
                        : 'Asistente Monix'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg text-slate-secondary hover:text-navy dark:hover:text-white hover:bg-navy/5 dark:hover:bg-white/5"
                  aria-label="Cerrar chat"
                >
                  <X size={16} />
                </button>
              </header>

              <div
                ref={listRef}
                className={`overflow-y-auto overscroll-contain no-scrollbar px-3 py-2.5 space-y-2 ${
                  tecladoAbierto
                    ? 'max-h-[min(11rem,28dvh)]'
                    : 'max-h-[min(18rem,46dvh)]'
                }`}
              >
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex w-full min-h-min ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-3 py-2 ${
                        msg.role === 'user'
                          ? 'bg-mint text-navy rounded-br-md'
                          : 'bg-slate-input dark:bg-white/10 text-navy dark:text-white rounded-bl-md'
                      }`}
                    >
                      <p className="font-body text-[13px] leading-snug whitespace-pre-line">{msg.text}</p>
                      {msg.role === 'bot' && msg.href && (
                        <button
                          type="button"
                          onClick={() => go(msg.href!)}
                          className="mt-1.5 font-body text-[11px] font-semibold text-navy/80 dark:text-mint hover:underline"
                        >
                          {msg.hrefLabel ?? 'Abrir'} →
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {!tecladoAbierto && (
                <div className="px-3 pb-1.5 flex gap-1 overflow-x-auto no-scrollbar">
                  {SUGERENCIAS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => ask(chip)}
                      className="shrink-0 rounded-full border border-slate-200 dark:border-white/10 px-2.5 py-1 font-body text-[11px] text-slate-secondary hover:border-mint hover:text-navy dark:hover:text-white transition-colors"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}

              <form
                className="p-2 pt-1.5 flex items-center gap-1.5 shrink-0"
                onSubmit={(e) => {
                  e.preventDefault()
                  ask(draft)
                }}
              >
                {soportaVozMoni() && (
                  <button
                    type="button"
                    onClick={toggleMic}
                    aria-label={dictando ? 'Dejar de escuchar' : 'Hablarle a Moni'}
                    className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${
                      dictando
                        ? 'bg-mint text-navy animate-pulse'
                        : 'bg-slate-input dark:bg-white/10 text-navy dark:text-white'
                    }`}
                  >
                    <Mic size={16} strokeWidth={2.4} />
                  </button>
                )}
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={dictando ? 'Escuchando…' : 'Preguntame o decí okey Moni…'}
                  maxLength={400}
                  onFocus={() => {
                    window.setTimeout(() => {
                      inputRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
                    }, 50)
                  }}
                  className="flex-1 min-w-0 rounded-xl px-3 py-2 font-body text-base md:text-sm text-navy dark:text-white bg-slate-input dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-mint placeholder:text-slate-secondary/60"
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  aria-label="Enviar"
                  className="h-9 w-9 shrink-0 rounded-xl bg-mint text-navy flex items-center justify-center disabled:opacity-40"
                >
                  <ArrowUp size={16} strokeWidth={2.4} />
                </button>
              </form>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {!open && !hidden && !tecladoAbierto && (
          <button
            type="button"
            onClick={() => abrirChat()}
            aria-label="Abrir asistente Monix"
            className="pointer-events-auto h-11 w-11 md:h-12 md:w-12 rounded-full bg-navy dark:bg-mint text-mint dark:text-navy shadow-md shadow-navy/20 dark:shadow-mint/20 flex items-center justify-center border border-white/10 dark:border-transparent hover:scale-[1.03] active:scale-95 transition-transform relative"
          >
            <Bot size={20} strokeWidth={2.1} />
            {wakeOn && (
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-mint ring-2 ring-navy dark:ring-mint dark:bg-navy" />
            )}
          </button>
        )}
      </div>
    </>
  )
}
