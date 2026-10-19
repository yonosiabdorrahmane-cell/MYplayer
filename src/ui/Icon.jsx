/**
 * Icon set drawn to match SF Symbols' weight and optical balance on a 24pt grid.
 * Everything inherits `currentColor` so icons tint with their container.
 */

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const paths = {
  /* --- tab bar ------------------------------------------------------- */
  library: (
    <g {...STROKE}>
      <path d="M4 5.5v13M8.4 4.6v14.8M12.6 5.2 12.6 18.8" />
      <path d="M16.4 5.6 20.6 18.2" />
    </g>
  ),
  albums: (
    <g {...STROKE}>
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="4.4" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </g>
  ),
  search: (
    <g {...STROKE}>
      <circle cx="10.8" cy="10.8" r="6.6" />
      <path d="m15.7 15.7 4.4 4.4" />
    </g>
  ),
  note: (
    <g {...STROKE}>
      <path d="M9 17.5V6.4l9-1.9v10.6" />
      <ellipse cx="6.6" cy="17.6" rx="2.6" ry="2.2" />
      <ellipse cx="15.6" cy="15.6" rx="2.6" ry="2.2" />
    </g>
  ),
  person: (
    <g {...STROKE}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.6 20a7.6 7.6 0 0 1 14.8 0" />
    </g>
  ),
  playlist: (
    <g {...STROKE}>
      <path d="M4 6.5h11M4 11.5h11M4 16.5h7" />
      <path d="M18.5 18V9.4l3 2.1" />
    </g>
  ),
  heart: (
    <g {...STROKE}>
      <path d="M12 20.2s-7.9-4.6-7.9-9.7A4.5 4.5 0 0 1 12 7.6a4.5 4.5 0 0 1 7.9 2.9c0 5.1-7.9 9.7-7.9 9.7Z" />
    </g>
  ),
  'heart.fill': (
    <path
      fill="currentColor"
      d="M12 20.4S3.7 15.5 3.7 10.2A4.9 4.9 0 0 1 12 6.8a4.9 4.9 0 0 1 8.3 3.4c0 5.3-8.3 10.2-8.3 10.2Z"
    />
  ),
  clock: (
    <g {...STROKE}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 7.2V12l3.2 2" />
    </g>
  ),
  gear: (
    <g {...STROKE} strokeWidth="1.7" strokeLinejoin="round">
      <path d="M10.19 2.67L13.81 2.67L12.90 4.66L16.56 6.17L17.31 4.12L19.88 6.69L17.83 7.44L19.34 11.10L21.33 10.19L21.33 13.81L19.34 12.90L17.83 16.56L19.88 17.31L17.31 19.88L16.56 17.83L12.90 19.34L13.81 21.33L10.19 21.33L11.10 19.34L7.44 17.83L6.69 19.88L4.12 17.31L6.17 16.56L4.66 12.90L2.67 13.81L2.67 10.19L4.66 11.10L6.17 7.44L4.12 6.69L6.69 4.12L7.44 6.17L11.10 4.66Z" />
      <circle cx="12" cy="12" r="3.3" />
    </g>
  ),

  /* --- transport ----------------------------------------------------- */
  play: <path fill="currentColor" d="M7.4 4.9c0-1 1.1-1.6 2-1.1l11 6.9a1.3 1.3 0 0 1 0 2.2l-11 7c-.9.5-2 0-2-1Z" />,
  pause: (
    <g fill="currentColor">
      <rect x="6.4" y="4.2" width="3.9" height="15.6" rx="1.6" />
      <rect x="13.7" y="4.2" width="3.9" height="15.6" rx="1.6" />
    </g>
  ),
  backward: (
    <g fill="currentColor">
      <path d="M11.6 6.3c0-1-1.1-1.5-1.9-1l-6.4 4.6a1.3 1.3 0 0 0 0 2.2l6.4 4.6c.8.6 1.9 0 1.9-1Z" />
      <path d="M21.4 6.3c0-1-1.1-1.5-1.9-1l-6.4 4.6a1.3 1.3 0 0 0 0 2.2l6.4 4.6c.8.6 1.9 0 1.9-1Z" />
    </g>
  ),
  forward: (
    <g fill="currentColor">
      <path d="M12.4 6.3c0-1 1.1-1.5 1.9-1l6.4 4.6a1.3 1.3 0 0 1 0 2.2l-6.4 4.6c-.8.6-1.9 0-1.9-1Z" />
      <path d="M2.6 6.3c0-1 1.1-1.5 1.9-1l6.4 4.6a1.3 1.3 0 0 1 0 2.2l-6.4 4.6c-.8.6-1.9 0-1.9-1Z" />
    </g>
  ),
  shuffle: (
    <g {...STROKE}>
      <path d="M3.4 6.6h3.2c1.6 0 2.6.9 3.6 2.2l4 5.4c1 1.3 2 2.2 3.6 2.2h2.4" />
      <path d="M3.4 17.4h3.2c1.6 0 2.6-.9 3.6-2.2M14.2 9.1c1-1.4 2-2.5 3.6-2.5h2.4" />
      <path d="m18.2 4.2 2.6 2.4-2.6 2.4M18.2 14 20.8 16.4l-2.6 2.4" />
    </g>
  ),
  repeat: (
    <g {...STROKE}>
      <path d="M6.6 4.8h9.2a4.4 4.4 0 0 1 4.4 4.4v.8" />
      <path d="m8.8 2.4-2.6 2.4 2.6 2.4" />
      <path d="M17.4 19.2H8.2a4.4 4.4 0 0 1-4.4-4.4v-.8" />
      <path d="m15.2 21.6 2.6-2.4-2.6-2.4" />
    </g>
  ),
  'repeat.1': (
    <g>
      <g {...STROKE}>
        <path d="M6.6 4.8h9.2a4.4 4.4 0 0 1 4.4 4.4v.8" />
        <path d="m8.8 2.4-2.6 2.4 2.6 2.4" />
        <path d="M17.4 19.2H8.2a4.4 4.4 0 0 1-4.4-4.4v-.8" />
        <path d="m15.2 21.6 2.6-2.4-2.6-2.4" />
      </g>
      <text
        x="12"
        y="15.2"
        textAnchor="middle"
        fontSize="8.4"
        fontWeight="700"
        fill="currentColor"
        stroke="none"
      >
        1
      </text>
    </g>
  ),
  queue: (
    <g {...STROKE}>
      <path d="M3.6 7h11M3.6 12h11M3.6 17h7.4" />
      <path d="M18.4 19V8.2l3.2 1.6" />
      <ellipse cx="17" cy="18.8" rx="2" ry="1.7" fill="currentColor" stroke="none" />
    </g>
  ),
  'speaker.low': (
    <g {...STROKE}>
      <path d="M4 9.4h3.2L11.4 6v12l-4.2-3.4H4Z" />
    </g>
  ),
  'speaker.high': (
    <g {...STROKE}>
      <path d="M4 9.4h3.2L11.4 6v12l-4.2-3.4H4Z" />
      <path d="M15 9.6a3.6 3.6 0 0 1 0 4.8M18 7a7.4 7.4 0 0 1 0 10" />
    </g>
  ),
  airplay: (
    <g {...STROKE}>
      <path d="M5.4 16.4H4.2A2 2 0 0 1 2.2 14.4V6.2a2 2 0 0 1 2-2h15.6a2 2 0 0 1 2 2v8.2a2 2 0 0 1-2 2h-1.2" />
      <path d="m12 14.6 4.6 5.8H7.4Z" fill="currentColor" />
    </g>
  ),

  /* --- chrome -------------------------------------------------------- */
  'chevron.left': <path {...STROKE} strokeWidth="2.4" d="m14.6 4.8-7 7.2 7 7.2" />,
  'chevron.right': <path {...STROKE} strokeWidth="2.4" d="m9.4 4.8 7 7.2-7 7.2" />,
  'chevron.down': <path {...STROKE} strokeWidth="2.4" d="m4.8 9 7.2 7 7.2-7" />,
  'chevron.compact.down': <path {...STROKE} strokeWidth="2.2" d="m5.4 10.4 6.6 4 6.6-4" />,
  ellipsis: (
    <g fill="currentColor">
      <circle cx="5.4" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="18.6" cy="12" r="1.8" />
    </g>
  ),
  plus: <path {...STROKE} strokeWidth="2.2" d="M12 4.6v14.8M4.6 12h14.8" />,
  xmark: <path {...STROKE} strokeWidth="2.2" d="m5.6 5.6 12.8 12.8M18.4 5.6 5.6 18.4" />,
  checkmark: <path {...STROKE} strokeWidth="2.4" d="m4.8 12.6 4.8 4.8L19.4 6.6" />,
  trash: (
    <g {...STROKE}>
      <path d="M4.8 6.6h14.4M9.4 6.6V4.8a1.4 1.4 0 0 1 1.4-1.4h2.4a1.4 1.4 0 0 1 1.4 1.4v1.8" />
      <path d="M6.6 6.6 7.6 19a1.8 1.8 0 0 0 1.8 1.6h5.2a1.8 1.8 0 0 0 1.8-1.6l1-12.4" />
    </g>
  ),
  folder: (
    <g {...STROKE}>
      <path d="M3 7.4a2 2 0 0 1 2-2h3.6l2 2.4h6.4a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <path d="M12 11.4v5.2M9.4 14h5.2" />
    </g>
  ),
  arrow: (
    <g {...STROKE}>
      <path d="M12 20V4.8M6 10.6 12 4.6l6 6" />
    </g>
  ),
  'text.badge.plus': (
    <g {...STROKE}>
      <path d="M3.4 6.4h10M3.4 11.4h10M3.4 16.4h6" />
      <path d="M17.6 9.6v8M13.6 13.6h8" />
    </g>
  ),
  sparkles: (
    <g fill="currentColor">
      <path d="M9 3.2 10.4 7 14.2 8.4 10.4 9.8 9 13.6 7.6 9.8 3.8 8.4 7.6 7Z" />
      <path d="M17 12.4 17.9 15 20.5 15.9 17.9 16.8 17 19.4 16.1 16.8 13.5 15.9 16.1 15Z" />
    </g>
  ),
};

export default function Icon({ name, size = 22, className = '', style, ...rest }) {
  const glyph = paths[name];
  if (!glyph) return null;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ display: 'block', flexShrink: 0, ...style }}
      {...rest}
    >
      {glyph}
    </svg>
  );
}
