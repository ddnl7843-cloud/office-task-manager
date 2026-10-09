import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

function pwaUpdatePlugin(): Plugin {
  return {
    name: 'paisa-pwa-update',
    apply: 'build',
    generateBundle(_options, bundle) {
      const bundledFiles = Object.values(bundle).filter((output) =>
        output.type === 'chunk' ||
        output.fileName === 'index.html' ||
        /\.(?:css|woff2?|ttf|otf)$/i.test(output.fileName)
      );
      const publicFiles = [
        'office-task-icon.png',
        'paisafin-app-icon-192.png',
        'paisafin-app-icon-512.png',
        'paisafin-apple-touch-icon.png',
        'manifest.webmanifest',
      ];
      const files = [...new Set([
        'index.html',
        ...bundledFiles.map((output) => output.fileName),
        ...publicFiles,
      ])].sort();
      const versionHash = createHash('sha256');
      for (const fileName of files) {
        versionHash.update(fileName);
        const output = bundle[fileName];
        if (output) {
          versionHash.update(output.type === 'chunk' ? output.code : output.source);
        } else if (fileName === 'index.html') {
          versionHash.update(readFileSync(path.resolve(__dirname, 'index.html')));
        } else if (publicFiles.includes(fileName)) {
          versionHash.update(readFileSync(path.resolve(__dirname, 'public', fileName)));
        }
      }
      const cacheName = `paisafin-app-${versionHash.digest('hex').slice(0, 16)}`;
      const serviceWorker = `
const CACHE_NAME = ${JSON.stringify(cacheName)};
const PRECACHE_URLS = ${JSON.stringify(files.map((fileName) => `/${fileName}`))};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith('paisafin-app-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin || requestUrl.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cacheKey = event.request.mode === 'navigate' ? '/index.html' : event.request;
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
      return fetch(event.request);
    })
  );
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorker });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), pwaUpdatePlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
