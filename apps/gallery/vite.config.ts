import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

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
  plugins: [react()],
  server: {
    port: 4173
  },
  define: {
    'import.meta.env.VITE_APP_COMMIT': JSON.stringify(process.env.VITE_APP_COMMIT ?? meta.hash),
    'import.meta.env.VITE_APP_BUILD_TIME': JSON.stringify(process.env.VITE_APP_BUILD_TIME ?? meta.time)
  }
});
