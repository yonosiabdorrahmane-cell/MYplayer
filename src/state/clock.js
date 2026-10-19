/**
 * The playback clock, deliberately kept outside React.
 *
 * Position changes four times a second from `timeupdate`, and needs to change
 * at 60fps for a scrubber that doesn't visibly step. Holding it in React state
 * means every consumer of the player context re-renders at that rate — and one
 * of those consumers is `TrackRow`, so a 500-song list re-rendered 500 rows,
 * four times a second, the entire time music was playing. That was the lag.
 *
 * So the number lives here instead. Components that *draw* it subscribe per
 * frame and write to the DOM themselves; components that only show whole
 * seconds subscribe to the second tick and re-render once a second. Neither
 * path touches the context, so the lists stay still.
 */

import { useEffect, useRef, useSyncExternalStore } from 'react';

const frameSubs = new Set();
const secondSubs = new Set();

let audio = null;
let playing = false;
let frame = 0;
let override = null; // while scrubbing, the finger owns the position
let buffered = 0;
let lastSecond = -1;

const time = () => override ?? audio?.currentTime ?? 0;
const total = () => {
  const value = audio?.duration;
  return Number.isFinite(value) ? value : 0;
};

/** Everything a subscriber could want, rebuilt per emit — never stored. */
function snapshot() {
  const seconds = time();
  const duration = total();
  return {
    time: seconds,
    duration,
    buffered,
    fraction: duration > 0 ? Math.min(1, seconds / duration) : 0,
    bufferedFraction: duration > 0 ? Math.min(1, buffered / duration) : 0,
  };
}

function emit() {
  const state = snapshot();
  for (const fn of frameSubs) fn(state);

  const second = Math.floor(state.time);
  if (second !== lastSecond) {
    lastSecond = second;
    for (const fn of secondSubs) fn();
  }
}

function loop() {
  emit();
  frame = playing && frameSubs.size > 0 ? requestAnimationFrame(loop) : 0;
}

function ensureLoop() {
  if (!frame && playing && frameSubs.size > 0) frame = requestAnimationFrame(loop);
}

export const clock = {
  attach(element) {
    audio = element;
  },

  setPlaying(value) {
    playing = value;
    if (playing) ensureLoop();
    // A pause still needs one last emit so the UI lands on the exact position.
    else emit();
  },

  setBuffered(value) {
    buffered = value;
    if (!frame) emit();
  },

  /** Scrubbing: the UI owns the position until the finger lifts. */
  setOverride(seconds) {
    override = seconds;
    if (!frame) emit();
  },

  /** Force a repaint after a seek or a track change. */
  sync() {
    lastSecond = -1;
    if (!frame) emit();
  },

  getSnapshot: snapshot,
};

/**
 * Calls `fn` with a fresh snapshot every frame of playback. `fn` must write to
 * the DOM rather than call setState — that is the entire point.
 *
 * Stable identity, so it can be passed straight into an effect's dependencies.
 */
export function subscribeFrame(fn) {
  frameSubs.add(fn);
  fn(snapshot()); // paint immediately rather than waiting for the next frame
  ensureLoop();
  return () => {
    frameSubs.delete(fn);
  };
}

/** The hook form, for components that draw into their own refs. */
export function useClockFrame(draw) {
  const latest = useRef(draw);
  latest.current = draw;
  useEffect(() => subscribeFrame((state) => latest.current(state)), []);
}

const subscribeSecond = (fn) => {
  secondSubs.add(fn);
  return () => secondSubs.delete(fn);
};

/** Whole seconds elapsed. Re-renders its component once a second, no faster. */
export function useClockSeconds() {
  return useSyncExternalStore(
    subscribeSecond,
    () => Math.floor(time()),
    () => 0,
  );
}
