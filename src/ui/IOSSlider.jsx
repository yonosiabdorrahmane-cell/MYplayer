import { useCallback, useEffect, useRef, useState } from 'react';

import { haptic } from '../lib/format.js';

const clamp = (input) => Math.min(1, Math.max(0, input));

/**
 * The scrubber and the volume bar.
 *
 * Idle it's a thin capsule; on touch it swells and the whole control scales up
 * slightly. Sliding your finger away from the bar vertically engages fine
 * scrubbing — the further off you are, the smaller each horizontal movement
 * counts, which is how you land on an exact second in a long track.
 *
 * The fill is written straight to the DOM. It moves every frame — while the
 * finger drags it, and while the clock advances underneath it — and none of
 * that is worth a React render. Pass `subscribe` to feed it from the playback
 * clock, or `value` for a level that only changes when someone sets it.
 */
export default function IOSSlider({
  value = 0,
  subscribe,
  onStart,
  onChange,
  onCommit,
  idleHeight = 7,
  activeHeight = 12,
  trackColor = 'rgba(255,255,255,0.18)',
  fillColor = 'var(--accent, #fff)',
  glow = true,
  bufferedFraction = 0,
  disabled = false,
  className = '',
}) {
  const barRef = useRef(null);
  const fillRef = useRef(null);
  const bufferRef = useRef(null);
  const [active, setActive] = useState(false);

  // `active` is also read inside subscription callbacks that were created
  // before the state changed, so the ref is the one that must be authoritative.
  const activeRef = useRef(false);
  const stateRef = useRef({ startX: 0, startValue: 0, width: 1, latest: 0 });

  const paint = useCallback((fraction) => {
    if (fillRef.current) fillRef.current.style.width = `${clamp(fraction) * 100}%`;
  }, []);

  const paintBuffer = useCallback((fraction) => {
    if (bufferRef.current) bufferRef.current.style.width = `${clamp(fraction) * 100}%`;
  }, []);

  // Driven by the clock: ignored outright while a finger is on the control.
  useEffect(() => {
    if (!subscribe) return undefined;
    return subscribe((state) => {
      if (activeRef.current) return;
      paint(state.fraction);
      paintBuffer(state.bufferedFraction);
    });
  }, [paint, paintBuffer, subscribe]);

  // Driven by a plain value (volume): only moves when something sets it.
  useEffect(() => {
    if (subscribe || activeRef.current) return;
    paint(value);
  }, [paint, subscribe, value]);

  useEffect(() => {
    if (subscribe) return;
    paintBuffer(bufferedFraction);
  }, [bufferedFraction, paintBuffer, subscribe]);

  const resolve = useCallback((event) => {
    const { startX, startValue, width } = stateRef.current;
    const dx = event.clientX - startX;

    // Vertical distance from the bar dampens horizontal movement.
    const rect = barRef.current.getBoundingClientRect();
    const centre = rect.top + rect.height / 2;
    const away = Math.max(0, Math.abs(event.clientY - centre) - 28);
    const precision = away > 0 ? Math.max(0.12, 1 - away / 150) : 1;

    return clamp(startValue + (dx / width) * precision);
  }, []);

  const onPointerDown = (event) => {
    if (disabled) return;
    // Fine scrubbing needs vertical movement, so keep the gesture away from any
    // drag-to-dismiss handler on an ancestor.
    event.stopPropagation();
    const rect = barRef.current.getBoundingClientRect();
    const tapped = clamp((event.clientX - rect.left) / rect.width);

    stateRef.current = {
      startX: event.clientX,
      startValue: tapped,
      width: rect.width,
      latest: tapped,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    activeRef.current = true;
    setActive(true);
    paint(tapped);
    haptic(5);
    onStart?.();
    onChange?.(tapped);
  };

  const onPointerMove = (event) => {
    if (!activeRef.current) return;
    const next = resolve(event);
    stateRef.current.latest = next;
    paint(next);
    onChange?.(next);
  };

  const finish = (event) => {
    if (!activeRef.current) return;
    activeRef.current = false;
    setActive(false);
    const final = event ? resolve(event) : stateRef.current.latest;
    paint(final);
    haptic(5);
    onCommit?.(final);
  };

  const height = active ? activeHeight : idleHeight;

  return (
    <div
      className={`relative flex items-center ${className}`}
      style={{
        height: activeHeight + 16,
        touchAction: 'none',
        cursor: disabled ? 'default' : 'pointer',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
    >
      <div
        ref={barRef}
        className="relative w-full overflow-hidden"
        style={{
          height,
          borderRadius: height / 2,
          background: trackColor,
          transform: `scaleX(${active ? 1.014 : 1})`,
          transition:
            'height 0.28s var(--ease-out-ios), border-radius 0.28s var(--ease-out-ios), transform 0.28s var(--ease-out-ios)',
        }}
      >
        <div
          ref={bufferRef}
          className="absolute inset-y-0 left-0"
          style={{ width: 0, background: 'rgba(255,255,255,0.12)' }}
        />
        <div
          ref={fillRef}
          className="absolute inset-y-0 left-0"
          style={{
            width: 0,
            background: fillColor,
            // The fill carries the accent, so it gets the accent's light too.
            boxShadow: glow ? '0 0 12px -2px var(--accent-glow, transparent)' : 'none',
          }}
        />
      </div>
    </div>
  );
}
