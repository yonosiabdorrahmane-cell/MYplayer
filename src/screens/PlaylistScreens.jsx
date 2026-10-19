import { useMemo, useState } from 'react';

import Screen from '../ui/Screen.jsx';
import Icon from '../ui/Icon.jsx';
import Artwork from '../ui/Artwork.jsx';
import TrackRow from '../ui/TrackRow.jsx';
import Sheet from '../ui/Sheet.jsx';
import { EmptyState, PlayShuffleBar } from '../ui/Collection.jsx';
import { useLongPress, useMenu } from '../ui/ContextMenu.jsx';
import { useLibrary } from '../state/LibraryContext.jsx';
import { usePlayer } from '../state/PlayerContext.jsx';
import { formatDuration, haptic } from '../lib/format.js';

export function PlaylistsScreen({ push, bottomInset }) {
  const { playlists, createPlaylist, removePlaylist } = useLibrary();
  const { open } = useMenu();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const playlist = await createPlaylist(trimmed);
    haptic(10);
    setName('');
    setNaming(false);
    push('playlist', { playlistId: playlist.id });
  };

  return (
    <Screen
      title="Playlists"
      bottomInset={bottomInset}
      trailing={
        <button
          type="button"
          aria-label="New playlist"
          className="glass glass-thin glass-press flex items-center justify-center"
          style={{ width: 36, height: 36, borderRadius: 18, color: 'var(--tint)' }}
          onClick={() => setNaming(true)}
        >
          <Icon name="plus" size={20} />
        </button>
      }
    >
      {playlists.length === 0 ? (
        <EmptyState
          icon="playlist"
          title="No Playlists"
          message="Group songs however you like — by mood, by session, by whatever."
          action={
            <button
              type="button"
              className="glass-press t-headline px-7 py-3.5"
              style={{ background: 'var(--tint)', color: '#fff', borderRadius: 24 }}
              onClick={() => setNaming(true)}
            >
              New Playlist
            </button>
          }
        />
      ) : (
        <div className="pt-1">
          {playlists.map((playlist) => (
            <PlaylistRow
              key={playlist.id}
              playlist={playlist}
              onOpen={() => push('playlist', { playlistId: playlist.id })}
              onMenu={(rect) =>
                open(rect, [
                  {
                    label: 'Delete Playlist',
                    icon: 'trash',
                    destructive: true,
                    onSelect: () => removePlaylist(playlist.id),
                  },
                ])
              }
            />
          ))}
        </div>
      )}

      <Sheet open={naming} onClose={() => setNaming(false)} title="New Playlist" height="42vh">
        <div className="px-4 pt-4">
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && create()}
            placeholder="Playlist Name"
            className="t-body w-full outline-none"
            style={{ background: 'var(--fill-3)', borderRadius: 10, padding: '11px 14px' }}
          />
          <button
            type="button"
            className="glass-press t-headline mt-4 w-full py-3.5"
            style={{ background: 'var(--tint)', color: '#fff', borderRadius: 22 }}
            onClick={create}
          >
            Create
          </button>
        </div>
      </Sheet>

      <div className="h-8" />
    </Screen>
  );
}

function PlaylistRow({ playlist, onOpen, onMenu }) {
  const longPress = useLongPress((rect) => onMenu(rect));

  return (
    <button
      type="button"
      className="row-press flex w-full items-center gap-3 pl-4"
      onClick={onOpen}
      {...longPress}
    >
      <Artwork trackId={playlist.trackIds[0]} size={56} radius={6} />
      <div
        className="flex min-w-0 flex-1 items-center justify-between py-2.5 pr-4"
        style={{ boxShadow: 'inset 0 -0.5px 0 var(--separator)' }}
      >
        <div className="min-w-0 text-left">
          <p className="t-body truncate-1">{playlist.name}</p>
          <p className="t-footnote" style={{ color: 'var(--label-2)' }}>
            {playlist.trackIds.length} song{playlist.trackIds.length === 1 ? '' : 's'}
          </p>
        </div>
        <Icon name="chevron.right" size={15} style={{ color: 'var(--label-3)' }} />
      </div>
    </button>
  );
}

export function PlaylistScreen({ pop, params, bottomInset }) {
  const { playlists, trackById, savePlaylist } = useLibrary();
  const { playQueue } = usePlayer();
  const [editing, setEditing] = useState(false);

  const playlist = playlists.find((item) => item.id === params.playlistId);

  const tracks = useMemo(
    () => (playlist?.trackIds ?? []).map((id) => trackById.get(id)).filter(Boolean),
    [playlist, trackById],
  );

  if (!playlist) {
    return <Screen title="Playlist" onBack={pop} backLabel="Playlists" bottomInset={bottomInset} />;
  }

  const ids = tracks.map((track) => track.id);
  const source = { title: playlist.name };
  const total = tracks.reduce((sum, track) => sum + (track.duration || 0), 0);

  const removeAt = (index) => {
    haptic(8);
    savePlaylist(playlist.id, {
      trackIds: playlist.trackIds.filter((_, position) => position !== index),
    });
  };

  return (
    <Screen
      title={playlist.name}
      largeTitle={false}
      onBack={pop}
      backLabel="Playlists"
      bottomInset={bottomInset}
      trailing={
        tracks.length > 0 && (
          <button
            type="button"
            className="glass glass-thin glass-press t-subhead px-3.5"
            style={{ height: 36, borderRadius: 18, color: 'var(--tint)', fontWeight: 600 }}
            onClick={() => setEditing((value) => !value)}
          >
            {editing ? 'Done' : 'Edit'}
          </button>
        )
      }
    >
      <div className="flex flex-col items-center px-4 pb-1 pt-3">
        <Artwork
          trackId={playlist.trackIds[0]}
          size={214}
          radius={9}
          eager
          style={{ boxShadow: '0 10px 34px rgba(0,0,0,0.34)', maxWidth: '58vw' }}
        />
        <h1 className="t-title3 mt-4 text-center">{playlist.name}</h1>
        <p className="t-footnote mt-0.5" style={{ color: 'var(--label-2)' }}>
          {tracks.length} song{tracks.length === 1 ? '' : 's'}
          {total ? ` · ${formatDuration(total)}` : ''}
        </p>
      </div>

      {tracks.length === 0 ? (
        <EmptyState
          icon="plus"
          title="No Songs"
          message="Press and hold any song, then choose “Add to Playlist”."
        />
      ) : (
        <>
          <PlayShuffleBar
            onPlay={() => playQueue(ids, 0, { source })}
            onShuffle={() => playQueue(ids, 0, { shuffle: true, source })}
          />
          <div>
            {tracks.map((track, index) => (
              <TrackRow
                key={`${track.id}-${index}`}
                track={track}
                onPlay={() => playQueue(ids, index, { source })}
                extraMenuItems={[
                  {
                    label: 'Remove from Playlist',
                    icon: 'xmark',
                    onSelect: () => removeAt(index),
                  },
                ]}
                trailing={
                  editing ? (
                    <button
                      type="button"
                      aria-label="Remove"
                      className="bar-btn flex shrink-0 items-center justify-center"
                      style={{ width: 44, color: '#ff453a' }}
                      onClick={() => removeAt(index)}
                    >
                      <Icon name="xmark" size={17} />
                    </button>
                  ) : undefined
                }
              />
            ))}
          </div>
        </>
      )}
      <div className="h-8" />
    </Screen>
  );
}
