import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Defaults to the local server so a fresh clone (or local feature
  // development/testing) never accidentally writes to the real deployed
  // database. See .env.example to point this at Railway instead.
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:3001'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': apiProxyTarget,
      },
    },
  }
})
