import { useMemo, useRef, useState } from 'react';

import Icon from '../ui/Icon.jsx';
import Artwork from '../ui/Artwork.jsx';
import TrackRow from '../ui/TrackRow.jsx';
import { EmptyState } from '../ui/Collection.jsx';
import { useLibrary } from '../state/LibraryContext.jsx';
import { usePlayer } from '../state/PlayerContext.jsx';

/** Lower-cased and stripped of accents, so "bjork" finds "Björk". */
const normalise = (value) =>
  (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export default function SearchScreen({ push, bottomInset }) {
  const { songs, albums, artists } = useLibrary();
  const { playQueue } = usePlayer();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  const results = useMemo(() => {
    const needle = normalise(query.trim());
    if (!needle) return null;

    const matches = (value) => normalise(value).includes(needle);

    return {
      artists: artists.filter((artist) => matches(artist.name)).slice(0, 6),
      albums: albums.filter((album) => matches(album.title) || matches(album.artist)).slice(0, 8),
      songs: songs
        .filter((track) => matches(track.title) || matches(track.artist) || matches(track.album))
        .slice(0, 60),
    };
  }, [albums, artists, query, songs]);

  const empty =
    results && results.artists.length === 0 && results.albums.length === 0 && results.songs.length === 0;

  return (
    <div className="relative h-full" style={{ background: 'var(--bg-plain)' }}>
      {/* --- Search bar ------------------------------------------------ */}
      <div
        className="glass absolute inset-x-0 top-0 z-30"
        style={{ paddingTop: 'var(--safe-top)', borderRadius: 0, boxShadow: 'none' }}
      >
        <h1 className="t-large-title px-4 pb-1 pt-1.5">Search</h1>
        <div className="flex items-center gap-2.5 px-4 pb-2.5">
          <div
            className="glass glass-thin flex min-w-0 flex-1 items-center gap-1.5 px-3"
            style={{ borderRadius: 19, height: 38 }}
          >
            <Icon name="search" size={16} style={{ color: 'var(--label-2)' }} />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setFocused(true)}
              placeholder="Artists, Songs, Albums"
              enterKeyHint="search"
              className="t-body min-w-0 flex-1 bg-transparent outline-none"
              style={{ color: 'var(--label)' }}
            />
            {query && (
              <button
                type="button"
                aria-label="Clear"
                onClick={() => setQuery('')}
                style={{ color: 'var(--label-3)' }}
              >
                <Icon name="xmark" size={14} />
              </button>
            )}
          </div>

          {/* The Cancel button slides in only once the field is engaged. */}
          <button
            type="button"
            className="bar-btn t-body shrink-0 overflow-hidden"
            style={{
              color: 'var(--tint)',
              maxWidth: focused || query ? 70 : 0,
              opacity: focused || query ? 1 : 0,
              transition: 'max-width 0.3s var(--ease-ios), opacity 0.24s var(--ease-ios)',
            }}
            onClick={() => {
              setQuery('');
              setFocused(false);
              inputRef.current?.blur();
            }}
          >
            Cancel
          </button>
        </div>
      </div>

      {/* --- Results --------------------------------------------------- */}
      <div
        className="ios-scroll h-full"
        style={{
          paddingTop: `calc(var(--safe-top) + 96px)`,
          paddingBottom: bottomInset,
        }}
      >
        {!results && (
          <EmptyState icon="search" title="Search Your Library" message="Find any song, album, or artist." />
        )}

        {empty && (
          <EmptyState icon="search" title="No Results" message={`Nothing matched “${query.trim()}”.`} />
        )}

        {results?.artists.length > 0 && (
          <Section title="Artists">
            {results.artists.map((artist) => (
              <button
                key={artist.key}
                type="button"
                className="row-press flex w-full items-center gap-3 pl-4"
                onClick={() => push('artist', { artistKey: artist.key })}
              >
                <Artwork trackId={artist.artworkId} size={46} radius={23} />
                <div
                  className="flex min-w-0 flex-1 items-center justify-between py-2.5 pr-4"
                  style={{ boxShadow: 'inset 0 -0.5px 0 var(--separator)' }}
                >
                  <span className="t-body truncate-1">{artist.name}</span>
                  <Icon name="chevron.right" size={15} style={{ color: 'var(--label-3)' }} />
                </div>
              </button>
            ))}
          </Section>
        )}

        {results?.albums.length > 0 && (
          <Section title="Albums">
            {results.albums.map((album) => (
              <button
                key={album.key}
                type="button"
                className="row-press flex w-full items-center gap-3 pl-4"
                onClick={() => push('album', { albumKey: album.key })}
              >
                <Artwork trackId={album.artworkId} size={46} radius={5} />
                <div
                  className="flex min-w-0 flex-1 items-center justify-between py-2.5 pr-4"
                  style={{ boxShadow: 'inset 0 -0.5px 0 var(--separator)' }}
                >
                  <div className="min-w-0 text-left">
                    <p className="t-body truncate-1">{album.title}</p>
                    <p className="t-footnote truncate-1" style={{ color: 'var(--label-2)' }}>
                      {album.artist}
                    </p>
                  </div>
                  <Icon name="chevron.right" size={15} style={{ color: 'var(--label-3)' }} />
                </div>
              </button>
            ))}
          </Section>
        )}

        {results?.songs.length > 0 && (
          <Section title="Songs">
            {results.songs.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                onPlay={() =>
                  playQueue(
                    results.songs.map((item) => item.id),
                    index,
                    { source: { title: 'Search Results' } },
                  )
                }
              />
            ))}
          </Section>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="pt-3">
      <h2 className="t-title3 px-4 pb-1.5">{title}</h2>
      {children}
    </section>
  );
}
