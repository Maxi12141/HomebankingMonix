import { useState } from 'react'
import { Search, Pencil, Trash2, Check, X, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { buscarPorCBU, buscarPorAlias } from '../services/bancoCentral'
import { useContactos } from '../hooks/useContactos'
import { Card } from './ui/Card'
import type { Contacto } from '../types'

interface PersonaEncontrada {
  nombre: string
  apellido: string
  cbu: string
  alias: string | null
}

interface Props {
  onSelectContacto: (cbu: string) => void
}

function Iniciales({ nombre, apellido }: { nombre: string; apellido: string }) {
  return (
    <div className="w-9 h-9 rounded-full bg-mint/20 text-mint flex items-center justify-center font-body font-bold text-sm shrink-0 select-none">
      {(nombre[0] ?? '').toUpperCase()}{(apellido[0] ?? '').toUpperCase()}
    </div>
  )
}

export function AgendaContactosPanel({ onSelectContacto }: Props) {
  const { contactos, guardar, eliminar, editarApodo, isGuardado } = useContactos()

  const [mostrarForm, setMostrarForm] = useState(false)
  const [inputBusqueda, setInputBusqueda] = useState('')
  const [inputApodo, setInputApodo] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [personaEncontrada, setPersonaEncontrada] = useState<PersonaEncontrada | null>(null)
  const [errorBusqueda, setErrorBusqueda] = useState('')

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [apodoEditado, setApodoEditado] = useState('')

  async function buscarPersona() {
    const input = inputBusqueda.trim()
    if (!input) return
    setBuscando(true)
    setErrorBusqueda('')
    setPersonaEncontrada(null)

    try {
      const esCBU = /^\d{22}$/.test(input)
      let localQuery = supabase
        .from('cuentas')
        .select('cbu, alias, personas(nombre, apellido)')
        .eq('activa', true)
      localQuery = esCBU ? localQuery.eq('cbu', input) : localQuery.ilike('alias', input)
      const { data: cuentaLocal } = await localQuery.maybeSingle()

      if (cuentaLocal) {
        const p = cuentaLocal.personas as unknown as { nombre: string; apellido: string }
        setPersonaEncontrada({ nombre: p.nombre, apellido: p.apellido, cbu: cuentaLocal.cbu, alias: cuentaLocal.alias })
        return
      }

      const bc = esCBU ? await buscarPorCBU(input) : await buscarPorAlias(input)
      setPersonaEncontrada({ nombre: bc.nombre, apellido: bc.apellido, cbu: bc.cbu, alias: null })
    } catch {
      setErrorBusqueda('No se encontró ninguna cuenta con ese CBU o alias')
    } finally {
      setBuscando(false)
    }
  }

  function handleGuardar() {
    if (!personaEncontrada) return
    guardar({
      nombre: personaEncontrada.nombre,
      apellido: personaEncontrada.apellido,
      cbu: personaEncontrada.cbu,
      alias: personaEncontrada.alias,
      apodo: inputApodo.trim() || null,
    })
    setMostrarForm(false)
    setInputBusqueda('')
    setInputApodo('')
    setPersonaEncontrada(null)
  }

  function iniciarEdicion(c: Contacto) {
    setEditandoId(c.id)
    setApodoEditado(c.apodo ?? '')
  }

  function confirmarEdicion(cbu: string) {
    editarApodo(cbu, apodoEditado.trim() || null)
    setEditandoId(null)
  }

  function cancelarForm() {
    setMostrarForm(false)
    setInputBusqueda('')
    setInputApodo('')
    setPersonaEncontrada(null)
    setErrorBusqueda('')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-navy dark:text-white">Agenda</h2>
        <button
          onClick={() => (mostrarForm ? cancelarForm() : setMostrarForm(true))}
          className="flex items-center gap-1.5 text-sm font-body text-mint hover:text-mint/80 transition-colors"
        >
          <UserPlus size={15} />
          Agregar
        </button>
      </div>

      {/* Formulario nuevo contacto */}
      {mostrarForm && (
        <Card className="p-4 flex flex-col gap-3">
          <p className="font-body text-xs text-slate-secondary uppercase tracking-wider">Nuevo contacto</p>

          <div className="flex gap-2">
            <input
              className="flex-1 bg-slate-input dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2.5 text-navy dark:text-white font-body text-sm placeholder-slate-secondary focus:outline-none focus:border-mint/50 transition-colors"
              placeholder="CBU o alias"
              value={inputBusqueda}
              onChange={(e) => { setInputBusqueda(e.target.value); setPersonaEncontrada(null); setErrorBusqueda('') }}
              onKeyDown={(e) => e.key === 'Enter' && buscarPersona()}
            />
            <button
              type="button"
              onClick={buscarPersona}
              disabled={!inputBusqueda.trim() || buscando}
              className="px-3 rounded-xl bg-mint/10 border border-mint/20 text-mint hover:bg-mint/20 transition-colors disabled:opacity-40"
            >
              <Search size={16} />
            </button>
          </div>

          {buscando && <p className="text-xs text-slate-secondary font-body">Buscando...</p>}
          {errorBusqueda && <p className="text-xs text-red-500 dark:text-red-400 font-body">{errorBusqueda}</p>}

          {personaEncontrada && (
            <>
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-mint/10 border border-mint/20">
                <Iniciales nombre={personaEncontrada.nombre} apellido={personaEncontrada.apellido} />
                <div className="min-w-0">
                  <p className="text-sm font-body font-medium text-mint truncate">
                    {personaEncontrada.nombre} {personaEncontrada.apellido}
                  </p>
                  <p className="text-xs font-body text-slate-secondary truncate">
                    {personaEncontrada.cbu}
                  </p>
                </div>
              </div>

              <input
                className="bg-slate-input dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2.5 text-navy dark:text-white font-body text-sm placeholder-slate-secondary focus:outline-none focus:border-mint/50 transition-colors"
                placeholder="Apodo (opcional, ej: Mamá)"
                value={inputApodo}
                onChange={(e) => setInputApodo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGuardar()}
              />

              <div className="flex gap-2">
                <button
                  onClick={handleGuardar}
                  disabled={isGuardado(personaEncontrada.cbu)}
                  className="flex-1 py-2 rounded-xl bg-mint text-navy font-body font-medium text-sm hover:bg-mint/90 transition-colors disabled:opacity-50"
                >
                  {isGuardado(personaEncontrada.cbu) ? 'Ya guardado' : 'Guardar contacto'}
                </button>
                <button
                  onClick={cancelarForm}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-secondary hover:text-navy dark:hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Lista de contactos */}
      {contactos.length === 0 ? (
        <p className="font-body text-sm text-slate-secondary text-center py-6">
          No hay contactos guardados
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {contactos.map((c) => (
            <div key={c.id}>
              <div className="group flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white dark:bg-navy-card border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 transition-colors">
                {/* Área clickeable para seleccionar */}
                <button
                  onClick={() => onSelectContacto(c.cbu)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <Iniciales nombre={c.nombre} apellido={c.apellido} />
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm font-medium text-navy dark:text-white truncate">
                      {c.apodo ?? `${c.nombre} ${c.apellido}`}
                    </p>
                    {c.apodo && (
                      <p className="font-body text-xs text-slate-secondary truncate">
                        {c.nombre} {c.apellido}
                      </p>
                    )}
                    <p className="font-body text-xs text-slate-secondary truncate">{c.cbu}</p>
                  </div>
                </button>

                {/* Acciones (visibles al hover) */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => iniciarEdicion(c)}
                    title="Editar apodo"
                    className="p-1.5 rounded-lg text-slate-secondary hover:text-mint hover:bg-mint/10 transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => eliminar(c.cbu)}
                    title="Eliminar contacto"
                    className="p-1.5 rounded-lg text-slate-secondary hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/10 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Editor de apodo inline */}
              {editandoId === c.id && (
                <div className="flex gap-2 mt-1 px-1">
                  <input
                    className="flex-1 bg-slate-input dark:bg-white/5 border border-mint/30 rounded-xl px-3 py-1.5 text-navy dark:text-white font-body text-sm placeholder-slate-secondary focus:outline-none focus:border-mint/60 transition-colors"
                    placeholder="Apodo (vacío para quitar)"
                    value={apodoEditado}
                    onChange={(e) => setApodoEditado(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmarEdicion(c.cbu)
                      if (e.key === 'Escape') setEditandoId(null)
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => confirmarEdicion(c.cbu)}
                    className="p-1.5 rounded-xl bg-mint/20 text-mint hover:bg-mint/30 transition-colors"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => setEditandoId(null)}
                    className="p-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-secondary hover:text-navy dark:hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
