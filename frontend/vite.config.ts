import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Each local/QA backend gets an independent dependency cache.
  cacheDir: `node_modules/.vite-${new URL(process.env.BLAZE_API_TARGET || 'http://127.0.0.1:8765').port || 'default'}`,
  resolve: { dedupe: ['react', 'react-dom'] },
  // Open tabs still import hashed chunks from the previous build.
  build: { emptyOutDir: false },
  server: {
    host: true,
    port: 7777,
    strictPort: true,
    proxy: { '/api': { target: process.env.BLAZE_API_TARGET || 'http://127.0.0.1:8765', changeOrigin: true } },
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
  preview: {
    host: true,
    port: 7777,
    strictPort: true,
  },
})
