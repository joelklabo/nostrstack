import { execSync } from 'node:child_process';

import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';

function gitMeta() {
  try {
    const hash = execSync('git rev-parse --short HEAD').toString().trim();
    const time = new Date().toISOString();
    return { hash, time };
  } catch {
    return { hash: 'dev', time: new Date().toISOString() };
  }
}

const meta = gitMeta();

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    port: 4173,
    host: true,
    https: true,
    proxy: {
      '/api': {
        target: 'https://localhost:3001',
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy) => {
          proxy.on('error', () => {
            /* swallow noisy dev proxy errors when API restarts */
          });
        }
      },
      '/ws': {
        target: 'https://localhost:3001',
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path,
        configure: (proxy) => {
          proxy.on('error', () => {
            /* swallow noisy dev proxy errors when API restarts */
          });
        }
      }
    }
  },
  define: {
    'import.meta.env.VITE_APP_COMMIT': JSON.stringify(process.env.VITE_APP_COMMIT ?? meta.hash),
    'import.meta.env.VITE_APP_BUILD_TIME': JSON.stringify(process.env.VITE_APP_BUILD_TIME ?? meta.time)
  }
});
