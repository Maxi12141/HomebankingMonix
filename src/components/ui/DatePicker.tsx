import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react'

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const DAYS_ES = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

const YEAR_MIN = 1920
const YEAR_MAX = new Date().getFullYear() + 2
const YEARS = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i)
const ITEM_H = 40

interface Props {
  value: string
  onChange: (iso: string) => void
  label?: string
  placeholder?: string
}

function isoToDisplay(iso: string) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function firstWeekday(year: number, month: number) {
  return (new Date(year, month, 1).getDay() + 6) % 7
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

export function DatePicker({ value, onChange, label, placeholder = 'DD/MM/AAAA' }: Props) {
  const today = new Date()
  const sel = value ? new Date(value + 'T12:00:00') : null

  const [open, setOpen] = useState(false)
  const [yearMode, setYearMode] = useState(false)
  const [vy, setVy] = useState(sel?.getFullYear() ?? today.getFullYear())
  const [vm, setVm] = useState(sel?.getMonth() ?? today.getMonth())
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const [above, setAbove] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const yearScrollRef = useRef<HTMLDivElement>(null)
  const scrollDebounce = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T12:00:00')
      setVy(d.getFullYear())
      setVm(d.getMonth())
    }
  }, [value])

  useEffect(() => {
    if (!open) setYearMode(false)
  }, [open])

  useEffect(() => {
    if (yearMode && yearScrollRef.current) {
      const idx = YEARS.indexOf(vy)
      if (idx >= 0) {
        yearScrollRef.current.scrollTop = idx * ITEM_H
      }
    }
  }, [yearMode])

  useEffect(() => {
    if (!open) return
    function onMouse(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onScroll(e: Event) {
      if (rootRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onMouse)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  function toggle() {
    if (!rootRef.current) return
    const r = rootRef.current.getBoundingClientRect()
    setAnchor(r)
    setAbove(r.bottom + 360 > window.innerHeight && r.top > 360)
    setOpen(v => !v)
  }

  function pick(day: number) {
    const iso = `${vy}-${String(vm + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    onChange(iso)
    setOpen(false)
  }

  function prevMonth() {
    if (vm === 0) { setVm(11); setVy(y => y - 1) } else setVm(m => m - 1)
  }
  function nextMonth() {
    if (vm === 11) { setVm(0); setVy(y => y + 1) } else setVm(m => m + 1)
  }

  function handleYearScroll() {
    clearTimeout(scrollDebounce.current)
    scrollDebounce.current = setTimeout(() => {
      if (!yearScrollRef.current) return
      const idx = Math.round(yearScrollRef.current.scrollTop / ITEM_H)
      setVy(YEARS[Math.max(0, Math.min(idx, YEARS.length - 1))])
    }, 120)
  }

  function selectYear(y: number) {
    setVy(y)
    setYearMode(false)
  }

  const first = firstWeekday(vy, vm)
  const count = daysInMonth(vy, vm)
  const cells: (number | null)[] = [
    ...Array<null>(first).fill(null),
    ...Array.from({ length: count }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const isSel = (d: number) =>
    sel && sel.getFullYear() === vy && sel.getMonth() === vm && sel.getDate() === d
  const isToday = (d: number) =>
    today.getFullYear() === vy && today.getMonth() === vm && today.getDate() === d

  const dropStyle: React.CSSProperties = anchor
    ? {
        position: 'fixed',
        left: Math.max(8, Math.min(anchor.left, window.innerWidth - 296)),
        zIndex: 500,
        width: 288,
        ...(above
          ? { bottom: window.innerHeight - anchor.top + 4 }
          : { top: anchor.bottom + 4 }),
      }
    : {}

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-body font-medium text-slate-secondary">
          {label}
        </label>
      )}

      <div className="relative">
        <input
          readOnly
          value={isoToDisplay(value)}
          placeholder={placeholder}
          onClick={toggle}
          className="w-full rounded-xl px-4 py-2.5 pr-16 font-body text-sm text-navy dark:text-white bg-slate-input dark:bg-white/5 border border-slate-300 dark:border-white/10 focus:outline-none focus:border-mint/50 placeholder-slate-secondary/60 transition-colors cursor-pointer select-none"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {value && (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); onChange(''); setOpen(false) }}
              className="p-1 text-slate-secondary hover:text-red-400 transition-colors"
            >
              <X size={13} />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            onClick={toggle}
            className="p-1 text-slate-secondary hover:text-mint transition-colors"
          >
            <Calendar size={15} />
          </button>
        </div>
      </div>

      {open && anchor && (
        <div
          style={dropStyle}
          className="bg-white dark:bg-navy-card border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-4 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            {yearMode ? (
              <>
                <div className="w-7" />
                <button
                  type="button"
                  onClick={() => setYearMode(false)}
                  className="font-display text-sm font-semibold text-mint hover:text-mint/70 transition-colors"
                >
                  {vy}
                </button>
                <div className="w-7" />
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-1.5 rounded-lg text-slate-secondary hover:text-navy dark:hover:text-white hover:bg-navy/5 dark:hover:bg-white/5 transition-colors"
                >
                  <ChevronLeft size={15} />
                </button>
                <div className="flex items-center gap-1.5">
                  <span className="font-display text-sm font-semibold text-navy dark:text-white">
                    {MONTHS_ES[vm]}
                  </span>
                  <button
                    type="button"
                    onClick={() => setYearMode(true)}
                    className="font-display text-sm font-semibold text-mint hover:text-mint/70 transition-colors px-1 rounded"
                  >
                    {vy}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1.5 rounded-lg text-slate-secondary hover:text-navy dark:hover:text-white hover:bg-navy/5 dark:hover:bg-white/5 transition-colors"
                >
                  <ChevronRight size={15} />
                </button>
              </>
            )}
          </div>

          {yearMode ? (
            /* ── Year wheel ── */
            <div className="relative">
              {/* Center ring */}
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-10 border-y border-mint/30 pointer-events-none z-20" />
              {/* Top fade */}
              <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white dark:from-navy-card to-transparent pointer-events-none z-10" />
              {/* Bottom fade */}
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white dark:from-navy-card to-transparent pointer-events-none z-10" />
              <div
                ref={yearScrollRef}
                onScroll={handleYearScroll}
                className="h-[200px] overflow-y-auto snap-y snap-mandatory no-scrollbar"
              >
                <div className="h-20" />
                {YEARS.map((y) => (
                  <div
                    key={y}
                    onClick={() => selectYear(y)}
                    className={`snap-center h-10 flex items-center justify-center cursor-pointer select-none font-body text-sm transition-colors
                      ${y === vy ? 'text-navy dark:text-white font-semibold' : 'text-slate-secondary hover:text-navy dark:hover:text-white'}
                    `}
                  >
                    {y}
                  </div>
                ))}
                <div className="h-20" />
              </div>
            </div>
          ) : (
            /* ── Calendar grid ── */
            <>
              <div className="grid grid-cols-7 mb-1">
                {DAYS_ES.map(d => (
                  <div key={d} className="h-7 flex items-center justify-center font-body text-xs font-semibold text-slate-secondary/70">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {cells.map((day, i) =>
                  !day
                    ? <div key={`e${i}`} className="h-8" />
                    : (
                      <button
                        key={day}
                        type="button"
                        onClick={() => pick(day)}
                        className={`
                          h-8 w-full flex items-center justify-center rounded-lg font-body text-sm transition-colors
                          ${isSel(day)
                            ? 'bg-mint text-navy font-semibold'
                            : isToday(day)
                            ? 'text-mint font-semibold ring-1 ring-inset ring-mint/40'
                            : 'text-navy dark:text-white hover:bg-navy/5 dark:hover:bg-white/5 hover:text-mint'
                          }
                        `}
                      >
                        {day}
                      </button>
                    )
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
