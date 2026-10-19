/**
 * IndexedDB layer.
 *
 * Audio and artwork are stored as Blobs in their own object stores so track
 * metadata stays cheap to read in bulk — the library list never has to pull
 * megabytes of audio into memory.
 */

const DB_NAME = 'myplayer';
const DB_VERSION = 1;

export const STORE = {
  tracks: 'tracks',
  audio: 'audio',
  artwork: 'artwork',
  playlists: 'playlists',
  meta: 'meta',
};

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE.tracks)) {
        const tracks = db.createObjectStore(STORE.tracks, { keyPath: 'id' });
        tracks.createIndex('album', 'albumKey');
        tracks.createIndex('artist', 'artistKey');
        tracks.createIndex('addedAt', 'addedAt');
      }
      if (!db.objectStoreNames.contains(STORE.audio)) {
        db.createObjectStore(STORE.audio, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE.artwork)) {
        db.createObjectStore(STORE.artwork, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE.playlists)) {
        db.createObjectStore(STORE.playlists, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE.meta)) {
        db.createObjectStore(STORE.meta, { keyPath: 'key' });
      }

      // Safari occasionally leaves a blocked upgrade hanging; surfacing it here
      // beats a silent stall on first launch.
      event.target.transaction.onabort = () => reject(event.target.transaction.error);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

const req = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

/* ------------------------------------------------------------------ tracks */

export async function getAllTracks() {
  const db = await openDB();
  return req(db.transaction(STORE.tracks).objectStore(STORE.tracks).getAll());
}

export async function putTrack(track, { audio, artwork } = {}) {
  const db = await openDB();
  const stores = [STORE.tracks];
  if (audio) stores.push(STORE.audio);
  if (artwork) stores.push(STORE.artwork);

  const transaction = db.transaction(stores, 'readwrite');
  transaction.objectStore(STORE.tracks).put(track);
  if (audio) transaction.objectStore(STORE.audio).put({ id: track.id, blob: audio });
  if (artwork) transaction.objectStore(STORE.artwork).put({ id: track.id, blob: artwork });

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(track);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function updateTrack(id, patch) {
  const db = await openDB();
  const transaction = db.transaction(STORE.tracks, 'readwrite');
  const store = transaction.objectStore(STORE.tracks);
  const existing = await req(store.get(id));
  if (!existing) return null;
  const next = { ...existing, ...patch };
  store.put(next);
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(next);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function deleteTrack(id) {
  const db = await openDB();
  const transaction = db.transaction(
    [STORE.tracks, STORE.audio, STORE.artwork, STORE.playlists],
    'readwrite',
  );
  transaction.objectStore(STORE.tracks).delete(id);
  transaction.objectStore(STORE.audio).delete(id);
  transaction.objectStore(STORE.artwork).delete(id);

  // Drop the track from every playlist that references it.
  const playlists = transaction.objectStore(STORE.playlists);
  const all = await req(playlists.getAll());
  for (const playlist of all) {
    if (playlist.trackIds.includes(id)) {
      playlists.put({
        ...playlist,
        trackIds: playlist.trackIds.filter((trackId) => trackId !== id),
        updatedAt: Date.now(),
      });
    }
  }

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getAudioBlob(id) {
  const db = await openDB();
  const record = await req(db.transaction(STORE.audio).objectStore(STORE.audio).get(id));
  return record?.blob ?? null;
}

export async function putArtwork(id, blob) {
  const db = await openDB();
  const transaction = db.transaction(STORE.artwork, 'readwrite');
  transaction.objectStore(STORE.artwork).put({ id, blob });
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getArtworkBlob(id) {
  const db = await openDB();
  const record = await req(db.transaction(STORE.artwork).objectStore(STORE.artwork).get(id));
  return record?.blob ?? null;
}

/* --------------------------------------------------------------- playlists */

export async function getAllPlaylists() {
  const db = await openDB();
  return req(db.transaction(STORE.playlists).objectStore(STORE.playlists).getAll());
}

export async function putPlaylist(playlist) {
  const db = await openDB();
  const transaction = db.transaction(STORE.playlists, 'readwrite');
  transaction.objectStore(STORE.playlists).put(playlist);
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(playlist);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function deletePlaylist(id) {
  const db = await openDB();
  const transaction = db.transaction(STORE.playlists, 'readwrite');
  transaction.objectStore(STORE.playlists).delete(id);
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/* -------------------------------------------------------------------- meta */

export async function getMeta(key, fallback = null) {
  const db = await openDB();
  const record = await req(db.transaction(STORE.meta).objectStore(STORE.meta).get(key));
  return record ? record.value : fallback;
}

export async function setMeta(key, value) {
  const db = await openDB();
  const transaction = db.transaction(STORE.meta, 'readwrite');
  transaction.objectStore(STORE.meta).put({ key, value });
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(value);
    transaction.onerror = () => reject(transaction.error);
  });
}

/* ------------------------------------------------------------------- misc */

export async function estimateUsage() {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}

export async function clearLibrary() {
  const db = await openDB();
  const names = [STORE.tracks, STORE.audio, STORE.artwork, STORE.playlists];
  const transaction = db.transaction(names, 'readwrite');
  for (const name of names) transaction.objectStore(name).clear();
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
