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
  plugins: [svgr(), react(), monixBuildId()],
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
