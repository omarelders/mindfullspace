import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solidPlugin()],
  resolve: {
    alias: {
      'lucide-solid': fileURLToPath(new URL('./src/utils/icons.js', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: ['solid-js', 'solid-js/web', 'solid-js/store', '@supabase/supabase-js'],
  },
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
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    testTimeout: 15000,
    deps: {
      optimizer: {
        web: {
          include: []
        }
      }
    }
  }
})
