import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react';

import Icon from './Icon.jsx';
import Artwork from './Artwork.jsx';
import Marquee from './Marquee.jsx';
import IOSSlider from './IOSSlider.jsx';
import Sheet from './Sheet.jsx';
import TrackRow from './TrackRow.jsx';
import { useMenu } from './ContextMenu.jsx';
import { useActions } from '../state/ActionsContext.jsx';
import { useLibrary } from '../state/LibraryContext.jsx';
import { usePlayer } from '../state/PlayerContext.jsx';
import { subscribeFrame, useClockSeconds } from '../state/clock.js';
import { useAurora } from '../state/AuroraContext.jsx';
import { formatRemaining, formatTime, haptic } from '../lib/format.js';

const SHEET_SPRING = { type: 'spring', stiffness: 380, damping: 40, mass: 1 };

/**
 * The only thing on this screen that re-renders while a track plays, and it
 * does so once a second. Everything else about the scrubber is painted
 * directly into the DOM by the clock.
 */
function TimeLabel({ duration }) {
  const seconds = useClockSeconds();
  return (
    <>
      <span>{formatTime(seconds)}</span>
      <span>{formatRemaining(Math.max(0, duration - seconds))}</span>
    </>
  );
}

export default function NowPlaying({ open, onClose }) {
  const {
    currentTrack,
    playing,
    toggle,
    next,
    previous,
    duration,
    shuffle,
    repeat,
    toggleShuffle,
    cycleRepeat,
    volume,
    setVolume,
    previewVolume,
    volumeMode,
    beginScrub,
    previewScrub,
    endScrub,
    upNext,
    queueSource,
    goTo,
    error,
  } = usePlayer();

  const { toggleFavorite } = useLibrary();
  const { trackMenu } = useActions();
  const { open: openMenu } = useMenu();

  // The palette is already being derived once, app-wide, for the aurora.
  const palette = useAurora();
  const [scrubbing, setScrubbing] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);

  const y = useMotionValue(0);
  const scale = useTransform(y, [0, 420], [1, 0.9]);
  const radius = useTransform(y, [0, 120], [0, 34]);

  useEffect(() => {
    if (open) y.set(0);
  }, [open, y]);

  const backdrop = useMemo(
    () => ({
      backgroundColor: palette.backdrop[2],
      backgroundImage: [
        `radial-gradient(120% 78% at 18% 8%, ${palette.backdrop[0]} 0%, transparent 62%)`,
        `radial-gradient(110% 72% at 88% 32%, ${palette.backdrop[1]} 0%, transparent 60%)`,
        `radial-gradient(130% 90% at 50% 108%, ${palette.backdrop[2]} 0%, transparent 70%)`,
      ].join(','),
    }),
    [palette],
  );

  if (!currentTrack) return null;

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[70] overflow-hidden"
            style={{ y, scale, borderRadius: radius, touchAction: 'none' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SHEET_SPRING}
            drag="y"
            dragDirectionLock
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 1 }}
            dragMomentum={false}
            onDragEnd={(_, info) => {
              if (info.offset.y > 130 || info.velocity.y > 560) {
                haptic(6);
                onClose();
              }
            }}
          >
            {/* --- Ambient background ---------------------------------- */}
            <div
              className="absolute inset-0"
              style={{ ...backdrop, transition: 'background-color 1.1s ease, background-image 1.1s ease' }}
            />
            <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.22)' }} />

            {/* --- Content --------------------------------------------- */}
            <div
              className="relative flex h-full flex-col px-7"
              style={{
                paddingTop: 'calc(var(--safe-top) + 10px)',
                paddingBottom: 'calc(var(--safe-bottom) + 14px)',
                color: '#fff',
              }}
            >
              {/* Grabber */}
              <button
                type="button"
                aria-label="Close"
                className="mx-auto shrink-0"
                onClick={onClose}
                style={{ padding: '6px 30px' }}
              >
                <div
                  style={{
                    width: 38,
                    height: 5,
                    borderRadius: 3,
                    background: 'rgba(255,255,255,0.35)',
                  }}
                />
              </button>

              {/* Artwork — shrinks while paused, exactly like the Music app. */}
              <div className="flex min-h-0 flex-1 items-center justify-center">
                <motion.div
                  initial={{ scale: 0.86, opacity: 0 }}
                  animate={{ scale: playing ? 1 : 0.78, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 26, mass: 0.9 }}
                  style={{ width: '100%', maxWidth: 'min(88vw, 58vh)' }}
                >
                  <Artwork
                    trackId={currentTrack.id}
                    radius={10}
                    eager
                    className="w-full"
                    style={{
                      aspectRatio: '1 / 1',
                      boxShadow: playing
                        ? '0 26px 60px rgba(0,0,0,0.55)'
                        : '0 12px 30px rgba(0,0,0,0.45)',
                      transition: 'box-shadow 0.5s var(--ease-out-ios)',
                    }}
                  />
                </motion.div>
              </div>

              {/* Title block */}
              <div className="flex shrink-0 items-center gap-3 pt-5">
                <div className="min-w-0 flex-1">
                  <Marquee active={playing}>
                    <span className="t-title3" style={{ fontWeight: 700 }}>
                      {currentTrack.title}
                    </span>
                  </Marquee>
                  <Marquee active={false}>
                    <span
                      className="t-title3"
                      style={{ color: 'rgba(255,255,255,0.62)', fontWeight: 400 }}
                    >
                      {currentTrack.artist}
                    </span>
                  </Marquee>
                </div>

                <button
                  type="button"
                  aria-label="More"
                  className="springy flex h-8 w-8 shrink-0 items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 16 }}
                  onClick={(event) =>
                    openMenu(event.currentTarget.getBoundingClientRect(), trackMenu(currentTrack))
                  }
                >
                  <Icon name="ellipsis" size={17} />
                </button>
              </div>

              {/* Scrubber */}
              <div className="shrink-0 pt-3">
                <IOSSlider
                  subscribe={subscribeFrame}
                  onStart={() => {
                    setScrubbing(true);
                    beginScrub();
                  }}
                  onChange={(next) => previewScrub(next * duration)}
                  onCommit={(next) => {
                    setScrubbing(false);
                    endScrub(next * duration);
                  }}
                />
                <div
                  className="tabular flex justify-between"
                  style={{
                    color: scrubbing ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)',
                    fontSize: scrubbing ? 13 : 11.5,
                    fontWeight: scrubbing ? 600 : 500,
                    marginTop: scrubbing ? 2 : 0,
                    transition: 'all 0.28s var(--ease-out-ios)',
                  }}
                >
                  <TimeLabel duration={duration} />
                </div>
              </div>

              {error && (
                <p className="t-footnote pt-2 text-center" style={{ color: '#ffd6d6' }}>
                  {error}
                </p>
              )}

              {/* Transport */}
              <div className="flex shrink-0 items-center justify-between px-2 pt-4">
                <button
                  type="button"
                  aria-label="Previous"
                  className="springy flex h-16 w-16 items-center justify-center"
                  onClick={previous}
                >
                  <Icon name="backward" size={34} />
                </button>
                <motion.button
                  type="button"
                  aria-label={playing ? 'Pause' : 'Play'}
                  className="glass glass-press flex items-center justify-center"
                  style={{ width: 78, height: 78, borderRadius: 39 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 600, damping: 24 }}
                  onClick={toggle}
                >
                  {/* The glyph swaps with a quick scale so the change registers
                      as one control morphing, not two icons trading places. */}
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={playing ? 'pause' : 'play'}
                      className="flex"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 700, damping: 30 }}
                    >
                      <Icon name={playing ? 'pause' : 'play'} size={40} />
                    </motion.span>
                  </AnimatePresence>
                </motion.button>
                <button
                  type="button"
                  aria-label="Next"
                  className="springy flex h-16 w-16 items-center justify-center"
                  onClick={() => next()}
                >
                  <Icon name="forward" size={34} />
                </button>
              </div>

              {/* Volume — absent on iOS unless in-app volume was switched on,
                  because there it can do nothing but lie. The hardware buttons
                  are the control, and they always were. */}
              {volumeMode() !== 'unavailable' && (
                <div className="flex shrink-0 items-center gap-2.5 pt-3">
                  <Icon name="speaker.low" size={15} style={{ color: 'rgba(255,255,255,0.5)' }} />
                  <IOSSlider
                    className="flex-1"
                    value={volume}
                    idleHeight={6}
                    activeHeight={11}
                    // Every frame goes straight to the output; only the final
                    // level is worth telling React (and localStorage) about.
                    onChange={previewVolume}
                    onCommit={setVolume}
                  />
                  <Icon name="speaker.high" size={15} style={{ color: 'rgba(255,255,255,0.5)' }} />
                </div>
              )}

              {/* Bottom controls, gathered into a single pane of glass */}
              <div
                className="glass glass-thin mt-3.5 flex shrink-0 items-center justify-between px-2 py-1.5"
                style={{ borderRadius: 30 }}
              >
                <ToolButton
                  icon={currentTrack.favorite ? 'heart.fill' : 'heart'}
                  active={currentTrack.favorite}
                  label="Love"
                  onClick={() => {
                    haptic(8);
                    toggleFavorite(currentTrack.id);
                  }}
                />
                <ToolButton icon="shuffle" active={shuffle} label="Shuffle" onClick={toggleShuffle} />
                <ToolButton
                  icon={repeat === 'one' ? 'repeat.1' : 'repeat'}
                  active={repeat !== 'off'}
                  label="Repeat"
                  onClick={cycleRepeat}
                />
                <ToolButton
                  icon="queue"
                  active={queueOpen}
                  label="Up Next"
                  onClick={() => {
                    haptic(6);
                    setQueueOpen(true);
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Up Next --------------------------------------------------- */}
      <Sheet
        open={queueOpen}
        onClose={() => setQueueOpen(false)}
        title={queueSource?.title ? `Playing From ${queueSource.title}` : 'Up Next'}
        height="66vh"
      >
        {upNext.length === 0 ? (
          <p className="t-subhead px-6 py-10 text-center" style={{ color: 'var(--label-2)' }}>
            Nothing else queued.
          </p>
        ) : (
          upNext.map((entry) => (
            <TrackRow
              key={`${entry.track.id}-${entry.orderIndex}`}
              track={entry.track}
              onPlay={() => {
                goTo(entry.orderIndex);
                setQueueOpen(false);
              }}
            />
          ))
        )}
      </Sheet>
    </>
  );
}

function ToolButton({ icon, label, active, onClick }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      className="relative flex h-11 w-11 items-center justify-center"
      style={{ borderRadius: 22, color: active ? '#fff' : 'rgba(255,255,255,0.6)' }}
      whileTap={{ scale: 0.85 }}
      transition={{ type: 'spring', stiffness: 600, damping: 22 }}
      onClick={onClick}
    >
      {/* Active state is its own little pane that grows in behind the glyph. */}
      <AnimatePresence>
        {active && (
          <motion.span
            className="absolute inset-0"
            style={{
              borderRadius: 22,
              background: 'rgba(255,255,255,0.22)',
              boxShadow: 'inset 0 1px 0.5px rgba(255,255,255,0.5)',
            }}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 620, damping: 28 }}
          />
        )}
      </AnimatePresence>
      <span className="relative">
        <Icon name={icon} size={21} />
      </span>
    </motion.button>
  );
}
