import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Stamps the built asset list and a fresh cache version into the service
 * worker. Without this the SW can only cache files it has already seen over the
 * network, so the very first offline launch would come up blank.
 */
function precacheServiceWorker() {
  let assets = [];

  return {
    name: 'myplayer:precache-sw',
    apply: 'build',
    generateBundle(_options, bundle) {
      assets = Object.keys(bundle)
        .filter((file) => !file.endsWith('.map'))
        .map((file) => `/${file}`);
    },
    // closeBundle runs after the public directory has been copied, so the
    // untouched sw.js is guaranteed to be on disk by now.
    closeBundle() {
      const target = resolve(__dirname, 'dist/sw.js');
      const source = readFileSync(target, 'utf8')
        .replace('"__PRECACHE_MANIFEST__"', JSON.stringify(assets))
        .replace('__BUILD_ID__', Date.now().toString(36));
      writeFileSync(target, source);
    },
  };
}

/**
 * Vite rejects requests whose Host header it does not recognise, which would
 * otherwise turn every tunnel into a "Blocked request" page. A leading dot
 * matches subdomains, so this covers the random hostname each quick tunnel gets.
 */
const TUNNEL_HOSTS = [
  '.ts.net', // tailscale serve — `npm run phone`
  '.trycloudflare.com',
  '.ngrok-free.app',
  '.ngrok.io',
  '.loca.lt',
];

export default defineConfig({
  plugins: [react(), tailwindcss(), precacheServiceWorker()],
  server: {
    host: true,
    port: 5174,
    allowedHosts: TUNNEL_HOSTS,
  },
  preview: {
    host: true,
    port: 5174,
    allowedHosts: TUNNEL_HOSTS,
  },
  build: {
    target: 'es2022',
  },
});
