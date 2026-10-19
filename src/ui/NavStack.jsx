import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useDragControls } from 'motion/react';

import { haptic } from '../lib/format.js';

const PUSH_SPRING = { type: 'spring', stiffness: 420, damping: 44, mass: 1 };
const PARALLAX = 0.32; // how far the outgoing screen slides left, as a fraction

/**
 * UIKit-style navigation stack.
 *
 * Pushing slides the new screen in from the right while the previous one drifts
 * left behind a dimming layer; swiping from the left edge drags the top screen
 * back under your finger and completes or cancels based on distance and flick
 * velocity — the same rules UINavigationController uses.
 */
export default function NavStack({ stack, onPop, className = '' }) {
  const dragControls = useDragControls();
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 390 : window.innerWidth));

  const belowRef = useRef(null);
  const dimRef = useRef(null);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const canPop = stack.length > 1;

  /* The screen underneath is nudged straight through the DOM during the
     gesture. Motion owns its transform the rest of the time, so whatever is
     set here is handed back when the drag ends. */
  const trackBelow = (offset) => {
    const progress = Math.min(Math.max(offset / width, 0), 1);
    if (belowRef.current) {
      belowRef.current.style.transform = `translate3d(${(-PARALLAX + PARALLAX * progress) * width}px,0,0)`;
    }
    if (dimRef.current) {
      dimRef.current.style.opacity = String((1 - progress) * 0.18);
    }
  };

  const releaseBelow = () => {
    if (belowRef.current) belowRef.current.style.transform = '';
    if (dimRef.current) dimRef.current.style.opacity = '';
  };

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      <AnimatePresence initial={false}>
        {stack.map((entry, index) => {
          const depth = stack.length - 1 - index;
          const isTop = depth === 0;
          const isBelow = depth === 1;

          return (
            <motion.div
              key={entry.key}
              ref={isBelow ? belowRef : undefined}
              className="aurora-surface absolute inset-0"
              style={{
                zIndex: index + 1,
                // Deeper screens stay mounted so their scroll position survives.
                // Left to inherit otherwise — an explicit `visible` here would
                // punch through the hidden container of an inactive tab.
                visibility: depth > 1 ? 'hidden' : undefined,
                boxShadow: index > 0 ? '-8px 0 24px rgba(0,0,0,0.22)' : 'none',
                touchAction: 'pan-y',
              }}
              initial={index === 0 ? false : { x: width }}
              animate={{ x: isTop ? 0 : -width * PARALLAX }}
              exit={{ x: width }}
              transition={PUSH_SPRING}
              drag={isTop && canPop ? 'x' : false}
              dragListener={false}
              dragControls={dragControls}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0, right: 1, top: 0, bottom: 0 }}
              dragMomentum={false}
              onDrag={(_, info) => trackBelow(Math.max(0, info.offset.x))}
              onDragEnd={(_, info) => {
                const shouldPop = info.offset.x > width * 0.34 || info.velocity.x > 520;
                releaseBelow();
                if (shouldPop) {
                  haptic(6);
                  onPop();
                }
              }}
            >
              {entry.render()}

              {/* Dimming veil over the screen that has been pushed behind. */}
              {isBelow && (
                <div
                  ref={dimRef}
                  className="pointer-events-none absolute inset-0"
                  style={{ background: '#000', opacity: 0.18 }}
                />
              )}

              {/* Edge grab strip — thin enough that it never eats normal taps. */}
              {isTop && canPop && (
                <div
                  className="absolute inset-y-0 left-0 z-50"
                  style={{ width: 26, touchAction: 'none' }}
                  onPointerDown={(event) => dragControls.start(event)}
                />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
