/**
 * Renders the app icon SVG out to every PNG size the manifest and iOS need.
 * Requires rsvg-convert (librsvg). Run with: npm run icons
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = resolve(root, 'public/icons');
mkdirSync(iconsDir, { recursive: true });

/**
 * Orbit: a play mark at the centre of a tilted ring of glass.
 *
 * A record spinning, without drawing a vinyl disc — every other music app on
 * the home screen is either a note, a disc, or a bare play triangle. The ring
 * is lit like the glass in the app: bright where the light lands at the upper
 * left, nearly gone through the middle, with a cool fringe on one edge and a
 * warm one on the other.
 *
 * The ground is the app's own near-black with the house aurora in it, so the
 * icon and the interface behind it are recognisably the same object. It stays
 * fixed while the app's colour follows the artwork — an icon that changed
 * with the music would just be an unrecognisable icon.
 */
const icon = (maskable) => {
  const inset = maskable ? 0.72 : 1; // maskable art must survive a circular crop
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="ground" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0%" stop-color="#15122b"/>
      <stop offset="52%" stop-color="#0b0a16"/>
      <stop offset="100%" stop-color="#07070c"/>
    </linearGradient>
    <radialGradient id="auroraA" cx="0.2" cy="0.12" r="0.72">
      <stop offset="0%" stop-color="#7d5cff" stop-opacity="0.62"/>
      <stop offset="100%" stop-color="#7d5cff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="auroraB" cx="0.88" cy="0.3" r="0.66">
      <stop offset="0%" stop-color="#ff4fa3" stop-opacity="0.48"/>
      <stop offset="100%" stop-color="#ff4fa3" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="auroraC" cx="0.5" cy="1.02" r="0.78">
      <stop offset="0%" stop-color="#3b7dff" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#3b7dff" stop-opacity="0"/>
    </radialGradient>

    <!-- The ring's specular: light lands top-left, dies through the middle,
         returns weakly bottom-right. The cool and warm stops are the same
         chromatic fringe the glass surfaces in the app carry. -->
    <linearGradient id="ring" x1="0.08" y1="0.02" x2="0.92" y2="0.98">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="16%" stop-color="#cfe0ff" stop-opacity="0.82"/>
      <stop offset="42%" stop-color="#ffffff" stop-opacity="0.34"/>
      <stop offset="62%" stop-color="#ffffff" stop-opacity="0.28"/>
      <stop offset="84%" stop-color="#ffd9c2" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.9"/>
    </linearGradient>
    <linearGradient id="ringInner" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.5"/>
      <stop offset="50%" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.18"/>
    </linearGradient>

    <linearGradient id="glyph" x1="0.1" y1="0" x2="0.9" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#e6e2ff"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18"/>
      <stop offset="46%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="512" height="512" rx="${maskable ? 0 : 114}" fill="url(#ground)"/>
  <rect width="512" height="512" rx="${maskable ? 0 : 114}" fill="url(#auroraA)"/>
  <rect width="512" height="512" rx="${maskable ? 0 : 114}" fill="url(#auroraB)"/>
  <rect width="512" height="512" rx="${maskable ? 0 : 114}" fill="url(#auroraC)"/>
  <rect width="512" height="512" rx="${maskable ? 0 : 114}" fill="url(#sheen)"/>

  <g transform="translate(256 256) scale(${inset}) translate(-256 -256)">
    <g transform="rotate(-27 256 256)">
      <!-- Cast of the ring onto the ground, so it reads as lifted glass. -->
      <ellipse cx="256" cy="266" rx="176" ry="107" fill="none"
               stroke="#000000" stroke-opacity="0.42" stroke-width="30"/>
      <ellipse cx="256" cy="256" rx="176" ry="107" fill="none"
               stroke="url(#ring)" stroke-width="27"/>
      <ellipse cx="256" cy="256" rx="176" ry="107" fill="none"
               stroke="url(#ringInner)" stroke-width="9"/>
    </g>

    <!-- Rounded with a round join rather than arcs: the corners stay true at
         40px, where a hand-drawn radius would go mushy. -->
    <path d="M224 197 L332 256 L224 315 Z" fill="url(#glyph)"
          stroke="url(#glyph)" stroke-width="28" stroke-linejoin="round"/>
  </g>
</svg>`;
};

writeFileSync(resolve(iconsDir, 'icon.svg'), icon(false));
writeFileSync(resolve(iconsDir, 'maskable.svg'), icon(true));

const targets = [
  ['icon-192.png', 192, 'icon.svg'],
  ['icon-256.png', 256, 'icon.svg'],
  ['icon-384.png', 384, 'icon.svg'],
  ['icon-512.png', 512, 'icon.svg'],
  ['apple-touch-icon.png', 180, 'icon.svg'],
  ['maskable-192.png', 192, 'maskable.svg'],
  ['maskable-512.png', 512, 'maskable.svg'],
];

for (const [out, size, src] of targets) {
  execFileSync('rsvg-convert', [
    '-w', String(size),
    '-h', String(size),
    resolve(iconsDir, src),
    '-o', resolve(iconsDir, out),
  ]);
  console.log(`icons/${out}  ${size}x${size}`);
}
