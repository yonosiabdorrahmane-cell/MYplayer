/**
 * MYplayer service worker.
 *
 * The audio itself lives in IndexedDB, so this only has to keep the app shell
 * available offline. Build assets are content-hashed, which makes
 * stale-while-revalidate safe for everything under /assets.
 *
 * The shell is served cache-first, including navigations. That matters when the
 * app was installed from a tunnel: once the tunnel is closed its hostname still
 * resolves, and the edge answers with its own error page rather than failing.
 * A network-first shell would hand that page to the user — and cache it.
 */

// Both placeholders are replaced at build time by the precache-sw Vite plugin.
// The build id changes every deploy, which retires the previous caches.
const BUILD_ASSETS = "__PRECACHE_MANIFEST__";
const VERSION = 'myplayer-__BUILD_ID__';

const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

/**
 * Servers commonly answer with `Vary: Origin` (or `Vary: Accept-Encoding`).
 * A precached entry is stored without those request headers, so strict Vary
 * matching would reject it and every asset would miss while offline.
 * Everything here is same-origin and content-hashed, so ignoring Vary is safe.
 */
const MATCH = { ignoreVary: true };
const SHELL_MATCH = { ignoreVary: true, cacheName: SHELL };

/**
 * Everything the app needs to boot with no network at all. The icons are here
 * because iOS fetches them when the app is added to the Home Screen, which can
 * happen after the tunnel is gone.
 */
const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-256.png',
  '/icons/icon-384.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png',
  ...(Array.isArray(BUILD_ASSETS) ? BUILD_ASSETS : []),
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      // Individual misses (e.g. an icon not generated yet) must not fail
      // install — a shell that is 90% cached still beats no shell at all, and
      // the gaps are reported to the app and refilled by `offline-repair`.
      .then((cache) => Promise.allSettled(SHELL_URLS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Which shell URLs are actually in the cache right now. */
async function auditShell() {
  const cache = await caches.open(SHELL);
  const hits = await Promise.all(SHELL_URLS.map((url) => cache.match(url, MATCH)));
  return SHELL_URLS.filter((_, index) => !hits[index]);
}

/**
 * Reports how much of the shell is cached, so the app can tell the user when it
 * is safe to close the tunnel. With `repair`, missing entries are fetched first
 * — which is the whole point of the retry in Settings.
 */
async function offlineStatus(repair) {
  let missing = await auditShell();

  if (repair && missing.length) {
    const cache = await caches.open(SHELL);
    await Promise.allSettled(missing.map((url) => cache.add(url)));
    missing = await auditShell();
  }

  return {
    version: VERSION,
    total: SHELL_URLS.length,
    cached: SHELL_URLS.length - missing.length,
    missing,
    ready: missing.length === 0,
  };
}

self.addEventListener('message', (event) => {
  const message = event.data;
  if (message === 'skip-waiting') {
    self.skipWaiting();
    return;
  }

  if (message === 'offline-status' || message === 'offline-repair') {
    const port = event.ports?.[0];
    event.waitUntil(
      offlineStatus(message === 'offline-repair').then((status) => port?.postMessage(status)),
    );
  }
});

/** A real page from our own server, rather than an interstitial from the edge. */
function isUsableDocument(response) {
  return (
    response &&
    response.ok &&
    response.type === 'basic' &&
    (response.headers.get('content-type') ?? '').includes('text/html')
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: the cached shell wins immediately, and only a genuine response
  // from our own origin is allowed to replace it.
  //
  // Deliberately no background refresh of the cached page. index.html names the
  // hashed assets of its own build, so the two have to move together or not at
  // all — dropping a newer page into this cache would leave it pointing at
  // assets that were never precached, and the next offline launch would come up
  // blank. Updating is the install step's job: a new build ships a new sw.js,
  // whose install fetches the page *and* its assets into a fresh cache, and
  // activate then drops the old one. Whole shell, or nothing.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cached =
          (await caches.match('/index.html', SHELL_MATCH)) ??
          (await caches.match('/', SHELL_MATCH));

        if (cached) return cached;

        try {
          const fresh = await fetch(request);
          if (isUsableDocument(fresh)) {
            const cache = await caches.open(SHELL);
            await cache.put('/index.html', fresh.clone());
          }
          return fresh;
        } catch {
          return Response.error();
        }
      })(),
    );
    return;
  }

  // Everything else: serve from cache immediately, refresh in the background.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request, MATCH);
      // Hashed assets never change under the same URL, and once the tunnel is
      // down every background fetch is a doomed round trip to the edge.
      if (cached && !self.navigator.onLine) return cached;

      const network = fetch(request)
        .then(async (response) => {
          if (response.ok && response.type === 'basic') {
            const cache = await caches.open(RUNTIME);
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => undefined);

      return cached ?? (await network) ?? Response.error();
    })(),
  );
});
