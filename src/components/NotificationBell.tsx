import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, ArrowDownLeft, CheckCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useMovimientos } from '../hooks/useMovimientos'
import { useNotificacionesStore } from '../stores/notificacionesStore'
import type { Movimiento } from '../types'

const currency = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)

function esNotificable(m: Movimiento) {
  return m.tipo === 'transferencia_entrada' || m.tipo === 'deposito'
}

function titulo(m: Movimiento) {
  return m.tipo === 'deposito' ? 'Depósito acreditado' : 'Transferencia recibida'
}

export function NotificationBell() {
  const navigate = useNavigate()
  const { movimientos, loading } = useMovimientos(20)
  const { lastReadAt, markAllRead } = useNotificacionesStore()
  const [open, setOpen] = useState(false)

  const notis = movimientos.filter(esNotificable)
  const unreadCount = notis.filter(
    (n) => !lastReadAt || new Date(n.created_at) > new Date(lastReadAt)
  ).length

  // Toast cuando llega una transferencia entrante nueva (no en la primera carga)
  const seenRef = useRef<Set<string>>(new Set())
  const baselineRef = useRef(false)
  useEffect(() => {
    if (loading) return
    const actuales = movimientos.filter(esNotificable)
    if (!baselineRef.current) {
      baselineRef.current = true
      seenRef.current = new Set(actuales.map((n) => n.id))
      return
    }
    for (const n of actuales) {
      if (!seenRef.current.has(n.id)) {
        seenRef.current.add(n.id)
        if (n.tipo === 'transferencia_entrada') {
          const quien = n.destinatario_nombre
            ? ` de ${n.destinatario_nombre} ${n.destinatario_apellido ?? ''}`.trimEnd()
            : ''
          toast.success(`Recibiste ${currency(n.monto)}${quien}`)
        } else {
          toast.success(`Se acreditó un depósito de ${currency(n.monto)}`)
        }
      }
    }
  }, [movimientos, loading])

  function handleToggle() {
    setOpen((v) => {
      const next = !v
      if (next && unreadCount > 0) markAllRead()
      return next
    })
  }

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        className="relative p-2 rounded-xl text-slate-secondary hover:text-navy dark:hover:text-white hover:bg-navy/5 dark:hover:bg-white/5 transition-colors"
        aria-label="Notificaciones"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-mint text-navy text-[10px] font-body font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] z-50 bg-white dark:bg-navy-card border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10">
                <p className="font-display text-sm font-semibold text-navy dark:text-white">Notificaciones</p>
                {notis.length > 0 && (
                  <button
                    onClick={() => markAllRead()}
                    className="flex items-center gap-1 font-body text-xs text-slate-secondary hover:text-mint transition-colors"
                  >
                    <CheckCheck size={14} />
                    Marcar leídas
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notis.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <Bell size={28} className="text-slate-secondary/50 mx-auto mb-2" />
                    <p className="font-body text-sm text-slate-secondary">No tenés notificaciones</p>
                  </div>
                ) : (
                  notis.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => { setOpen(false); navigate('/historial') }}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-navy/5 dark:hover:bg-white/5 transition-colors border-b border-slate-100 dark:border-white/5 last:border-0"
                    >
                      <div className="w-9 h-9 rounded-full bg-mint/20 flex items-center justify-center shrink-0 mt-0.5">
                        <ArrowDownLeft size={17} className="text-mint" strokeWidth={2.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-sm font-medium text-navy dark:text-white">{titulo(n)}</p>
                        {n.destinatario_nombre && (
                          <p className="font-body text-xs text-slate-secondary truncate">
                            de {n.destinatario_nombre} {n.destinatario_apellido}
                          </p>
                        )}
                        <p className="font-body text-xs text-slate-secondary mt-0.5">
                          {new Date(n.created_at).toLocaleString('es-AR', {
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <span className="font-display text-sm font-semibold text-mint shrink-0">
                        +{currency(n.monto)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
