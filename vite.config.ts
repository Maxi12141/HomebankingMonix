import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'

const bcProxy = {
  '/bc-api': {
    target: 'https://centralbank.brocoly.cc',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/bc-api/, '/api'),
  },
}

export default defineConfig({
  plugins: [svgr(), react()],
  server: {
    proxy: bcProxy,
  },
  preview: {
    proxy: bcProxy,
  },
})
