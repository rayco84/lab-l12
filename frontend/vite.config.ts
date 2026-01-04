import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'build'
    },
resolve: {
  alias: {
    crypto: 'crypto-browserify'
  }
},
optimizeDeps: {
  esbuildOptions: {
    define: {
      global: 'globalThis'
    }
  }
 }
})
