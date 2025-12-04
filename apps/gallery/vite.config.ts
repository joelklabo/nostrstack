import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import react from '@vitejs/plugin-react';
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
const root = path.resolve(__dirname, '..', '..');
const devCert = path.resolve(root, 'certs', 'dev-cert.pem');
const devKey = path.resolve(root, 'certs', 'dev-key.pem');
const httpsConfig =
  fs.existsSync(devCert) && fs.existsSync(devKey)
    ? {
        key: fs.readFileSync(devKey),
        cert: fs.readFileSync(devCert)
      }
    : true; // fallback to vite self-signed

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4173,
    host: true,
    https: httpsConfig,
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
