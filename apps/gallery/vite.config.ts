import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const useBlogKitSrc = command === 'serve';
  return {
    plugins: [
      react({
        // Avoid React Refresh warnings from prebuilt workspace dist files.
        exclude: [/packages\/blog-kit\/dist\//],
        babel: {
          compact: true
        }
      }),
      basicSsl()
    ],
    server: {
      port: 4173,
      host: true
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
      'global': {},
      'global.Buffer': 'globalThis.Buffer' // Vite 5.x needs explicit global
    },
    resolve: {
      alias: [
        // Polyfill Buffer for nostr-tools in browser environment
        { find: 'buffer', replacement: path.resolve(__dirname, 'node_modules/buffer') },
        ...(useBlogKitSrc
          ? [
              {
                find: /^@nostrstack\/blog-kit$/,
                replacement: path.resolve(__dirname, '../../packages/blog-kit/src/index.ts')
              }
            ]
          : [])
      ]
    }
  };
});
