export function MissingEnvScreen() {
  return (
    <div className="min-h-screen bg-navy text-white flex items-center justify-center px-6">
      <div className="max-w-xl w-full">
        <p className="font-display text-3xl font-bold tracking-tight mb-2">Monix</p>
        <h1 className="text-xl font-semibold mb-3">Falta configurar el entorno</h1>
        <p className="text-white/70 text-sm leading-relaxed mb-6">
          La pantalla en blanco se debía a que no existe un archivo <code className="text-mint">.env</code> con
          las claves de Supabase. Sin ellas, la app no puede iniciar.
        </p>

        <ol className="space-y-3 text-sm text-white/80 mb-6 list-decimal list-inside">
          <li>
            Copiá <code className="text-mint">.env.example</code> a <code className="text-mint">.env</code> en la raíz del proyecto
          </li>
          <li>
            Completá <code className="text-mint">VITE_SUPABASE_URL</code> y{' '}
            <code className="text-mint">VITE_SUPABASE_ANON_KEY</code> desde tu proyecto en Supabase
            (Settings → API)
          </li>
          <li>
            Opcional: completá las variables del Banco Central (<code className="text-mint">VITE_BC_*</code>)
          </li>
          <li>
            Reiniciá el servidor con <code className="text-mint">npm run dev</code>
          </li>
        </ol>

        <pre className="rounded-xl bg-black/30 border border-white/10 p-4 text-xs text-mint/90 overflow-x-auto whitespace-pre-wrap">
{`# Supabase
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...

# API Banco Central (cátedra)
VITE_BC_URL=/bc-api
VITE_BC_API_KEY=tu_api_key_aqui
VITE_BC_ENV=test`}
        </pre>
      </div>
    </div>
  )
}
