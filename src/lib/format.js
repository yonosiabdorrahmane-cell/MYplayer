/** Small shared formatting + platform helpers. */

/** 0 → "0:00", 3725 → "62:05" (iOS keeps counting minutes past an hour in players). */
export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

/** Remaining time reads as "-1:23" under the scrubber. */
export function formatRemaining(seconds) {
  return `-${formatTime(seconds)}`;
}

/** "1 hour, 12 minutes" style summary for album/playlist headers. */
export function formatDuration(totalSeconds) {
  const seconds = Math.round(totalSeconds || 0);
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourLabel = `${hours} hour${hours === 1 ? '' : 's'}`;
  return rest ? `${hourLabel}, ${rest} minute${rest === 1 ? '' : 's'}` : hourLabel;
}

export function formatBytes(bytes) {
  if (!bytes) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/** Sort key that ignores leading articles, matching how iOS sorts a library. */
export function sortKey(value) {
  return (value ?? '')
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, '')
    .trim();
}

/** The letter a row files under in an indexed list. */
export function sectionLetter(value) {
  const key = sortKey(value);
  const first = key[0]?.toUpperCase() ?? '#';
  return first >= 'A' && first <= 'Z' ? first : '#';
}

export const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

export function byName(selector) {
  return (a, b) => collator.compare(sortKey(selector(a)), sortKey(selector(b)));
}

/**
 * Haptic tap. Real Taptic Engine feedback isn't exposed to web apps on iOS, so
 * this is a no-op there and a genuine tick on Android — worth wiring up either way.
 */
export function haptic(pattern = 8) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function uid() {
  return crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Stable identity for grouping, so "Abbey Road" by one artist is one album. */
export const albumKeyOf = (track) =>
  `${sortKey(track.albumArtist || track.artist)}::${sortKey(track.album)}`;

export const artistKeyOf = (track) => sortKey(track.albumArtist || track.artist);
