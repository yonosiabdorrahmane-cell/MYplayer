/**
 * Object-URL cache for cover art.
 *
 * Artwork is requested constantly (every list row, the mini player, Now Playing),
 * so blobs are resolved once per track and the URL is reused for the session.
 * In-flight lookups are shared to avoid a stampede when a list scrolls fast.
 */

import { getArtworkBlob } from './db.js';

const urls = new Map(); // trackId -> object URL (or null when the track has no art)
const pending = new Map(); // trackId -> Promise

export function peekArtworkURL(trackId) {
  return urls.get(trackId);
}

export function getArtworkURL(trackId) {
  if (!trackId) return Promise.resolve(null);
  if (urls.has(trackId)) return Promise.resolve(urls.get(trackId));
  if (pending.has(trackId)) return pending.get(trackId);

  const promise = getArtworkBlob(trackId)
    .then((blob) => {
      const url = blob ? URL.createObjectURL(blob) : null;
      urls.set(trackId, url);
      pending.delete(trackId);
      return url;
    })
    .catch(() => {
      urls.set(trackId, null);
      pending.delete(trackId);
      return null;
    });

  pending.set(trackId, promise);
  return promise;
}

/* ------------------------------------------------- lock screen artwork --- */

const LOCK_SIZES = [96, 192, 256, 384, 512];
const mediaCache = new Map(); // trackId -> artwork[] for MediaMetadata

/**
 * Cover art prepared for the lock screen / Control Centre.
 *
 * Three things matter here and all three were wrong before:
 *  - iOS is unreliable about `blob:` URLs inside MediaMetadata and frequently
 *    shows nothing at all, so each size is baked to a `data:` URL instead;
 *  - the platform picks the entry closest to the size it wants, so the sizes
 *    reported have to be real rather than an optimistic "512x512";
 *  - the MIME type has to match what was actually encoded.
 *
 * Non-square covers are centre-cropped, the way Music renders them.
 */
export async function getMediaSessionArtwork(trackId) {
  if (!trackId) return [];
  if (mediaCache.has(trackId)) return mediaCache.get(trackId);

  const url = await getArtworkURL(trackId);
  if (!url) return [];

  try {
    const image = await loadImage(url);
    const source = Math.min(image.naturalWidth, image.naturalHeight);
    if (!source) return [];

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const artwork = [];

    for (const size of LOCK_SIZES) {
      // Never upscale past the original — it only inflates the data URL.
      const edge = Math.min(size, source);
      canvas.width = edge;
      canvas.height = edge;
      ctx.clearRect(0, 0, edge, edge);
      ctx.drawImage(
        image,
        (image.naturalWidth - source) / 2,
        (image.naturalHeight - source) / 2,
        source,
        source,
        0,
        0,
        edge,
        edge,
      );
      artwork.push({
        src: canvas.toDataURL('image/jpeg', 0.86),
        sizes: `${edge}x${edge}`,
        type: 'image/jpeg',
      });
      if (edge === source) break; // already at native resolution
    }

    mediaCache.set(trackId, artwork);
    return artwork;
  } catch {
    return [];
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export function releaseArtwork(trackId) {
  mediaCache.delete(trackId);
  const url = urls.get(trackId);
  if (url) URL.revokeObjectURL(url);
  urls.delete(trackId);
  pending.delete(trackId);
}

export function releaseAllArtwork() {
  for (const url of urls.values()) if (url) URL.revokeObjectURL(url);
  urls.clear();
  pending.clear();
  mediaCache.clear();
}
