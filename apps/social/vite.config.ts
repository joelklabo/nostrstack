import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const useReactSrc = command === 'serve';
  const useHttps = process.env.USE_HTTPS !== 'false';
  const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:3001';
  const devServerPort = Number(process.env.DEV_SERVER_PORT || 4173);

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
      strictPort: true,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false
        },
        '/ws': {
          target: apiProxyTarget,
          ws: true,
          changeOrigin: true,
          secure: false
        }
      }
    },
    preview: {
      port: 4173,
      host: true
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
        // Force a single React runtime across workspace packages to prevent invalid hook-call warnings.
        { find: /^react$/, replacement: path.resolve(__dirname, 'node_modules/react') },
        { find: /^react-dom$/, replacement: path.resolve(__dirname, 'node_modules/react-dom') },
        {
          find: /^react\/jsx-runtime$/,
          replacement: path.resolve(__dirname, 'node_modules/react/jsx-runtime.js')
        },
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
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'nostr-tools',
        '@nostrstack/react',
        '@nostrstack/ui',
        '@nostrstack/widgets'
      ]
    }
  };
});
