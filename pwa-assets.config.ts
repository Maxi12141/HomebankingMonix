import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Genera los íconos de manifest/apple-touch/maskable a partir del ícono
// fuente de 1024x1024 que ya existía en public/ — no hace falta diseñar nada
// nuevo. Correr con: npx pwa-assets-generator
//
// El preset "minimal2023" por default rellena el padding de maskable/apple
// con blanco — como nuestro ícono ya tiene su propio fondo navy pegado al
// borde, ese blanco se veía como un recuadro feo alrededor. Se pisa acá para
// que el relleno sea el mismo navy de la marca, no blanco.
const NAVY = '#001a3d'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: { fit: 'contain', background: NAVY },
    },
    apple: {
      ...minimal2023Preset.apple,
      padding: 0.02,
      resizeOptions: { fit: 'contain', background: NAVY },
    },
  },
  images: ['public/monix-icon.png'],
})
