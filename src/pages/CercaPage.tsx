import { Bluetooth, Radar, ShieldCheck } from 'lucide-react'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { useCerca } from '../hooks/useCerca'

export function CercaPage() {
  const cerca = useCerca()

  return (
    <PageWrapper>
      <div className="max-w-lg mx-auto">
        <h1 className="font-display text-2xl font-semibold text-navy dark:text-white">
          Monix Cerca
        </h1>
        <p className="font-body text-sm text-slate-secondary mt-1 mb-6">
          Acercá tu celular a otro con Monix. Se identifica el nombre y el alias, y podés transferir al toque.
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
              {cerca.buscando ? 'Buscando celulares cerca…' : 'Listo para acercar'}
            </p>
            <p className="font-body text-xs text-slate-secondary mt-1 max-w-sm">
              {cerca.caps.native
                ? 'Con la APK, el otro no necesita tener Monix abierto: queda visible en segundo plano.'
                : 'En el navegador funciona al tocar con NFC (Chrome Android) o con la APK para Bluetooth de fondo.'}
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
                Todavía no detectamos a nadie. Acercá los teléfonos o tocá una tarjeta Monix.
              </p>
              {!cerca.buscando && (
                <Button className="mt-4" type="button" onClick={() => { void cerca.startBusqueda() }}>
                  Buscar ahora
                </Button>
              )}
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {cerca.nearby.map((p) => (
                <button
                  key={p.token}
                  type="button"
                  onClick={() => { void cerca.transferirA(p.token) }}
                  className="text-left"
                >
                  <Card className="px-4 py-3.5 flex items-center gap-3 hover:bg-navy/5 dark:hover:bg-white/5 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-mint/20 text-mint flex items-center justify-center font-body font-bold text-sm">
                      {(p.nombre[0] ?? '').toUpperCase()}{(p.apellido[0] ?? '').toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-sm font-medium text-navy dark:text-white truncate">
                        {p.nombre} {p.apellido}
                      </p>
                      <p className="font-body text-xs text-slate-secondary truncate">
                        {p.alias ? `@${p.alias}` : 'Alias oculto'}
                      </p>
                    </div>
                    <span className="text-xs font-body text-mint shrink-0">Transferir</span>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </div>

        <Card className="p-5 flex items-start gap-3">
          <ShieldCheck size={18} className="text-mint shrink-0 mt-0.5" />
          <p className="font-body text-xs text-slate-secondary leading-relaxed">
            El Bluetooth solo manda un token de 30 minutos. El nombre y el alias se resuelven en el servidor.
            El CBU aparece recién cuando confirmás la transferencia.
          </p>
        </Card>
      </div>
    </PageWrapper>
  )
}
