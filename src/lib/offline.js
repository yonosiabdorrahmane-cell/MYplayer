/**
 * Talks to the service worker about how much of the app shell is cached.
 *
 * This exists for one moment in particular: MYplayer is usually installed from
 * a temporary tunnel, and the tunnel gets closed. Before that happens the phone
 * has to be holding every file it needs, and the only honest way to know is to
 * ask the cache.
 */

const TIMEOUT = 5000;

/** One request/response round trip with the worker over a private channel. */
function ask(worker, message) {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.close();
      reject(new Error('service worker did not answer'));
    }, TIMEOUT);

    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(event.data);
    };

    worker.postMessage(message, [channel.port2]);
  });
}

/**
 * `state` is what to tell the user:
 *   unsupported — no service worker (a plain `http://` origin, or in dev)
 *   none        — nothing registered yet
 *   installing  — registered, still filling the cache
 *   partial     — some files never made it; retry while the tunnel is up
 *   ready       — safe to close the tunnel
 */
export async function offlineStatus({ repair = false } = {}) {
  if (!('serviceWorker' in navigator)) return { state: 'unsupported', ready: false };

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return { state: 'none', ready: false };

  const worker = navigator.serviceWorker.controller ?? registration.active;
  if (!worker) return { state: 'installing', ready: false };

  try {
    const status = await ask(worker, repair ? 'offline-repair' : 'offline-status');
    return { ...status, state: status.ready ? 'ready' : 'partial' };
  } catch {
    return { state: 'installing', ready: false };
  }
}
