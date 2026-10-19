import { memo } from 'react';

import Artwork from './Artwork.jsx';
import Equalizer from './Equalizer.jsx';
import Icon from './Icon.jsx';
import { useLongPress, useMenu } from './ContextMenu.jsx';
import { useActions } from '../state/ActionsContext.jsx';
import { usePlayer } from '../state/PlayerContext.jsx';
import { formatTime } from '../lib/format.js';

/**
 * One song in a list. Shows artwork or a track number depending on context,
 * marks the playing row, and carries the standard long-press menu.
 *
 * Memoised, and deliberately so: there is one of these per song on screen, and
 * the player context above it changes whenever anything about playback does.
 * Without this, starting a track re-renders every visible row.
 */
function TrackRow({
  track,
  onPlay,
  showArtwork = true,
  showTrackNumber = false,
  showDuration = false,
  extraMenuItems = [],
  trailing,
  inset = 16,
}) {
  const { currentId, playing } = usePlayer();
  const { trackMenu } = useActions();
  const { open } = useMenu();

  const isCurrent = currentId === track.id;
  const longPress = useLongPress((rect) => open(rect, trackMenu(track, extraMenuItems)));

  return (
    <div className="relative flex items-stretch" style={{ paddingLeft: inset }}>
      <button
        type="button"
        onClick={onPlay}
        className="row-press flex min-w-0 flex-1 items-center gap-3 pr-3 text-left"
        style={{ paddingTop: 7, paddingBottom: 7 }}
        {...longPress}
      >
        {showTrackNumber && (
          <div
            className="tabular t-subhead flex shrink-0 items-center justify-center"
            style={{ width: 24, color: 'var(--label-2)' }}
          >
            {isCurrent ? (
              <Equalizer playing={playing} />
            ) : (
              (track.trackNo ?? '–')
            )}
          </div>
        )}

        {showArtwork && (
          <div className="relative shrink-0">
            <Artwork trackId={track.id} size={48} radius={5} />
            {isCurrent && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.42)', borderRadius: 5 }}
              >
                <Equalizer playing={playing} color="#fff" size={14} />
              </div>
            )}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p
            className="t-body truncate-1"
            style={{ color: isCurrent ? 'var(--tint)' : 'var(--label)' }}
          >
            {track.title}
          </p>
          {!showTrackNumber && (
            <p className="t-footnote truncate-1" style={{ color: 'var(--label-2)' }}>
              {track.artist}
              {track.album && track.album !== 'Unknown Album' ? ` — ${track.album}` : ''}
            </p>
          )}
        </div>

        {track.favorite && (
          <Icon name="heart.fill" size={13} style={{ color: 'var(--label-3)' }} />
        )}

        {showDuration && (
          <span className="tabular t-footnote" style={{ color: 'var(--label-2)' }}>
            {formatTime(track.duration)}
          </span>
        )}
      </button>

      {trailing ?? (
        <button
          type="button"
          aria-label="More"
          className="bar-btn flex shrink-0 items-center justify-center"
          style={{ width: 44, color: 'var(--label-2)' }}
          onClick={(event) =>
            open(event.currentTarget.getBoundingClientRect(), trackMenu(track, extraMenuItems))
          }
        >
          <Icon name="ellipsis" size={19} />
        </button>
      )}

      <div
        className="pointer-events-none absolute bottom-0 right-0"
        style={{
          left: showArtwork ? 16 + 48 + 12 : inset,
          height: 0.5,
          background: 'var(--separator)',
        }}
      />
    </div>
  );
}

export default memo(TrackRow);
