import { useEffect, useRef, useState } from 'react';

/**
 * Titles that don't fit drift left, hold, and drift back — the same treatment
 * the Now Playing label gets on iOS. Text that fits is left completely alone.
 */
export default function Marquee({ children, className = '', style, active = true }) {
  const frameRef = useRef(null);
  const textRef = useRef(null);
  const [shift, setShift] = useState(0);

  useEffect(() => {
    const frame = frameRef.current;
    const text = textRef.current;
    if (!frame || !text) return undefined;

    const measure = () => {
      const overflow = text.scrollWidth - frame.clientWidth;
      setShift(overflow > 4 ? overflow + 6 : 0);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    observer.observe(text);
    return () => observer.disconnect();
  }, [children]);

  const running = active && shift > 0;

  return (
    <div ref={frameRef} className={`overflow-hidden ${className}`} style={style}>
      <div
        ref={textRef}
        className={running ? 'marquee-run' : ''}
        style={{
          whiteSpace: 'nowrap',
          display: 'inline-block',
          maxWidth: running ? 'none' : '100%',
          overflow: running ? 'visible' : 'hidden',
          textOverflow: 'ellipsis',
          '--marquee-shift': `${-shift}px`,
          // Longer strings scroll for longer so the speed stays constant.
          '--marquee-duration': `${Math.max(9, shift / 16 + 8).toFixed(1)}s`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
