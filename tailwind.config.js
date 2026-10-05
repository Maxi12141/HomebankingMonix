/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#001A3D',
          card: '#0D2B52',
        },
        mint: {
          DEFAULT: '#26FFC1',
          hover: '#1FE6AF',
          // Mint tinta: el mint oscurecido para montos sobre fondo claro en
          // modo claro, donde #26FFC1 no se lee (1.3:1 sobre blanco).
          // tinta: montos grandes (text-xl en negrita o más), 3:1 sobre blanco.
          // tinta-fuerte: montos chicos o sobre el gris de la app, 4.5:1 o más.
          tinta: '#00A87A',
          'tinta-fuerte': '#007A5A',
        },
        slate: {
          secondary: 'var(--slate-secondary)',
          input: '#F0F2F5',
        },
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [],
}
