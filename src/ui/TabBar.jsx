import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useVelocity,
} from 'motion/react';

import Icon from './Icon.jsx';
import { useChrome } from '../state/ChromeContext.jsx';
import { haptic } from '../lib/format.js';

const TABS = [
  { id: 'library', label: 'Library', icon: 'library' },
  { id: 'playlists', label: 'Playlists', icon: 'playlist' },
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'settings', label: 'Settings', icon: 'gear' },
];

const PAD = 8; // inner padding of the capsule, in px

/** Height/label changes when the bar collapses. */
const SLIDE = { type: 'spring', stiffness: 520, damping: 38, mass: 0.9 };
/** The slab chasing the finger — loose enough to lag a little, which is the tell. */
const GLIDE = { stiffness: 620, damping: 34, mass: 0.9 };
/** Swelling under a finger: loose and slightly overshooting. */
const PRESS = { type: 'spring', stiffness: 420, damping: 26, mass: 0.7 };
/** Settling back, faster than it grew. */
const RELEASE = { type: 'spring', stiffness: 600, damping: 30, mass: 0.7 };

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * A floating glass capsule rather than a docked bar — content scrolls beneath
 * it and shows through.
 *
 * The gesture is owned by the bar, not by individual tabs, so a press can
 * travel: hold anywhere on it and a thicker slab of glass gathers under your
 * finger, then follows it along the bar, previewing each tab as it passes.
 * Whichever tab you are over when you lift is the one that opens, so you can
 * change your mind mid-drag without committing.
 *
 * The slab tracks the finger *continuously* rather than hopping slot to slot,
 * with a magnetic pull toward each tab's centre — and because it is driven by
 * a spring, it stretches along its direction of travel and squashes across it,
 * the way a bead of liquid does. None of that motion goes through React: the
 * position is a motion value written straight from the pointer handler.
 */
export default function TabBar({ active, onSelect }) {
  const { collapsed } = useChrome();

  const barRef = useRef(null);
  const touchRef = useRef(null);

  const [width, setWidth] = useState(0);
  const [dragIndex, setDragIndex] = useState(null); // tab under the finger, or null

  const selectedIndex = Math.max(
    0,
    TABS.findIndex((tab) => tab.id === active),
  );
  const dragging = dragIndex !== null;

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return undefined;
    const measure = () => setWidth(bar.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  const slotWidth = width > 0 ? (width - PAD * 2) / TABS.length : 0;

  /* ------------------------------------------------------------ the motion */

  const x = useMotionValue(0);
  const springX = useSpring(x, GLIDE);
  const velocity = useVelocity(springX);

  // Stretch along the direction of travel, thin across it — constant volume,
  // which is what sells it as liquid rather than as a sliding rectangle.
  const stretchX = useTransform(velocity, [-3200, 0, 3200], [1.22, 1, 1.22], { clamp: true });
  const stretchY = useTransform(velocity, [-3200, 0, 3200], [0.86, 1, 0.86], { clamp: true });
  // A slab in flight leans into the turn.
  const skew = useTransform(velocity, [-3200, 0, 3200], [-7, 0, 7], { clamp: true });

  const restingX = selectedIndex * slotWidth;

  // Follow the selection whenever a finger isn't overriding it.
  useEffect(() => {
    if (!dragging) x.set(restingX);
  }, [dragging, restingX, x]);

  const indexFromX = useCallback(
    (clientX) => {
      const bar = barRef.current;
      if (!bar || slotWidth <= 0) return 0;
      const rect = bar.getBoundingClientRect();
      return clamp(Math.floor((clientX - rect.left - PAD) / slotWidth), 0, TABS.length - 1);
    },
    [slotWidth],
  );

  /**
   * Continuous position under the finger, pulled partway toward the nearest
   * tab centre. Pure finger-following feels loose and never quite lands;
   * pure snapping feels mechanical. The blend is the whole trick.
   */
  const followX = useCallback(
    (clientX) => {
      const bar = barRef.current;
      if (!bar || slotWidth <= 0) return 0;
      const rect = bar.getBoundingClientRect();
      const free = clamp(
        clientX - rect.left - PAD - slotWidth / 2,
        0,
        (TABS.length - 1) * slotWidth,
      );
      const snapped = indexFromX(clientX) * slotWidth;
      return free * 0.68 + snapped * 0.32;
    },
    [indexFromX, slotWidth],
  );

  /* The travelling bloom is written straight to the DOM — it moves every
     pointer frame and has no business triggering React renders. */
  const moveTouch = useCallback((clientX, clientY) => {
    const bar = barRef.current;
    const glow = touchRef.current;
    if (!bar || !glow) return;
    const rect = bar.getBoundingClientRect();
    glow.style.setProperty('--touch-x', `${clientX - rect.left}px`);
    glow.style.setProperty('--touch-y', `${clientY - rect.top}px`);
  }, []);

  const setGlow = useCallback((visible) => {
    if (touchRef.current) touchRef.current.style.opacity = visible ? '1' : '0';
  }, []);

  const onPointerDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragIndex(indexFromX(event.clientX));
    x.set(followX(event.clientX));
    moveTouch(event.clientX, event.clientY);
    setGlow(true);
    haptic(5);
  };

  const onPointerMove = (event) => {
    if (dragIndex === null) return;
    moveTouch(event.clientX, event.clientY);
    x.set(followX(event.clientX));

    const index = indexFromX(event.clientX);
    if (index !== dragIndex) {
      // A tick at each boundary is what makes the glide feel like it has
      // detents. Silent on iOS, so the icons' own lift has to carry it there.
      haptic(4);
      setDragIndex(index);
    }
  };

  const finish = (event, commit) => {
    setGlow(false);
    if (commit && dragIndex !== null) {
      const index = indexFromX(event.clientX);
      if (TABS[index].id !== active) haptic(9);
      onSelect(TABS[index].id);
      x.set(index * slotWidth);
    }
    setDragIndex(null);
  };

  // A pointer captured by the bar can be released outside it; make sure the
  // gesture always ends even if the browser swallows the pointerup.
  useEffect(() => {
    if (!dragging) return undefined;
    const cancel = () => {
      setGlow(false);
      setDragIndex(null);
    };
    window.addEventListener('blur', cancel);
    return () => window.removeEventListener('blur', cancel);
  }, [dragging, setGlow]);

  return (
    <motion.nav
      ref={barRef}
      className="glass relative overflow-hidden"
      style={{ borderRadius: 30, touchAction: 'none' }}
      animate={{ height: collapsed ? 50 : 58 }}
      transition={SLIDE}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => finish(event, true)}
      onPointerCancel={(event) => finish(event, false)}
    >
      {/* Specular bloom that follows the finger across the surface. */}
      <div
        ref={touchRef}
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: 0,
          transition: 'opacity 0.3s var(--ease-out-ios)',
          background:
            'radial-gradient(90px 90px at var(--touch-x, 50%) var(--touch-y, 50%), var(--glass-touch), transparent 70%)',
        }}
      />

      {/* Outer node carries position and the liquid deformation; the inner one
          carries the press, so the two springs never fight over one transform. */}
      {slotWidth > 0 && (
        <motion.div
          className="pointer-events-none absolute"
          style={{
            left: PAD,
            top: 6,
            bottom: 6,
            width: slotWidth,
            x: springX,
            scaleX: stretchX,
            scaleY: stretchY,
            skewX: skew,
          }}
        >
          <motion.span
            className="glass-blob block h-full w-full"
            style={{ borderRadius: 24 }}
            animate={{ scale: dragging ? 1.09 : 1 }}
            transition={dragging ? PRESS : RELEASE}
          />
        </motion.div>
      )}

      <div
        role="tablist"
        className="relative flex h-full items-center"
        style={{ padding: `0 ${PAD}px` }}
      >
        {TABS.map((tab, index) => (
          <Tab
            key={tab.id}
            tab={tab}
            index={index}
            collapsed={collapsed}
            slotWidth={slotWidth}
            springX={springX}
            highlighted={dragging ? dragIndex === index : selectedIndex === index}
            lifted={dragging && dragIndex === index}
            selected={selectedIndex === index}
            onSelect={onSelect}
          />
        ))}
      </div>
    </motion.nav>
  );
}

/**
 * Pointer events are off because the bar owns the gesture — it has to keep
 * tracking as the finger crosses between tabs. Keyboard focus is unaffected,
 * so the roles here keep it operable.
 */
function Tab({
  tab,
  index,
  collapsed,
  slotWidth,
  springX,
  highlighted,
  lifted,
  selected,
  onSelect,
}) {
  // Each glyph leans away from the passing slab and back again, so the whole
  // bar moves as the selector crosses it rather than only the tab underneath.
  const lean = useTransform(springX, (value) => {
    if (slotWidth <= 0) return 0;
    const distance = (index * slotWidth - value) / slotWidth;
    return clamp(distance, -1.4, 1.4) * 3.2;
  });

  return (
    <div
      role="tab"
      tabIndex={0}
      aria-selected={selected}
      aria-label={tab.label}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onSelect(tab.id);
      }}
      className="pointer-events-none relative flex h-full flex-1 flex-col items-center justify-center"
    >
      <motion.span className="flex flex-col items-center" style={{ x: lean }}>
        <motion.span
          className="flex flex-col items-center"
          animate={{
            color: highlighted ? 'var(--accent)' : 'var(--label-2)',
            scale: lifted ? 1.14 : highlighted ? 1 : 0.96,
            y: lifted ? -1.5 : 0,
          }}
          transition={{ color: { duration: 0.2 }, default: lifted ? PRESS : RELEASE }}
        >
          <Icon name={tab.icon} size={collapsed ? 23 : 24} />
          <motion.span
            className="t-caption2 overflow-hidden"
            style={{ fontWeight: highlighted ? 600 : 500 }}
            animate={{
              height: collapsed ? 0 : 14,
              opacity: collapsed ? 0 : 1,
              marginTop: collapsed ? 0 : 2,
            }}
            transition={SLIDE}
          >
            {tab.label}
          </motion.span>
        </motion.span>
      </motion.span>
    </div>
  );
}

export { TABS };
