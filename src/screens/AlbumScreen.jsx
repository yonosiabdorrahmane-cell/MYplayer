import { useMemo } from 'react';

import Screen from '../ui/Screen.jsx';
import Artwork from '../ui/Artwork.jsx';
import TrackRow from '../ui/TrackRow.jsx';
import { PlayShuffleBar } from '../ui/Collection.jsx';
import { useLongPress, useMenu } from '../ui/ContextMenu.jsx';
import { useActions } from '../state/ActionsContext.jsx';
import { useLibrary } from '../state/LibraryContext.jsx';
import { usePlayer } from '../state/PlayerContext.jsx';
import { formatDuration } from '../lib/format.js';

/** Album detail: centred cover, then the track list — Apple Music's layout. */
export default function AlbumScreen({ pop, push, params, backLabel = 'Library', bottomInset }) {
  const { albums } = useLibrary();
  const { playQueue } = usePlayer();
  const { collectionMenu } = useActions();
  const { open } = useMenu();

  const album = albums.find((item) => item.key === params.albumKey);
  const ids = useMemo(() => album?.tracks.map((track) => track.id) ?? [], [album]);
  const longPress = useLongPress((rect) => open(rect, collectionMenu(ids, { editable: true })));

  if (!album) {
    return <Screen title="Album" onBack={pop} backLabel={backLabel} bottomInset={bottomInset} />;
  }

  const source = { title: album.title, subtitle: album.artist };

  return (
    <Screen
      title={album.title}
      subtitle={album.artist}
      largeTitle={false}
      onBack={pop}
      backLabel={backLabel}
      bottomInset={bottomInset}
    >
      <div className="flex flex-col items-center px-4 pb-1 pt-3" {...longPress}>
        <Artwork
          trackId={album.artworkId}
          size={232}
          radius={9}
          eager
          style={{ boxShadow: '0 10px 34px rgba(0,0,0,0.34)', maxWidth: '62vw' }}
        />
        <h1 className="t-title3 mt-4 text-center">{album.title}</h1>
        <button
          type="button"
          className="bar-btn t-title3 text-center"
          style={{ color: 'var(--tint)' }}
          onClick={() => push?.('artist', { artistKey: album.tracks[0]?.artistKey })}
        >
          {album.artist}
        </button>
        <p className="t-caption mt-1.5 uppercase" style={{ color: 'var(--label-2)', letterSpacing: 0.4 }}>
          {[album.tracks[0]?.genre, album.year].filter(Boolean).join(' · ')}
        </p>
      </div>

      <PlayShuffleBar
        onPlay={() => playQueue(ids, 0, { source })}
        onShuffle={() => playQueue(ids, 0, { shuffle: true, source })}
      />

      <div>
        {album.tracks.map((track, index) => (
          <TrackRow
            key={track.id}
            track={track}
            showArtwork={false}
            showTrackNumber
            showDuration
            onPlay={() => playQueue(ids, index, { source })}
          />
        ))}
      </div>

      <p className="t-footnote px-4 pt-3" style={{ color: 'var(--label-2)' }}>
        {album.tracks.length} song{album.tracks.length === 1 ? '' : 's'} ·{' '}
        {formatDuration(album.duration)}
      </p>
      <div className="h-8" />
    </Screen>
  );
}
