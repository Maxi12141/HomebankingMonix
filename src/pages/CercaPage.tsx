import { useState } from 'react'
import toast from 'react-hot-toast'
import { Bluetooth, Radar, ShieldCheck, UserPlus, Search } from 'lucide-react'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useCerca } from '../hooks/useCerca'
import { useCuenta } from '../hooks/useCuenta'
import type { PersonaCerca } from '../services/cerca'

function coincide(p: PersonaCerca, q: string) {
  const t = q.trim().toLowerCase()
  if (!t) return true
  const hay = [
    p.nombre,
    p.apellido,
    `${p.nombre} ${p.apellido}`,
    p.alias ?? '',
    p.banco,
    p.cbu ?? '',
  ]
    .join(' ')
    .toLowerCase()
  return hay.includes(t)
}

export function CercaPage() {
  const cerca = useCerca()
  const { cuenta } = useCuenta()
  const [copiado, setCopiado] = useState(false)
  const listadas = cerca.nearby.filter((p) => coincide(p, cerca.filtro))

  async function copiarAlias() {
    if (!cuenta?.alias) return
    try {
      await navigator.clipboard.writeText(cuenta.alias)
      setCopiado(true)
      toast.success('Alias copiado: pasáselo al otro para que te filtre')
      window.setTimeout(() => setCopiado(false), 2000)
    } catch {
      toast.error('No se pudo copiar el alias')
    }
  }

  return (
    <PageWrapper>
      <div className="max-w-lg mx-auto">
        <h1 className="font-display text-2xl font-semibold text-navy dark:text-white">
          Monix Cerca
        </h1>
        <p className="font-body text-sm text-slate-secondary mt-1 mb-6">
          Filtrá por alias, CBU, nombre o banco. Si los dos tienen Cerca visible, aparecen acá aunque no tengas NFC ni Bluetooth.
        </p>

        <Card className="p-6 mb-4 overflow-hidden relative">
          <div className="absolute inset-0 pointer-events-none opacity-40">
            <div className={`absolute left-1/2 top-24 -translate-x-1/2 w-40 h-40 rounded-full border border-mint/40 ${cerca.buscando ? 'animate-ping' : ''}`} />
            <div className="absolute left-1/2 top-16 -translate-x-1/2 w-56 h-56 rounded-full border border-mint/20" />
          </div>
          <div className="relative flex flex-col items-center text-center py-4">
            <div className="w-16 h-16 rounded-full bg-mint/15 text-mint flex items-center justify-center mb-4">
              {cerca.buscando ? <Radar size={28} /> : <Bluetooth size={28} />}
            </div>
            <p className="font-display font-semibold text-navy dark:text-white">
              {cerca.buscando ? 'Buscando personas visibles…' : 'Listo para encontrar'}
            </p>
            <p className="font-body text-xs text-slate-secondary mt-1 max-w-sm">
              Pedile al otro que active “Visible aunque cierre la app”. También podés escribir su alias o CBU, de Monix o de otro banco.
            </p>
          </div>
        </Card>

        <Card className="p-5 mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-body text-sm font-medium text-navy dark:text-white">
              Visible aunque cierre la app
            </p>
            <p className="font-body text-xs text-slate-secondary mt-0.5">
              Publica un código rotativo. Nunca se transmite tu CBU.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={cerca.visible}
            onClick={() => { void cerca.setVisible(!cerca.visible) }}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              cerca.visible ? 'bg-mint' : 'bg-slate-300 dark:bg-white/15'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                cerca.visible ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </Card>

        <div className="mb-4">
          <Input
            value={cerca.filtro}
            onChange={(e) => cerca.setFiltro(e.target.value)}
            placeholder="Alias, CBU, nombre o banco"
            aria-label="Filtrar personas"
            autoComplete="off"
          />
          {cuenta?.alias && (
            <button
              type="button"
              onClick={() => { void copiarAlias() }}
              className="mt-2 text-xs font-body text-mint hover:underline"
            >
              {copiado ? 'Alias copiado' : `Tu alias es @${cuenta.alias} · copiar`}
            </button>
          )}
        </div>

        {cerca.error && (
          <p className="text-sm text-red-500 dark:text-red-400 font-body bg-red-50 dark:bg-red-400/10 rounded-xl px-4 py-3 mb-4">
            {cerca.error}
          </p>
        )}

        <div className="mb-6">
          <p className="font-body text-xs text-slate-secondary uppercase tracking-wider mb-3">
            Personas {cerca.filtro.trim() ? 'encontradas' : 'cerca'}
          </p>
          {listadas.length === 0 ? (
            <Card className="p-6 text-center">
              <Search size={22} className="mx-auto mb-2 text-slate-secondary" />
              <p className="font-body text-sm text-slate-secondary">
                {cerca.filtro.trim()
                  ? 'Nadie coincide con ese filtro. Probá el alias o el CBU completo.'
                  : 'Todavía no hay nadie visible. Activá Cerca los dos, o escribí alias/CBU para buscar en la red.'}
              </p>
              {!cerca.buscando && (
                <Button className="mt-4" type="button" onClick={() => { void cerca.startBusqueda() }}>
                  Buscar ahora
                </Button>
              )}
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {listadas.map((p) => (
                <Card key={p.token} className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-mint/20 text-mint flex items-center justify-center font-body font-bold text-sm">
                      {(p.nombre[0] ?? '').toUpperCase()}{(p.apellido[0] ?? '').toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-sm font-medium text-navy dark:text-white truncate">
                        {p.nombre} {p.apellido}
                      </p>
                      <p className="font-body text-xs text-slate-secondary truncate">
                        {p.banco}
                        {p.alias ? ` · @${p.alias}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="secondary"
                      className="flex-1 !py-2 text-sm"
                      type="button"
                      disabled={cerca.esContacto(p.token)}
                      onClick={() => { void cerca.guardarContacto(p.token) }}
                    >
                      <span className="inline-flex items-center justify-center gap-1.5">
                        <UserPlus size={14} />
                        {cerca.esContacto(p.token) ? 'Guardado' : 'Contacto'}
                      </span>
                    </Button>
                    <Button
                      className="flex-1 !py-2 text-sm"
                      type="button"
                      onClick={() => { void cerca.transferirA(p.token) }}
                    >
                      Transferir
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Card className="p-5 flex items-start gap-3">
          <ShieldCheck size={18} className="text-mint shrink-0 mt-0.5" />
          <p className="font-body text-xs text-slate-secondary leading-relaxed">
            El CBU no se muestra en la lista. Aparece cuando transferís o guardás el contacto. El Bluetooth solo ayuda en la APK; en la PWA alcanza con Cerca visible o con alias/CBU.
          </p>
        </Card>
      </div>
    </PageWrapper>
  )
}
