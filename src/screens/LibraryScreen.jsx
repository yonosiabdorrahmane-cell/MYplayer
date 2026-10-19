import Screen from '../ui/Screen.jsx';
import Icon from '../ui/Icon.jsx';
import Artwork from '../ui/Artwork.jsx';
import ImportButton from '../ui/ImportButton.jsx';
import { AlbumTile, DisclosureRow, EmptyState } from '../ui/Collection.jsx';
import { useLibrary } from '../state/LibraryContext.jsx';
import { usePlayer } from '../state/PlayerContext.jsx';
import { haptic } from '../lib/format.js';

/** The Library tab root: category rows, then Recently Added, then a shelf of recents. */
export default function LibraryScreen({ push, bottomInset }) {
  const { albums, artists, songs, genres, favorites, recentlyAdded, recentlyPlayed, tracks } =
    useLibrary();
  const { playQueue } = usePlayer();

  const categories = [
    { icon: 'person', label: 'Artists', detail: artists.length, route: 'artists' },
    { icon: 'albums', label: 'Albums', detail: albums.length, route: 'albums' },
    { icon: 'note', label: 'Songs', detail: songs.length, route: 'songs' },
    { icon: 'sparkles', label: 'Genres', detail: genres.length, route: 'genres' },
    { icon: 'heart', label: 'Loved', detail: favorites.length, route: 'loved' },
  ];

  if (tracks.length === 0) {
    return (
      <Screen title="Library" bottomInset={bottomInset}>
        <EmptyState
          icon="folder"
          title="No Music Yet"
          message="Add songs from this device to build your library. Everything stays offline, on your phone."
          action={
            <div className="flex flex-col gap-2.5">
              <ImportButton
                folder
                className="glass-press t-headline px-7 py-3.5"
                style={{ background: 'var(--tint)', color: '#fff', borderRadius: 24 }}
              >
                Add a Folder
              </ImportButton>
              <ImportButton
                className="glass glass-thin glass-press t-headline px-7 py-3.5"
                style={{ borderRadius: 24 }}
              >
                Add Files
              </ImportButton>
            </div>
          }
        />
      </Screen>
    );
  }

  return (
    <Screen
      title="Library"
      bottomInset={bottomInset}
      trailing={
        <ImportButton
          folder
          className="glass glass-thin glass-press flex items-center justify-center"
          style={{ width: 36, height: 36, borderRadius: 18, color: 'var(--tint)' }}
        >
          <Icon name="plus" size={20} />
        </ImportButton>
      }
    >
      <div className="mt-1">
        {categories.map((category, index) => (
          <DisclosureRow
            key={category.route}
            icon={category.icon}
            label={category.label}
            detail={category.detail || undefined}
            last={index === categories.length - 1}
            onClick={() => push(category.route)}
          />
        ))}
      </div>

      {recentlyAdded.length > 0 && (
        <section className="mt-7">
          <h2 className="t-title2 px-4 pb-2.5">Recently Added</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 px-4">
            {recentlyAdded.slice(0, 8).map((album) => (
              <AlbumTile
                key={album.key}
                album={album}
                onOpen={() => push('album', { albumKey: album.key })}
              />
            ))}
          </div>
        </section>
      )}

      {recentlyPlayed.length > 0 && (
        <section className="mt-8">
          <h2 className="t-title2 px-4 pb-2.5">Recently Played</h2>
          <div
            className="ios-scroll flex gap-3.5 px-4 pb-1"
            style={{ overflowX: 'auto', scrollSnapType: 'x proximity' }}
          >
            {recentlyPlayed.map((track, index) => (
              <button
                key={track.id}
                type="button"
                className="springy shrink-0 text-left"
                style={{ width: 132, scrollSnapAlign: 'start' }}
                onClick={() => {
                  haptic(10);
                  playQueue(
                    recentlyPlayed.map((item) => item.id),
                    index,
                    { source: { title: 'Recently Played' } },
                  );
                }}
              >
                <Artwork
                  trackId={track.id}
                  size={132}
                  radius={7}
                  style={{ boxShadow: '0 2px 10px rgba(0,0,0,0.16)' }}
                />
                <p className="t-footnote truncate-1 mt-1.5" style={{ fontWeight: 500 }}>
                  {track.title}
                </p>
                <p className="t-footnote truncate-1" style={{ color: 'var(--label-2)' }}>
                  {track.artist}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="h-8" />
    </Screen>
  );
}
