import { useEffect, useRef, useState } from 'react';

import Icon from './Icon.jsx';
import { getArtworkURL, peekArtworkURL } from '../lib/artwork.js';

/**
 * Album art with a graceful placeholder. Loads lazily — a library list can hold
 * hundreds of rows, and pulling every blob at once locks up the main thread.
 */
export default function Artwork({
  trackId,
  size,
  radius = 6,
  className = '',
  style,
  eager = false,
  onPalette,
}) {
  // A URL already in the cache renders on the very first paint, so scrolling
  // back over a row never flashes the placeholder.
  const [url, setUrl] = useState(() => peekArtworkURL(trackId) ?? null);
  const [visible, setVisible] = useState(eager);
  const [loaded, setLoaded] = useState(false);
  const nodeRef = useRef(null);

  useEffect(() => {
    setUrl(peekArtworkURL(trackId) ?? null);
    setLoaded(false);
  }, [trackId]);

  useEffect(() => {
    if (visible || !nodeRef.current) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(nodeRef.current);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || !trackId) return undefined;
    let cancelled = false;
    getArtworkURL(trackId).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [trackId, visible]);

  useEffect(() => {
    if (url && onPalette) onPalette(url);
  }, [onPalette, url]);

  const dimensions = size ? { width: size, height: size } : undefined;

  return (
    <div
      ref={nodeRef}
      className={`artwork relative overflow-hidden ${className}`}
      style={{ borderRadius: radius, ...dimensions, ...style }}
    >
      {url ? (
        <img
          src={url}
          alt=""
          draggable={false}
          // A cached object URL can finish decoding before React attaches
          // onLoad, which would leave the image stuck at zero opacity.
          ref={(node) => {
            if (node?.complete && node.naturalWidth > 0) setLoaded(true);
          }}
          onLoad={() => setLoaded(true)}
          className="h-full w-full object-cover"
          style={{
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.28s var(--ease-out-ios)',
          }}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center"
          style={{ color: 'var(--label-3)' }}
        >
          <Icon name="note" size={size ? Math.max(14, size * 0.42) : 22} />
        </div>
      )}
    </div>
  );
}
