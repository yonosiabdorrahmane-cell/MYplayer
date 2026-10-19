import { useCallback, useMemo, useRef } from 'react';

import Screen from '../ui/Screen.jsx';
import Icon from '../ui/Icon.jsx';
import Artwork from '../ui/Artwork.jsx';
import TrackRow from '../ui/TrackRow.jsx';
import SectionIndex from '../ui/SectionIndex.jsx';
import { AlbumTile, EmptyState } from '../ui/Collection.jsx';
import { useLongPress, useMenu } from '../ui/ContextMenu.jsx';
import { useActions } from '../state/ActionsContext.jsx';
import { useLibrary } from '../state/LibraryContext.jsx';
import { usePlayer } from '../state/PlayerContext.jsx';
import { sectionLetter } from '../lib/format.js';

/* ------------------------------------------------------------------ albums */

export function AlbumsScreen({ pop, push, bottomInset }) {
  const { albums } = useLibrary();

  return (
    <Screen title="Albums" onBack={pop} backLabel="Library" bottomInset={bottomInset}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 px-4 pt-2">
        {albums.map((album) => (
          <AlbumTile
            key={album.key}
            album={album}
            onOpen={() => push('album', { albumKey: album.key })}
          />
        ))}
      </div>
      <div className="h-8" />
    </Screen>
  );
}

/* ----------------------------------------------------------------- artists */

export function ArtistsScreen({ pop, push, bottomInset }) {
  const { artists } = useLibrary();
  const scrollRef = useRef(null);
  const { scrollToLetter, letters } = useLetterIndex(artists, (artist) => artist.name, scrollRef);

  return (
    <Screen
      title="Artists"
      onBack={pop}
      backLabel="Library"
      bottomInset={bottomInset}
      scrollRef={scrollRef}
    >
      <div className="pt-1">
        {artists.map((artist) => (
          <button
            key={artist.key}
            type="button"
            data-letter={sectionLetter(artist.name)}
            className="row-press flex w-full items-center gap-3 pl-4"
            onClick={() => push('artist', { artistKey: artist.key })}
          >
            <Artwork trackId={artist.artworkId} size={52} radius={26} />
            <div
              className="flex min-w-0 flex-1 items-center justify-between py-2.5 pr-4"
              style={{ boxShadow: 'inset 0 -0.5px 0 var(--separator)' }}
            >
              <div className="min-w-0 text-left">
                <p className="t-body truncate-1">{artist.name}</p>
                <p className="t-footnote" style={{ color: 'var(--label-2)' }}>
                  {artist.albums.length} album{artist.albums.length === 1 ? '' : 's'} ·{' '}
                  {artist.trackCount} song{artist.trackCount === 1 ? '' : 's'}
                </p>
              </div>
              <Icon name="chevron.right" size={15} style={{ color: 'var(--label-3)' }} />
            </div>
          </button>
        ))}
      </div>
      <div className="h-8" />
      <SectionIndex available={letters} onSelect={scrollToLetter} bottomInset={bottomInset} />
    </Screen>
  );
}

/* ------------------------------------------------------------------- songs */

export function SongsScreen({ pop, bottomInset }) {
  const { songs } = useLibrary();
  const { playQueue } = usePlayer();
  const scrollRef = useRef(null);
  const { scrollToLetter, letters } = useLetterIndex(songs, (track) => track.title, scrollRef);

  const ids = useMemo(() => songs.map((track) => track.id), [songs]);

  return (
    <Screen
      title="Songs"
      onBack={pop}
      backLabel="Library"
      bottomInset={bottomInset}
      scrollRef={scrollRef}
    >
      <div className="pt-1">
        {songs.map((track, index) => (
          <div key={track.id} data-letter={sectionLetter(track.title)}>
            <TrackRow
              track={track}
              onPlay={() => playQueue(ids, index, { source: { title: 'Songs' } })}
            />
          </div>
        ))}
      </div>
      <div className="h-8" />
      <SectionIndex available={letters} onSelect={scrollToLetter} bottomInset={bottomInset} />
    </Screen>
  );
}

/* ------------------------------------------------------------------ genres */

export function GenresScreen({ pop, push, bottomInset }) {
  const { genres } = useLibrary();

  if (genres.length === 0) {
    return (
      <Screen title="Genres" onBack={pop} backLabel="Library" bottomInset={bottomInset}>
        <EmptyState
          icon="sparkles"
          title="No Genres"
          message="None of your songs carry a genre tag."
        />
      </Screen>
    );
  }

  return (
    <Screen title="Genres" onBack={pop} backLabel="Library" bottomInset={bottomInset}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-5 px-4 pt-2">
        {genres.map((genre) => (
          <button
            key={genre.key}
            type="button"
            className="springy text-left"
            onClick={() => push('genre', { genreKey: genre.key })}
          >
            <Artwork
              trackId={genre.artworkId}
              radius={7}
              className="w-full"
              style={{ aspectRatio: '1 / 1', boxShadow: '0 2px 10px rgba(0,0,0,0.16)' }}
            />
            <p className="t-footnote truncate-1 mt-1.5" style={{ fontWeight: 500 }}>
              {genre.name}
            </p>
            <p className="t-footnote" style={{ color: 'var(--label-2)' }}>
              {genre.tracks.length} song{genre.tracks.length === 1 ? '' : 's'}
            </p>
          </button>
        ))}
      </div>
      <div className="h-8" />
    </Screen>
  );
}

export function GenreScreen({ pop, params, bottomInset }) {
  const { genres } = useLibrary();
  const { playQueue } = usePlayer();
  const genre = genres.find((item) => item.key === params.genreKey);

  if (!genre) {
    return <Screen title="Genre" onBack={pop} backLabel="Genres" bottomInset={bottomInset} />;
  }

  const ids = genre.tracks.map((track) => track.id);

  return (
    <Screen title={genre.name} onBack={pop} backLabel="Genres" bottomInset={bottomInset}>
      <div className="pt-1">
        {genre.tracks.map((track, index) => (
          <TrackRow
            key={track.id}
            track={track}
            onPlay={() => playQueue(ids, index, { source: { title: genre.name } })}
          />
        ))}
      </div>
      <div className="h-8" />
    </Screen>
  );
}

/* ------------------------------------------------------------------- loved */

export function LovedScreen({ pop, bottomInset }) {
  const { favorites } = useLibrary();
  const { playQueue } = usePlayer();
  const ids = favorites.map((track) => track.id);

  return (
    <Screen title="Loved" onBack={pop} backLabel="Library" bottomInset={bottomInset}>
      {favorites.length === 0 ? (
        <EmptyState
          icon="heart"
          title="Nothing Loved Yet"
          message="Press and hold any song to love it. Loved songs collect here."
        />
      ) : (
        <div className="pt-1">
          {favorites.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              onPlay={() => playQueue(ids, index, { source: { title: 'Loved' } })}
            />
          ))}
        </div>
      )}
      <div className="h-8" />
    </Screen>
  );
}

/* ------------------------------------------------------------------ artist */

export function ArtistScreen({ pop, push, params, bottomInset }) {
  const { artists } = useLibrary();
  const { playQueue } = usePlayer();
  const { collectionMenu } = useActions();
  const { open } = useMenu();

  const artist = artists.find((item) => item.key === params.artistKey);
  const allIds = useMemo(
    () => artist?.albums.flatMap((album) => album.tracks.map((track) => track.id)) ?? [],
    [artist],
  );

  const longPress = useLongPress((rect) => open(rect, collectionMenu(allIds)));

  if (!artist) {
    return <Screen title="Artist" onBack={pop} backLabel="Artists" bottomInset={bottomInset} />;
  }

  return (
    <Screen
      title={artist.name}
      onBack={pop}
      backLabel="Artists"
      bottomInset={bottomInset}
      header={
        <div className="flex flex-col items-center px-4 pb-4 pt-1" {...longPress}>
          <Artwork
            trackId={artist.artworkId}
            size={148}
            radius={74}
            eager
            style={{ boxShadow: '0 8px 26px rgba(0,0,0,0.3)' }}
          />
          <button
            type="button"
            className="springy mt-4 flex items-center gap-2 px-6 py-2.5"
            style={{ background: 'var(--tint)', color: '#fff', borderRadius: 22 }}
            onClick={() => playQueue(allIds, 0, { shuffle: true, source: { title: artist.name } })}
          >
            <Icon name="shuffle" size={16} />
            <span className="t-headline">Shuffle</span>
          </button>
        </div>
      }
    >
      {artist.albums.map((album) => (
        <section key={album.key} className="pb-2">
          <button
            type="button"
            className="row-press flex w-full items-center gap-3 px-4 py-2"
            onClick={() => push('album', { albumKey: album.key })}
          >
            <Artwork trackId={album.artworkId} size={58} radius={6} />
            <div className="min-w-0 flex-1 text-left">
              <p className="t-headline truncate-1">{album.title}</p>
              <p className="t-footnote" style={{ color: 'var(--label-2)' }}>
                {album.year ? `${album.year} · ` : ''}
                {album.tracks.length} song{album.tracks.length === 1 ? '' : 's'}
              </p>
            </div>
            <Icon name="chevron.right" size={15} style={{ color: 'var(--label-3)' }} />
          </button>
        </section>
      ))}
      <div className="h-8" />
    </Screen>
  );
}

/* ------------------------------------------------------------------ shared */

/** Wires an A–Z strip to a list whose rows carry `data-letter`. */
function useLetterIndex(items, selector, scrollRef) {
  const letters = useMemo(
    () => new Set(items.map((item) => sectionLetter(selector(item)))),
    [items, selector],
  );

  const scrollToLetter = useCallback(
    (letter) => {
      const container = scrollRef.current;
      const target = container?.querySelector(`[data-letter="${letter}"]`);
      if (!container || !target) return;
      const offset =
        target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
      container.scrollTo({ top: Math.max(0, offset - 8), behavior: 'auto' });
    },
    [scrollRef],
  );

  return { letters, scrollToLetter };
}
