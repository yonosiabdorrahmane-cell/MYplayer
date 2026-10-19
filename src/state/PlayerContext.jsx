import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getAudioBlob, getMeta, setMeta } from '../lib/db.js';
import { getMediaSessionArtwork } from '../lib/artwork.js';
import { haptic } from '../lib/format.js';
import {
  applyVolume,
  attachAudio,
  inAppVolumeEnabled,
  resumeAudio,
  setInAppVolume,
  volumeMode,
} from '../lib/audioGraph.js';
import { clock } from './clock.js';
import { useLibrary } from './LibraryContext.jsx';

const PlayerContext = createContext(null);

export const usePlayer = () => {
  const value = useContext(PlayerContext);
  if (!value) throw new Error('usePlayer must be used inside <PlayerProvider>');
  return value;
};

const REPEAT_MODES = ['off', 'all', 'one'];
const SESSION_KEY = 'playback-session';
const VOLUME_KEY = 'myplayer:volume';

function readStoredVolume() {
  const stored = Number.parseFloat(localStorage.getItem(VOLUME_KEY) ?? '');
  return Number.isFinite(stored) ? Math.max(0, Math.min(1, stored)) : 1;
}

/** Fisher–Yates, with the currently playing track pinned to the front. */
function shuffleOrder(length, startAt) {
  const order = Array.from({ length }, (_, index) => index);
  for (let i = length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (startAt != null) {
    const position = order.indexOf(startAt);
    if (position > 0) [order[0], order[position]] = [order[position], order[0]];
  }
  return order;
}

export function PlayerProvider({ children }) {
  const { trackById, registerPlay } = useLibrary();

  const audioRef = useRef(null);
  if (!audioRef.current && typeof Audio !== 'undefined') {
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;
    clock.attach(audio);
    attachAudio(audio);
  }

  const [queue, setQueue] = useState([]); // track ids in the order they were queued
  const [order, setOrder] = useState([]); // indices into `queue`, reordered when shuffled
  const [position, setPosition] = useState(-1); // index into `order`
  const [queueSource, setQueueSource] = useState(null); // { title, subtitle } for the queue sheet

  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('off');
  const [volume, setVolumeState] = useState(readStoredVolume);
  const [error, setError] = useState(null);

  // Position and buffered length deliberately are not state — see state/clock.js.
  // Nothing in this value may change more than a couple of times a second.

  // Scrubbing must not fight the timeupdate events, so the UI owns the clock
  // while a drag is in progress.
  const scrubbingRef = useRef(false);
  const objectUrlRef = useRef(null);
  const restoredRef = useRef(false);
  const countedRef = useRef(null);

  const currentId = position >= 0 && order[position] != null ? queue[order[position]] : null;
  const currentTrack = currentId ? (trackById.get(currentId) ?? null) : null;

  /* ------------------------------------------------------------ audio wiring */

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    // `timeupdate` only has to nudge the clock — it reads the element itself,
    // and the rAF loop is what actually paints while playing.
    const onTime = () => {
      if (!scrubbingRef.current) clock.sync();
    };
    const onDuration = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
      clock.sync();
    };
    const onProgress = () => {
      const ranges = audio.buffered;
      clock.setBuffered(ranges.length ? ranges.end(ranges.length - 1) : 0);
    };
    const onPlay = () => {
      setPlaying(true);
      clock.setPlaying(true);
      resumeAudio();
      setError(null);
    };
    const onPause = () => {
      setPlaying(false);
      clock.setPlaying(false);
    };
    const onWaiting = () => setLoading(true);
    const onPlaying = () => setLoading(false);
    const onError = () => {
      setLoading(false);
      setPlaying(false);
      setError('This track could not be played.');
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('durationchange', onDuration);
    audio.addEventListener('loadedmetadata', onDuration);
    audio.addEventListener('progress', onProgress);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('canplay', onPlaying);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('durationchange', onDuration);
      audio.removeEventListener('loadedmetadata', onDuration);
      audio.removeEventListener('progress', onProgress);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('canplay', onPlaying);
      audio.removeEventListener('error', onError);
    };
  }, []);

  /* ---------------------------------------------------------- source loading */

  const loadTrack = useCallback(async (trackId, { autoplay = true, startAt = 0 } = {}) => {
    const audio = audioRef.current;
    if (!audio || !trackId) return;

    setLoading(true);
    setError(null);
    countedRef.current = null;

    const blob = await getAudioBlob(trackId);
    if (!blob) {
      setLoading(false);
      setError('The audio file is missing from this device.');
      return;
    }

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;

    audio.src = url;
    audio.currentTime = 0;
    clock.setBuffered(0);
    clock.sync();

    if (startAt > 0) {
      const seek = () => {
        audio.currentTime = startAt;
        clock.sync();
        audio.removeEventListener('loadedmetadata', seek);
      };
      audio.addEventListener('loadedmetadata', seek);
    }

    if (autoplay) {
      try {
        resumeAudio();
        await audio.play();
      } catch {
        // Autoplay refused until the user interacts — leave it paused and ready.
        setPlaying(false);
      }
    }
    setLoading(false);
  }, []);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  /* ---------------------------------------------------------------- controls */

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    try {
      await audio.play();
    } catch {
      setPlaying(false);
    }
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const toggle = useCallback(() => {
    haptic(6);
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) play();
    else audio.pause();
  }, [play]);

  const seek = useCallback((seconds) => {
    const audio = audioRef.current;
    if (!audio) return;
    const target = Math.max(0, Math.min(seconds, audio.duration || seconds));
    audio.currentTime = target;
    clock.sync();
  }, []);

  const beginScrub = useCallback(() => {
    scrubbingRef.current = true;
  }, []);

  const endScrub = useCallback(
    (seconds) => {
      scrubbingRef.current = false;
      clock.setOverride(null);
      seek(seconds);
    },
    [seek],
  );

  const previewScrub = useCallback((seconds) => {
    clock.setOverride(seconds);
  }, []);

  /**
   * Called on every frame of a volume drag, so it must not touch React state —
   * the output takes the value directly and `setVolume` records where the
   * finger finally landed.
   */
  const previewVolume = useCallback((value) => {
    applyVolume(value);
  }, []);

  const setVolume = useCallback((value) => {
    const clamped = Math.max(0, Math.min(1, value));
    applyVolume(clamped);
    localStorage.setItem(VOLUME_KEY, String(clamped));
    setVolumeState(clamped);
  }, []);

  const [inAppVolume, setInAppVolumeState] = useState(inAppVolumeEnabled);

  const toggleInAppVolume = useCallback(
    (enabled) => {
      setInAppVolume(enabled);
      setInAppVolumeState(enabled);
      // Switching it on can take effect now; switching it off cannot, because
      // the element stays routed through the graph until the page is gone.
      if (enabled) applyVolume(volume);
    },
    [volume],
  );

  // A stored level has to be re-applied once there is an element to apply it
  // to. Never builds the audio graph on its own — on iOS that would cost
  // background playback silently, at launch, before anyone asked for it.
  useEffect(() => {
    if (volume !== 1 && volumeMode() === 'element') applyVolume(volume);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------------------- navigation */

  const goTo = useCallback(
    (nextPosition, { autoplay = true } = {}) => {
      if (nextPosition < 0 || nextPosition >= order.length) return;
      setPosition(nextPosition);
      const trackId = queue[order[nextPosition]];
      loadTrack(trackId, { autoplay });
    },
    [loadTrack, order, queue],
  );

  const next = useCallback(
    ({ auto = false } = {}) => {
      if (order.length === 0) return;
      if (!auto) haptic(6);

      if (repeat === 'one' && auto) {
        seek(0);
        play();
        return;
      }

      const last = position >= order.length - 1;
      if (last) {
        if (repeat === 'all' || !auto) {
          goTo(0, { autoplay: repeat === 'all' || !auto });
        } else {
          // End of the queue: stop on the last track the way iOS does.
          pause();
          seek(0);
        }
        return;
      }
      goTo(position + 1);
    },
    [goTo, order.length, pause, play, position, repeat, seek],
  );

  const previous = useCallback(() => {
    haptic(6);
    const audio = audioRef.current;
    // Within the first few seconds, "back" means the previous track; after that
    // it restarts the current one.
    if (audio && audio.currentTime > 3) {
      seek(0);
      return;
    }
    if (position <= 0) {
      seek(0);
      return;
    }
    goTo(position - 1);
  }, [goTo, position, seek]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    const onEnded = () => next({ auto: true });
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [next]);

  /* ------------------------------------------------------------ queue setup */

  const playQueue = useCallback(
    (trackIds, startIndex = 0, options = {}) => {
      if (!trackIds || trackIds.length === 0) return;
      const { shuffle: startShuffled = false, source = null } = options;

      const nextOrder = startShuffled
        ? shuffleOrder(trackIds.length, startIndex)
        : Array.from({ length: trackIds.length }, (_, index) => index);
      const nextPosition = startShuffled ? 0 : startIndex;

      setQueue(trackIds);
      setOrder(nextOrder);
      setPosition(nextPosition);
      setQueueSource(source);
      if (startShuffled) setShuffle(true);
      haptic(10);

      loadTrack(trackIds[nextOrder[nextPosition]], { autoplay: true });
    },
    [loadTrack],
  );

  const toggleShuffle = useCallback(() => {
    haptic(6);
    setShuffle((current) => {
      const nextValue = !current;
      const playingIndex = order[position];
      if (queue.length > 0) {
        const nextOrder = nextValue
          ? shuffleOrder(queue.length, playingIndex)
          : Array.from({ length: queue.length }, (_, index) => index);
        setOrder(nextOrder);
        // Keep playing the same track — only what comes after it changes.
        setPosition(nextValue ? 0 : (playingIndex ?? 0));
      }
      return nextValue;
    });
  }, [order, position, queue.length]);

  const cycleRepeat = useCallback(() => {
    haptic(6);
    setRepeat((current) => REPEAT_MODES[(REPEAT_MODES.indexOf(current) + 1) % REPEAT_MODES.length]);
  }, []);

  const playNext = useCallback(
    (trackIds) => {
      const ids = [].concat(trackIds);
      if (queue.length === 0) {
        playQueue(ids, 0);
        return;
      }
      // Insert straight after the playing track in both the queue and the order.
      const insertAt = order[position] + 1;
      const nextQueue = [...queue];
      nextQueue.splice(insertAt, 0, ...ids);

      const shifted = order.map((index) => (index >= insertAt ? index + ids.length : index));
      const inserted = ids.map((_, offset) => insertAt + offset);
      const nextOrder = [...shifted];
      nextOrder.splice(position + 1, 0, ...inserted);

      setQueue(nextQueue);
      setOrder(nextOrder);
      haptic(8);
    },
    [order, playQueue, position, queue],
  );

  const playLater = useCallback(
    (trackIds) => {
      const ids = [].concat(trackIds);
      if (queue.length === 0) {
        playQueue(ids, 0);
        return;
      }
      const insertAt = queue.length;
      setQueue((current) => [...current, ...ids]);
      setOrder((current) => [...current, ...ids.map((_, offset) => insertAt + offset)]);
      haptic(8);
    },
    [playQueue, queue.length],
  );

  const removeFromQueue = useCallback(
    (orderIndex) => {
      if (orderIndex === position) return;
      setOrder((current) => current.filter((_, index) => index !== orderIndex));
      if (orderIndex < position) setPosition((current) => current - 1);
    },
    [position],
  );

  const clearQueue = useCallback(() => {
    pause();
    setQueue([]);
    setOrder([]);
    setPosition(-1);
    setQueueSource(null);
  }, [pause]);

  /* ---------------------------------------------------------- side effects */

  // Count a play once the listener is a third of the way in, like scrobbling
  // does. Polled off the clock rather than driven by it: this only needs to be
  // right once per track, and it used to re-run on every tick.
  useEffect(() => {
    if (!currentId || !duration || !playing) return undefined;
    if (countedRef.current === currentId) return undefined;

    const threshold = Math.min(30, duration / 3);
    const timer = setInterval(() => {
      if (countedRef.current === currentId) return;
      if (clock.getSnapshot().time > threshold) {
        countedRef.current = currentId;
        registerPlay(currentId);
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [currentId, duration, playing, registerPlay]);

  // Lock screen / control centre / headphone buttons.
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    let cancelled = false;

    // Publish the text straight away so the lock screen is never blank while
    // the cover is being prepared, then upgrade it once the art is ready.
    const publish = (artwork) => {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album,
        artwork,
      });
    };

    publish([]);
    getMediaSessionArtwork(currentTrack.id).then((artwork) => {
      if (!cancelled && artwork.length) publish(artwork);
    });

    return () => {
      cancelled = true;
    };
  }, [currentTrack]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return undefined;

    const handlers = [
      ['play', () => play()],
      ['pause', () => pause()],
      ['previoustrack', () => previous()],
      ['nexttrack', () => next()],
      ['seekbackward', (details) => seek(clock.getSnapshot().time - (details?.seekOffset ?? 10))],
      ['seekforward', (details) => seek(clock.getSnapshot().time + (details?.seekOffset ?? 10))],
      ['seekto', (details) => details?.seekTime != null && seek(details.seekTime)],
      ['stop', () => pause()],
    ];

    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* action unsupported on this platform */
      }
    }

    return () => {
      for (const [action] of handlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          /* ignore */
        }
      }
    };
  }, [next, pause, play, previous, seek]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }, [playing]);

  // The platform interpolates the lock-screen scrubber from the last position
  // and the playback rate, so this only has to be republished when playback
  // actually changes shape — not on every tick, as it was.
  useEffect(() => {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    if (!Number.isFinite(duration) || duration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(clock.getSnapshot().time, duration),
      });
    } catch {
      /* Safari throws while the element is mid-seek */
    }
  }, [currentId, duration, playing]);

  /* -------------------------------------------------------------- restoring */

  useEffect(() => {
    if (restoredRef.current || trackById.size === 0) return;
    restoredRef.current = true;

    getMeta(SESSION_KEY).then((session) => {
      if (!session?.queue?.length) return;
      const validQueue = session.queue.filter((id) => trackById.has(id));
      if (validQueue.length === 0) return;

      const validOrder = session.order.filter((index) => index < validQueue.length);
      const restoredPosition = Math.min(session.position ?? 0, validOrder.length - 1);

      setQueue(validQueue);
      setOrder(validOrder.length ? validOrder : validQueue.map((_, index) => index));
      setPosition(Math.max(0, restoredPosition));
      setShuffle(Boolean(session.shuffle));
      setRepeat(session.repeat ?? 'off');
      setQueueSource(session.source ?? null);

      const trackId = validQueue[validOrder[restoredPosition] ?? 0];
      // Restored, but never auto-playing — reopening an app shouldn't make noise.
      loadTrack(trackId, { autoplay: false, startAt: session.currentTime ?? 0 });
    });
  }, [loadTrack, trackById]);

  const saveSession = useCallback(() => {
    if (!restoredRef.current || queue.length === 0) return;
    setMeta(SESSION_KEY, {
      queue,
      order,
      position,
      shuffle,
      repeat,
      source: queueSource,
      currentTime: clock.getSnapshot().time,
    }).catch(() => {});
  }, [order, position, queue, queueSource, repeat, shuffle]);

  // Queue shape changes are worth writing promptly; the play position is not,
  // so it rides along on a slow timer instead. (Keying the debounce off the
  // position used to reset the timer four times a second, which meant the
  // session was only ever written once playback stopped.)
  useEffect(() => {
    const timer = setTimeout(saveSession, 1200);
    return () => clearTimeout(timer);
  }, [saveSession]);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = setInterval(saveSession, 10000);
    return () => {
      clearInterval(timer);
      saveSession(); // and once more on pause, so the resume point is exact
    };
  }, [playing, saveSession]);

  /* ----------------------------------------------------------------- output */

  const upNext = useMemo(
    () =>
      order
        .slice(position + 1)
        .map((queueIndex, offset) => ({
          orderIndex: position + 1 + offset,
          track: trackById.get(queue[queueIndex]),
        }))
        .filter((entry) => entry.track),
    [order, position, queue, trackById],
  );

  const value = useMemo(
    () => ({
      currentTrack,
      currentId,
      playing,
      loading,
      error,
      duration: duration || currentTrack?.duration || 0,
      shuffle,
      repeat,
      volume,
      queueSource,
      upNext,
      hasQueue: queue.length > 0,
      play,
      pause,
      toggle,
      next,
      previous,
      seek,
      beginScrub,
      previewScrub,
      endScrub,
      setVolume,
      previewVolume,
      volumeMode,
      inAppVolume,
      toggleInAppVolume,
      playQueue,
      playNext,
      playLater,
      removeFromQueue,
      clearQueue,
      toggleShuffle,
      cycleRepeat,
      goTo,
    }),
    [
      beginScrub,
      clearQueue,
      currentId,
      currentTrack,
      cycleRepeat,
      duration,
      endScrub,
      error,
      goTo,
      loading,
      next,
      pause,
      play,
      playLater,
      playNext,
      playQueue,
      playing,
      previewScrub,
      inAppVolume,
      previewVolume,
      previous,
      queue.length,
      queueSource,
      removeFromQueue,
      repeat,
      seek,
      setVolume,
      shuffle,
      toggle,
      toggleInAppVolume,
      toggleShuffle,
      upNext,
      volume,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}
