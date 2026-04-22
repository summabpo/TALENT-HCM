import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    /**
     * Solo `/api` va al backend. NO proxyear `/admin`: esas rutas las maneja el SPA
     * (React Router). Un proxy `/admin` → Django hacía que /admin/tenants devolviera 404 del servidor.
     */
    proxy: {
      '/api': {
        // Mismo host/puerto que `manage.py runserver` (cambia a 8000 si aplica)
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
    },
  },
})
