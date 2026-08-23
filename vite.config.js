import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    allowedHosts: [
      'sb-2xodzyue34as.vercel.run'
    ]
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'supabase-vendor': ['@supabase/supabase-js'],
          'lucide-icons': ['lucide-react'],
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js'
  }
})
