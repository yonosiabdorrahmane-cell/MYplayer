import Artwork from './Artwork.jsx';
import Icon from './Icon.jsx';
import { useLongPress, useMenu } from './ContextMenu.jsx';
import { useActions } from '../state/ActionsContext.jsx';
import { haptic } from '../lib/format.js';

/** Square album tile used in the grid layouts. */
export function AlbumTile({ album, onOpen }) {
  const { collectionMenu } = useActions();
  const { open } = useMenu();
  const longPress = useLongPress((rect) =>
    open(rect, collectionMenu(album.tracks.map((track) => track.id), { editable: true })),
  );

  return (
    <button type="button" onClick={onOpen} className="springy w-full text-left" {...longPress}>
      <Artwork
        trackId={album.artworkId}
        radius={7}
        className="w-full"
        style={{ aspectRatio: '1 / 1', boxShadow: '0 2px 10px rgba(0,0,0,0.16)' }}
      />
      <p className="t-footnote truncate-1 mt-1.5" style={{ fontWeight: 500 }}>
        {album.title}
      </p>
      <p className="t-footnote truncate-1" style={{ color: 'var(--label-2)' }}>
        {album.artist}
      </p>
    </button>
  );
}

/** Row that pushes to a sub-screen, with the usual chevron. */
export function DisclosureRow({ icon, label, detail, onClick, artworkId, last = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="row-press flex w-full items-center gap-3 pl-4"
    >
      {icon && <Icon name={icon} size={22} style={{ color: 'var(--tint)' }} />}
      {artworkId !== undefined && <Artwork trackId={artworkId} size={48} radius={24} />}

      <div
        className="flex min-w-0 flex-1 items-center justify-between py-3 pr-4"
        style={{ boxShadow: last ? 'none' : 'inset 0 -0.5px 0 var(--separator)' }}
      >
        <span className="t-body truncate-1">{label}</span>
        <span className="flex items-center gap-1.5" style={{ color: 'var(--label-3)' }}>
          {detail && <span className="t-body">{detail}</span>}
          <Icon name="chevron.right" size={15} />
        </span>
      </div>
    </button>
  );
}

/** The paired Play / Shuffle buttons that head every album and playlist. */
export function PlayShuffleBar({ onPlay, onShuffle }) {
  return (
    <div className="flex gap-3 px-4 pb-3 pt-1">
      {[
        { label: 'Play', icon: 'play', action: onPlay },
        { label: 'Shuffle', icon: 'shuffle', action: onShuffle },
      ].map((button) => (
        <button
          key={button.label}
          type="button"
          className="glass glass-thin glass-press flex flex-1 items-center justify-center gap-2 py-3"
          style={{ borderRadius: 26, color: 'var(--tint)' }}
          onClick={() => {
            haptic(10);
            button.action();
          }}
        >
          <Icon name={button.icon} size={17} />
          <span className="t-headline">{button.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Centred placeholder used whenever a list has nothing in it yet. */
export function EmptyState({ icon = 'note', title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-10 py-20 text-center">
      <div style={{ color: 'var(--label-4)' }}>
        <Icon name={icon} size={58} />
      </div>
      <p className="t-title3 mt-4">{title}</p>
      {message && (
        <p className="t-subhead mt-1.5" style={{ color: 'var(--label-2)' }}>
          {message}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
