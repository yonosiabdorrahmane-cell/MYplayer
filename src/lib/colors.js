/**
 * Pulls a small palette out of album artwork so Now Playing can wash the screen
 * in the record's own colours, the way Apple Music does.
 *
 * The approach is a coarse 3-bit-per-channel histogram: fast, stable between
 * runs, and good enough that the result always feels like it came from the art.
 */

const cache = new Map();

const SAMPLE = 40; // artwork is downscaled to 40x40 before counting

function relativeLuminance({ r, g, b }) {
  const channel = (value) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function toHSL({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) return { h: 0, s: 0, l };

  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let h;
  if (max === rn) h = ((gn - bn) / delta + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / delta + 2) / 6;
  else h = ((rn - gn) / delta + 4) / 6;

  return { h: h * 360, s, l };
}

const css = ({ r, g, b }, alpha = 1) =>
  alpha === 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${alpha})`;

/** Nudges a colour into a range that still looks good behind white controls. */
function toBackdrop(colour) {
  const { h, s, l } = toHSL(colour);
  const clampedS = Math.min(0.72, Math.max(0.22, s));
  const clampedL = Math.min(0.46, Math.max(0.16, l));
  return `hsl(${h.toFixed(0)} ${(clampedS * 100).toFixed(0)}% ${(clampedL * 100).toFixed(0)}%)`;
}

/**
 * The same hue, forced into a range that reads as an accent on a near-black UI.
 *
 * Album art is full of colours that are perfectly nice in a cover and useless
 * as an interface accent — muddy browns, near-blacks, washed pastels. Pinning
 * saturation and lightness keeps the song's identity while guaranteeing the
 * result is legible as a tint, a rim and a text colour.
 */
function toAccent(colour, { light = 0.66, sat = 0.82 } = {}) {
  const { h, s } = toHSL(colour);
  // A greyscale cover has no hue worth keeping; lend it the house violet.
  const hue = s < 0.08 ? 258 : h;
  const saturation = s < 0.08 ? 0.62 : Math.min(sat, Math.max(0.5, s * 1.35));
  return `hsl(${hue.toFixed(0)} ${(saturation * 100).toFixed(0)}% ${(light * 100).toFixed(0)}%)`;
}

/** Aurora blobs are large and heavily overlapped, so they stay faint. */
function toAurora(colour, alpha) {
  const { h, s } = toHSL(colour);
  const hue = s < 0.08 ? 258 : h;
  const saturation = s < 0.08 ? 0.55 : Math.min(0.85, Math.max(0.45, s * 1.3));
  return `hsla(${hue.toFixed(0)}, ${(saturation * 100).toFixed(0)}%, 52%, ${alpha})`;
}

const FALLBACK = {
  primary: 'rgb(94 92 100)',
  backdrop: ['hsl(240 14% 26%)', 'hsl(280 16% 18%)', 'hsl(240 12% 12%)'],
  accent: 'hsl(258 62% 66%)',
  accent2: 'hsl(288 58% 62%)',
  glow: 'hsla(258, 62%, 66%, 0.45)',
  aurora: ['hsla(258, 55%, 52%, 0.30)', 'hsla(288, 55%, 52%, 0.24)', 'hsla(228, 55%, 52%, 0.22)'],
  isDark: true,
};

/**
 * @param {string} src object URL for the artwork
 * @param {string} key cache key (track/album id)
 */
export async function paletteFromImage(src, key) {
  if (!src) return FALLBACK;
  if (key && cache.has(key)) return cache.get(key);

  try {
    const image = await loadImage(src);
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE;
    canvas.height = SAMPLE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, SAMPLE, SAMPLE);
    const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE);

    // Bucket into a 3-bit-per-channel cube, keeping a running average per bucket.
    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 128) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const bucket = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
      const existing = buckets.get(bucket);
      if (existing) {
        existing.count += 1;
        existing.r += r;
        existing.g += g;
        existing.b += b;
      } else {
        buckets.set(bucket, { count: 1, r, g, b });
      }
    }

    if (buckets.size === 0) throw new Error('empty artwork');

    const ranked = [...buckets.values()]
      .map((bucket) => ({
        r: Math.round(bucket.r / bucket.count),
        g: Math.round(bucket.g / bucket.count),
        b: Math.round(bucket.b / bucket.count),
        count: bucket.count,
      }))
      .map((colour) => {
        const { s, l } = toHSL(colour);
        // Prefer colours that are both common and actually colourful; near-black
        // and near-white regions are usually background, not identity.
        const vibrance = s * (1 - Math.abs(l - 0.5) * 1.2);
        return { ...colour, score: colour.count * (0.35 + vibrance) };
      })
      .sort((a, b) => b.score - a.score);

    const primary = ranked[0];
    const support = ranked.slice(1, 6);
    const distinct =
      support.find((colour) => Math.abs(toHSL(colour).h - toHSL(primary).h) > 25) ??
      support[0] ??
      primary;

    const third = ranked[2] ?? distinct;

    const palette = {
      primary: css(primary),
      backdrop: [
        toBackdrop(primary),
        toBackdrop(distinct),
        toBackdrop({
          r: Math.round(primary.r * 0.45),
          g: Math.round(primary.g * 0.45),
          b: Math.round(primary.b * 0.45),
        }),
      ],
      accent: toAccent(primary),
      accent2: toAccent(distinct, { light: 0.62 }),
      glow: toAurora(primary, 0.5),
      aurora: [toAurora(primary, 0.32), toAurora(distinct, 0.26), toAurora(third, 0.22)],
      isDark: relativeLuminance(primary) < 0.42,
    };

    if (key) cache.set(key, palette);
    return palette;
  } catch {
    return FALLBACK;
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export { FALLBACK as fallbackPalette };
