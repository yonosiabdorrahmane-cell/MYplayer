import { useRef } from 'react';
import { motion } from 'motion/react';

import Icon from './Icon.jsx';
import Artwork from './Artwork.jsx';
import Marquee from './Marquee.jsx';
import { usePlayer } from '../state/PlayerContext.jsx';
import { useClockFrame } from '../state/clock.js';

const SPRING = { type: 'spring', stiffness: 460, damping: 38, mass: 0.9 };

/**
 * A glass capsule floating above the tab bar. Tapping it opens Now Playing;
 * flicking it up does the same, flicking it down clears the queue.
 */
export default function MiniPlayer({ onExpand, onDismiss }) {
  const { currentTrack, playing, toggle, next } = usePlayer();
  const progressRef = useRef(null);

  // Painted per frame straight into the node; this component never re-renders
  // for playback position.
  useClockFrame((state) => {
    if (progressRef.current) progressRef.current.style.width = `${state.fraction * 100}%`;
  });

  if (!currentTrack) return null;

  return (
    <motion.div
      className="glass relative overflow-hidden"
      style={{ borderRadius: 26, height: 'var(--mini-h)' }}
      initial={{ y: 70, opacity: 0, scale: 0.94 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: 70, opacity: 0, scale: 0.94 }}
      transition={SPRING}
      drag="y"
      dragDirectionLock
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.45, bottom: 0.2 }}
      onDragEnd={(_, info) => {
        if (info.offset.y < -36 || info.velocity.y < -420) onExpand();
        else if (info.offset.y > 72) onDismiss?.();
      }}
    >
      {/* Progress reads as light pooling along the bottom of the glass. */}
      <div
        ref={progressRef}
        className="pointer-events-none absolute bottom-0 left-0 z-10 h-[2.5px]"
        style={{
          width: 0,
          background: 'linear-gradient(90deg, transparent, var(--accent))',
          borderRadius: 2,
        }}
      />

      <div className="relative z-10 flex h-full items-center gap-3 pl-2.5 pr-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={onExpand}
        >
          <Artwork
            trackId={currentTrack.id}
            size={44}
            radius={13}
            eager
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
          />
          <Marquee className="min-w-0 flex-1" active={playing}>
            <span className="t-callout" style={{ fontWeight: 500 }}>
              {currentTrack.title}
            </span>
          </Marquee>
        </button>

        <GlassButton label={playing ? 'Pause' : 'Play'} icon={playing ? 'pause' : 'play'} onClick={toggle} />
        <GlassButton label="Next" icon="forward" onClick={() => next()} />
      </div>
    </motion.div>
  );
}

function GlassButton({ icon, label, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="glass-press flex h-10 w-10 shrink-0 items-center justify-center"
      style={{ borderRadius: 20, background: 'var(--fill-4)' }}
      onClick={onClick}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}
