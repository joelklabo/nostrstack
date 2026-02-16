import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const useReactSrc = command === 'serve';
  const useHttps = process.env.USE_HTTPS !== 'false';
  const configuredSocialPort = Number(process.env.DEV_SERVER_PORT ?? 4173);
  const devServerPort =
    Number.isFinite(configuredSocialPort) && configuredSocialPort > 0 ? configuredSocialPort : 4173;
  return {
    plugins: [
      react({
        // Avoid React Refresh warnings from prebuilt workspace dist files.
        exclude: [/packages\/react\/dist\//],
        babel: {
          compact: true
        }
      }),
      ...(useHttps ? [basicSsl()] : [])
    ],
    server: {
      port: devServerPort,
      host: true,
      strictPort: true
    },
    preview: {
      port: devServerPort,
      host: true,
      strictPort: true
    },
    define: {
      // Some packages (e.g. nostr-tools) expect global Buffer.
      // Deno doesn't have it, and Node polyfills it in browser builds.
      // Provide a shim here.
      'process.env': {},
      global: {},
      'global.Buffer': 'globalThis.Buffer' // Vite 5.x needs explicit global
    },
    resolve: {
      alias: [
        // Polyfill Buffer for nostr-tools in browser environment
        { find: 'buffer', replacement: path.resolve(__dirname, 'node_modules/buffer') },
        ...(useReactSrc
          ? [
              {
                find: /^@nostrstack\/react$/,
                replacement: path.resolve(__dirname, '../../packages/react/src/index.ts')
              }
            ]
          : [])
      ]
    }
  };
});
