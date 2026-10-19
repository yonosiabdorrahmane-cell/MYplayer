import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { getArtworkURL } from '../lib/artwork.js';
import { fallbackPalette, paletteFromImage } from '../lib/colors.js';
import { usePlayer } from './PlayerContext.jsx';

const AuroraContext = createContext(fallbackPalette);

export const useAurora = () => useContext(AuroraContext);

/** Custom properties every surface reads, written once per track. */
const VARS = [
  ['--accent', (p) => p.accent],
  ['--accent-2', (p) => p.accent2],
  ['--accent-glow', (p) => p.glow],
  ['--aurora-a', (p) => p.aurora[0]],
  ['--aurora-b', (p) => p.aurora[1]],
  ['--aurora-c', (p) => p.aurora[2]],
];

/**
 * The whole app takes its colour from whatever is playing.
 *
 * The palette is pulled out of the cover art and written to the document root
 * as custom properties, so tints, glass rims, sliders and the drifting aurora
 * behind everything all shift together when the track changes. The properties
 * are registered with `@property` in ios.css, which is what lets the browser
 * interpolate them — the colour change is a slow crossfade, not a cut.
 *
 * Nothing here re-renders on playback position; it reacts only to the track.
 */
export function AuroraProvider({ children }) {
  const { currentTrack } = usePlayer();
  const [palette, setPalette] = useState(fallbackPalette);

  const artKey = currentTrack?.artKey ?? currentTrack?.album ?? currentTrack?.id ?? null;

  useEffect(() => {
    if (!currentTrack) {
      setPalette(fallbackPalette);
      return undefined;
    }

    let cancelled = false;
    getArtworkURL(currentTrack.id)
      .then((url) => (url ? paletteFromImage(url, artKey) : fallbackPalette))
      .then((result) => {
        if (!cancelled) setPalette(result);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [artKey, currentTrack]);

  useEffect(() => {
    const root = document.documentElement;
    for (const [name, read] of VARS) root.style.setProperty(name, read(palette));
  }, [palette]);

  // The iOS status bar and app-switcher card follow the song too.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.setAttribute('content', '#08080c');
  }, []);

  const value = useMemo(() => palette, [palette]);

  return <AuroraContext.Provider value={value}>{children}</AuroraContext.Provider>;
}
