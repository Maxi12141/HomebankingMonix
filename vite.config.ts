import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'

export default defineConfig({
  plugins: [svgr(), react()],
  server: {
    proxy: {
      '/bc-api': {
        target: 'https://centralbank.brocoly.cc',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bc-api/, '/api'),
      },
    },
  },
})
