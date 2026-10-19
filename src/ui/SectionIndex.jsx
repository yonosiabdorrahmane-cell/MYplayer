import { useRef } from 'react';

import { haptic } from '../lib/format.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
  'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '#'];

/**
 * The A–Z strip pinned to the right edge of long lists. Dragging along it
 * scrubs through sections, with a tick of feedback at each new letter.
 */
export default function SectionIndex({ available, onSelect, bottomInset = 0 }) {
  const stripRef = useRef(null);
  const lastRef = useRef(null);

  const pick = (clientY) => {
    const strip = stripRef.current;
    if (!strip) return;
    const rect = strip.getBoundingClientRect();
    const ratio = (clientY - rect.top) / rect.height;
    const index = Math.min(LETTERS.length - 1, Math.max(0, Math.floor(ratio * LETTERS.length)));

    // Walk to the nearest letter that actually has rows behind it.
    let letter = LETTERS[index];
    if (!available.has(letter)) {
      for (let step = 1; step < LETTERS.length; step += 1) {
        const before = LETTERS[index - step];
        const after = LETTERS[index + step];
        if (before && available.has(before)) {
          letter = before;
          break;
        }
        if (after && available.has(after)) {
          letter = after;
          break;
        }
      }
    }
    if (!available.has(letter) || letter === lastRef.current) return;
    lastRef.current = letter;
    haptic(4);
    onSelect(letter);
  };

  return (
    <div
      ref={stripRef}
      className="absolute right-0 z-20 flex flex-col items-center justify-center"
      style={{
        top: 'calc(var(--safe-top) + var(--nav-h))',
        bottom: bottomInset,
        width: 22,
        touchAction: 'none',
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        lastRef.current = null;
        pick(event.clientY);
      }}
      onPointerMove={(event) => {
        if (event.buttons === 0 && event.pointerType === 'mouse') return;
        pick(event.clientY);
      }}
      onPointerUp={() => {
        lastRef.current = null;
      }}
    >
      {LETTERS.map((letter) => (
        <span
          key={letter}
          className="select-none"
          style={{
            fontSize: 10.5,
            lineHeight: '11.5px',
            fontWeight: 600,
            color: available.has(letter) ? 'var(--tint)' : 'var(--label-4)',
          }}
        >
          {letter}
        </span>
      ))}
    </div>
  );
}
