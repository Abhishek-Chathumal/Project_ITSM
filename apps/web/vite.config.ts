import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Where the dev server forwards /api to. Running natively, the API is a sibling
// process on localhost; running under Docker Compose, "localhost" is the web
// container itself, so it must be the api service's name on the compose network.
// Deliberately NOT prefixed with VITE_ — this is a dev-server concern and must never
// be inlined into the client bundle.
const apiProxyTarget = process.env.DEV_API_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
