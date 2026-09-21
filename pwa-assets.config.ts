import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Genera los íconos de manifest/apple-touch/maskable a partir del ícono
// fuente de 1024x1024 que ya existía en public/ — no hace falta diseñar nada
// nuevo. Correr con: npx pwa-assets-generator
export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/monix-icon.png'],
})
