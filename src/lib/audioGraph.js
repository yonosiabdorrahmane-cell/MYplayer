/**
 * Volume, and the reason it is complicated.
 *
 * iOS ignores `audio.volume` completely — media loudness is a hardware concern
 * there and assignment to the property is silently dropped, which is why the
 * slider was pure decoration. A `GainNode` in front of the output *is*
 * honoured, so routing the element through Web Audio does give real control.
 *
 * It also breaks background playback, which is worth more.
 *
 * A plain media element keeps playing on iOS when the app is backgrounded or
 * the screen locks; that is what Media Session controls are attached to. Route
 * it through Web Audio and it no longer does, because iOS suspends the
 * AudioContext the moment the app stops being frontmost, and a suspended
 * context outputs nothing. Worse, the damage is permanent for the life of the
 * page: `createMediaElementSource` captures the element's output for good, and
 * disconnecting the node yields silence rather than handing playback back.
 *
 * So the default is the plain element path — full background playback, and a
 * volume slider that works everywhere except iOS. The graph is built only if
 * the user explicitly asks for in-app volume in Settings, having been told what
 * it costs.
 */

const OPT_IN_KEY = 'myplayer:in-app-volume';

let context = null;
let source = null;
let gain = null;
let element = null;
let failed = false;
let honoursVolume = null;

export const inAppVolumeEnabled = () => localStorage.getItem(OPT_IN_KEY) === 'on';

/**
 * Does this browser actually act on `audio.volume`?
 *
 * Reading the property straight back is the only reliable test: iOS accepts the
 * assignment silently and keeps reporting 1. Same tick, so nothing is audible.
 */
function elementVolumeHonoured() {
  if (honoursVolume !== null) return honoursVolume;
  if (!element) return false;

  const original = element.volume;
  try {
    element.volume = 0.123;
    honoursVolume = Math.abs(element.volume - 0.123) < 0.01;
  } catch {
    honoursVolume = false;
  }
  element.volume = original;
  return honoursVolume;
}

/**
 * How volume can be controlled here:
 *   element     — the normal path; works, and keeps background playback
 *   graph       — iOS with in-app volume switched on; works, no background audio
 *   unavailable — iOS as shipped; the system volume buttons are the only control
 */
export function volumeMode() {
  if (elementVolumeHonoured()) return 'element';
  return inAppVolumeEnabled() ? 'graph' : 'unavailable';
}

/** Web Audio starts suspended until a gesture, and iOS re-suspends on interrupt. */
export function resumeAudio() {
  if (context?.state === 'suspended') context.resume().catch(() => {});
}

function build() {
  if (gain || failed || !element) return gain;

  try {
    const Context = window.AudioContext ?? window.webkitAudioContext;
    if (!Context) throw new Error('no Web Audio');

    context = new Context();
    source = context.createMediaElementSource(element);
    gain = context.createGain();
    source.connect(gain);
    gain.connect(context.destination);
    resumeAudio();
    return gain;
  } catch {
    // Leave playback exactly as it was rather than risking silence.
    failed = true;
    context = null;
    source = null;
    gain = null;
    return null;
  }
}

export function attachAudio(audio) {
  element = audio;
}

/**
 * Turning this on takes effect immediately. Turning it off cannot: the routing
 * is permanent for the life of the page, so background playback only comes
 * back on the next launch — which the caller is expected to say out loud.
 */
export function setInAppVolume(enabled) {
  localStorage.setItem(OPT_IN_KEY, enabled ? 'on' : 'off');
}

/** True once playback is routed through the graph — i.e. background audio is gone. */
export const graphIsLive = () => Boolean(gain);

/**
 * @param {number} value 0..1
 * @returns {boolean} whether the level could actually be applied
 */
export function applyVolume(value) {
  const level = Math.max(0, Math.min(1, value));

  if (elementVolumeHonoured()) {
    element.volume = level;
    return true;
  }

  if (!inAppVolumeEnabled()) return false;

  // Full volume needs no graph at all, so don't build one just to multiply by 1
  // and lose background playback for nothing.
  if (level === 1 && !gain) return true;

  const node = build();
  if (!node) return false;

  resumeAudio();
  // A short ramp instead of a step: instant changes on an audio graph click.
  const now = context.currentTime;
  node.gain.cancelScheduledValues(now);
  node.gain.setTargetAtTime(level, now, 0.015);
  return true;
}
