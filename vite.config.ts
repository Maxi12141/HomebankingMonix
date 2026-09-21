import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import { VitePWA } from 'vite-plugin-pwa'

const bcProxy = {
  '/bc-api': {
    target: 'https://centralbank.brocoly.cc',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/bc-api/, '/api'),
  },
}

function monixBuildId() {
  return {
    name: 'monix-build-id',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'monix-build.txt',
        source: `${Date.now()}\n`,
      })
    },
  }
}

export default defineConfig({
  plugins: [
    svgr(),
    react(),
    monixBuildId(),
    VitePWA({
      // Registro manual (main.tsx) para poder no registrarlo dentro de la
      // APK de Capacitor y para enganchar el aviso de actualización al mismo
      // patrón de toast que ya usa recargarSiHayBuildNuevo.tsx.
      injectRegister: null,
      registerType: 'prompt',
      manifest: {
        name: 'Monix — Homebanking',
        short_name: 'Monix',
        description: 'Banco digital Monix: cuentas en pesos y dólares, transferencias, tarjeta, préstamos y más.',
        lang: 'es-AR',
        theme_color: '#0D2B52',
        background_color: '#0D2B52',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // El HTML/navegación SIEMPRE se pide fresco si hay red (mismo
        // espíritu que el Cache-Control: no-cache que ya fuerza vercel.json
        // para index.html) — el service worker se mete antes que esos
        // headers, así que si no se overridea acá, cachear el shell dejaría
        // a la gente pegada en una versión vieja para siempre.
        //
        // OJO: precacheAndRoute() registra su propia ruta ANTES que los
        // registerRoute() de runtimeCaching de acá abajo, y esa ruta gana
        // por orden de registro — si index.html quedara precacheado, serviría
        // esa copia vieja sin importar el NetworkFirst de más abajo. Por eso
        // se excluye del precache con globIgnores, no alcanza con
        // navigateFallback: null solo.
        globIgnores: ['index.html'],
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'monix-html',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 5 },
            },
          },
          {
            // JS/CSS con hash en el nombre — Vite les cambia el nombre en
            // cada build, así que cachear agresivo acá es seguro (un archivo
            // viejo nunca se confunde con uno nuevo).
            urlPattern: ({ request }) => request.destination === 'script' || request.destination === 'style',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'monix-assets' },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: bcProxy,
  },
  preview: {
    proxy: bcProxy,
  },
})
