import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 7777,
    strictPort: true,
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
