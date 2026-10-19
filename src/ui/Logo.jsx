/**
 * The Orbit mark, drawn live rather than loaded as an image.
 *
 * The home screen icon is fixed — an icon that changed with the music would
 * just be an icon nobody recognises. Inside the app there is no such
 * constraint, so this one takes the accent from whatever is playing, and a
 * specular highlight travels the ring the way light crosses a real one.
 */

const RING = 'M 80,256 a 176,107 0 1,0 352,0 a 176,107 0 1,0 -352,0';

export default function Logo({ size = 44, animated = true, className = '', style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="lg-ring" x1="0.08" y1="0.02" x2="0.92" y2="0.98">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="18%" stopColor="var(--accent)" stopOpacity="0.9" />
          <stop offset="48%" stopColor="#ffffff" stopOpacity="0.26" />
          <stop offset="72%" stopColor="var(--accent-2)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="lg-glyph" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#ded8ff" />
        </linearGradient>
        <radialGradient id="lg-spark">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g transform="rotate(-27 256 256)">
        <ellipse
          cx="256"
          cy="256"
          rx="176"
          ry="107"
          fill="none"
          stroke="url(#lg-ring)"
          strokeWidth="27"
        />
        {animated && (
          <circle r="34" fill="url(#lg-spark)">
            <animateMotion dur="4.5s" repeatCount="indefinite" path={RING} />
          </circle>
        )}
      </g>

      <path
        d="M224 197 L332 256 L224 315 Z"
        fill="url(#lg-glyph)"
        stroke="url(#lg-glyph)"
        strokeWidth="28"
        strokeLinejoin="round"
      />
    </svg>
  );
}
