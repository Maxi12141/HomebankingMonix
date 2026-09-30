import { Bluetooth, Radar, ShieldCheck, UserPlus } from 'lucide-react'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useCerca } from '../hooks/useCerca'
import type { PersonaCerca } from '../services/cerca'

function lineaDetalle(p: PersonaCerca) {
  const nombre = `${p.nombre} ${p.apellido}`.trim()
  const dist = p.metros != null ? ` · ${p.metros} m` : ''
  return `${nombre} · ${p.banco}${dist}`
}

export function CercaPage() {
  const cerca = useCerca()

  return (
    <PageWrapper>
      <div className="max-w-lg mx-auto">
        <h1 className="font-display text-2xl font-semibold text-navy dark:text-white">
          Monix Cerca
        </h1>
        <p className="font-body text-sm text-slate-secondary mt-1 mb-6">
          Activá Bluetooth: aparecen los que están cerca, con su alias. Después transferís o los guardás en contactos.
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
              {cerca.buscando ? 'Buscando personas cerca…' : 'Bluetooth apagado'}
            </p>
            <p className="font-body text-xs text-slate-secondary mt-1 max-w-sm mb-4">
              Los dos tienen que tocar Activar. Vas a ver el alias y el banco. El CBU aparece recién cuando transferís.
            </p>
            {cerca.buscando ? (
              <Button variant="secondary" type="button" onClick={() => { void cerca.stopBusqueda() }}>
                Dejar de buscar
              </Button>
            ) : (
              <Button type="button" onClick={() => { void cerca.startBusqueda() }}>
                Activar Bluetooth
              </Button>
            )}
          </div>
        </Card>

        {cerca.error && (
          <p className="text-sm text-red-500 dark:text-red-400 font-body bg-red-50 dark:bg-red-400/10 rounded-xl px-4 py-3 mb-4">
            {cerca.error}
          </p>
        )}

        <div className="mb-6">
          <p className="font-body text-xs text-slate-secondary uppercase tracking-wider mb-3">
            Personas cerca
          </p>
          {cerca.nearby.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="font-body text-sm text-slate-secondary">
                Nadie cerca todavía. Pedile al otro que toque Activar Bluetooth en Monix Cerca.
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {cerca.nearby.map((p) => (
                <Card key={p.token} className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-mint/20 text-mint flex items-center justify-center font-body font-bold text-sm">
                      {(p.nombre[0] ?? '').toUpperCase()}{(p.apellido[0] ?? '').toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-sm font-medium text-navy dark:text-white truncate">
                        {p.alias ? `@${p.alias}` : `${p.nombre} ${p.apellido}`}
                      </p>
                      <p className="font-body text-xs text-slate-secondary truncate">
                        {lineaDetalle(p)}
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
            Galicia, Mercado Pago u otro banco no mandan su alias por Bluetooth. Cerca ve a quien tenga Monix abierto y visible. Si te pasan un CBU o alias, también lo resolvemos y te decimos el banco.
          </p>
        </Card>
      </div>
    </PageWrapper>
  )
}
