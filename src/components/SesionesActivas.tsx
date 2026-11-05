import { useCallback, useEffect, useState } from 'react'
import { MonitorSmartphone } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabaseClient'
import { mensajeError } from '../lib/errores'
import { haceCuanto, nombreDispositivo } from '../utils/sesiones'
import { Desplegable } from './ui/Desplegable'
import { Button } from './ui/Button'

interface Sesion {
  id: string
  creada: string
  ultimo_uso: string
  user_agent: string | null
  actual: boolean
}

const OTRAS_VISIBLES = 4

export function SesionesActivas() {
  const [sesiones, setSesiones] = useState<Sesion[] | null>(null)
  const [fallo, setFallo] = useState(false)
  const [verTodas, setVerTodas] = useState(false)
  const [cerrando, setCerrando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setFallo(false)
    const { data, error } = await supabase.rpc('mis_sesiones')
    if (error) {
      setFallo(true)
      return
    }
    setSesiones((data as Sesion[] | null) ?? [])
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  async function cerrarUna(id: string) {
    setCerrando(id)
    const { error } = await supabase.rpc('cerrar_sesion', { p_sesion: id })
    if (error) toast.error(mensajeError(error, 'No pudimos cerrar esa sesión. Probá de nuevo.'))
    else toast.success('Sesión cerrada')
    await cargar()
    setCerrando(null)
  }

  async function cerrarOtras() {
    setCerrando('otras')
    const { error } = await supabase.auth.signOut({ scope: 'others' })
    if (error) toast.error(mensajeError(error, 'No pudimos cerrar las demás sesiones. Probá de nuevo.'))
    else toast.success('Cerraste las demás sesiones')
    await cargar()
    setCerrando(null)
  }

  const actual = sesiones?.find((s) => s.actual)
  const otras = sesiones?.filter((s) => !s.actual) ?? []
  const visibles = verTodas ? otras : otras.slice(0, OTRAS_VISIBLES)

  return (
    <Desplegable
      titulo="Dónde está abierta tu cuenta"
      resumen={sesiones ? (sesiones.length === 1 ? '1 dispositivo' : `${sesiones.length} dispositivos`) : undefined}
      icono={<MonitorSmartphone size={20} />}
    >
      <p className="font-body text-sm text-slate-secondary mb-4">
        Si no reconocés un dispositivo, cerralo y cambiá tu contraseña: el acceso se corta en menos de una hora.
      </p>

      {fallo ? (
        <div className="flex flex-col items-start gap-3">
          <p className="font-body text-sm text-slate-secondary">No pudimos cargar tus sesiones.</p>
          <Button variant="secondary" onClick={() => void cargar()} className="min-h-11">Probar de nuevo</Button>
        </div>
      ) : !sesiones ? (
        <p className="font-body text-sm text-slate-secondary" role="status">Cargando tus sesiones...</p>
      ) : (
        <>
          <ul>
            {actual && (
              <li className="py-3 border-t border-slate-200 dark:border-white/10">
                <p className="font-body text-sm font-medium text-navy dark:text-white">{nombreDispositivo(actual.user_agent)}</p>
                <p className="font-body text-xs text-slate-secondary">Este dispositivo</p>
              </li>
            )}
            {visibles.map((s) => {
              const nombre = nombreDispositivo(s.user_agent)
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 py-3 border-t border-slate-200 dark:border-white/10">
                  <span className="min-w-0">
                    <span className="block font-body text-sm font-medium text-navy dark:text-white truncate">{nombre}</span>
                    <span className="block font-body text-xs text-slate-secondary">Último uso {haceCuanto(s.ultimo_uso)}</span>
                  </span>
                  <Button
                    variant="secondary"
                    onClick={() => void cerrarUna(s.id)}
                    loading={cerrando === s.id}
                    loadingLabel="Cerrando"
                    disabled={cerrando !== null}
                    aria-label={`Cerrar sesión de ${nombre}, último uso ${haceCuanto(s.ultimo_uso)}`}
                    className="min-h-11 shrink-0 !px-4 !py-2 text-sm"
                  >
                    Cerrar
                  </Button>
                </li>
              )
            })}
          </ul>

          {otras.length > OTRAS_VISIBLES && !verTodas && (
            <button
              type="button"
              onClick={() => setVerTodas(true)}
              className="toque-texto inline-block font-body text-sm font-medium text-navy dark:text-mint mt-2"
            >
              Ver las otras {otras.length - OTRAS_VISIBLES}
            </button>
          )}

          {otras.length > 0 ? (
            <Button
              variant="secondary"
              onClick={() => void cerrarOtras()}
              loading={cerrando === 'otras'}
              loadingLabel="Cerrando"
              disabled={cerrando !== null}
              className="w-full mt-4"
            >
              {otras.length === 1 ? 'Cerrar la otra sesión' : `Cerrar las otras ${otras.length} sesiones`}
            </Button>
          ) : (
            <p className="font-body text-sm text-slate-secondary pt-3 border-t border-slate-200 dark:border-white/10">
              Tu cuenta no está abierta en ningún otro dispositivo.
            </p>
          )}
        </>
      )}
    </Desplegable>
  )
}
