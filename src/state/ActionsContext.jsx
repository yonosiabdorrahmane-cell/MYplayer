import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import Icon from '../ui/Icon.jsx';
import Sheet from '../ui/Sheet.jsx';
import Artwork from '../ui/Artwork.jsx';
import EditDetails from '../ui/EditDetails.jsx';
import { useLibrary } from './LibraryContext.jsx';
import { usePlayer } from './PlayerContext.jsx';
import { haptic } from '../lib/format.js';

const ActionsContext = createContext(null);

export const useActions = () => {
  const value = useContext(ActionsContext);
  if (!value) throw new Error('useActions must be used inside <ActionsProvider>');
  return value;
};

/**
 * The menu items a track offers everywhere it appears, plus the sheets those
 * items need. Keeping them here means every list shows the same options.
 */
export function ActionsProvider({ children }) {
  const { tracks, playlists, addToPlaylist, createPlaylist, toggleFavorite, removeTrack,
    setArtwork, editTracks } = useLibrary();
  const { playNext, playLater } = usePlayer();

  const [adding, setAdding] = useState(null); // track ids awaiting a playlist
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editing, setEditing] = useState(null); // { scope, ids }

  const openAddToPlaylist = useCallback((trackIds) => setAdding([].concat(trackIds)), []);

  // A file input has to be triggered from the DOM, so one hidden input is kept
  // mounted here and pointed at whichever track asked for a cover.
  const artworkInputRef = useRef(null);
  const artworkTargetRef = useRef(null);

  const pickArtworkFor = useCallback((trackId) => {
    artworkTargetRef.current = trackId;
    artworkInputRef.current?.click();
  }, []);

  const trackMenu = useCallback(
    (track, extra = []) => [
      { label: 'Play Next', icon: 'text.badge.plus', onSelect: () => playNext(track.id) },
      { label: 'Play Last', icon: 'queue', onSelect: () => playLater(track.id) },
      {
        label: track.favorite ? 'Unlove' : 'Love',
        icon: track.favorite ? 'heart.fill' : 'heart',
        onSelect: () => toggleFavorite(track.id),
      },
      { label: 'Add to Playlist…', icon: 'plus', onSelect: () => openAddToPlaylist(track.id) },
      {
        label: track.hasArtwork ? 'Replace Artwork…' : 'Add Artwork…',
        icon: 'albums',
        onSelect: () => pickArtworkFor(track.id),
      },
      {
        label: 'Edit Details…',
        icon: 'text.badge.plus',
        onSelect: () => setEditing({ scope: 'track', ids: [track.id] }),
      },
      ...extra,
      {
        label: 'Delete from Library',
        icon: 'trash',
        destructive: true,
        onSelect: () => setConfirmDelete(track),
      },
    ],
    [openAddToPlaylist, pickArtworkFor, playLater, playNext, toggleFavorite],
  );

  const collectionMenu = useCallback(
    (trackIds, { editable = false } = {}) => [
      { label: 'Play Next', icon: 'text.badge.plus', onSelect: () => playNext(trackIds) },
      { label: 'Play Last', icon: 'queue', onSelect: () => playLater(trackIds) },
      { label: 'Add to Playlist…', icon: 'plus', onSelect: () => openAddToPlaylist(trackIds) },
      ...(trackIds.length
        ? [
            {
              label: 'Change Artwork…',
              icon: 'albums',
              onSelect: () => pickArtworkFor(trackIds[0]),
            },
          ]
        : []),
      ...(editable
        ? [
            {
              label: 'Edit Details…',
              icon: 'text.badge.plus',
              onSelect: () => setEditing({ scope: 'album', ids: trackIds }),
            },
          ]
        : []),
    ],
    [openAddToPlaylist, pickArtworkFor, playLater, playNext],
  );

  const value = useMemo(
    () => ({ trackMenu, collectionMenu, openAddToPlaylist }),
    [collectionMenu, openAddToPlaylist, trackMenu],
  );

  const commitNewPlaylist = async () => {
    const name = newName.trim();
    if (!name) return;
    await createPlaylist(name, adding ?? []);
    haptic(10);
    setNewName('');
    setCreating(false);
    setAdding(null);
  };

  return (
    <ActionsContext.Provider value={value}>
      {children}

      <input
        ref={artworkInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          const trackId = artworkTargetRef.current;
          event.target.value = '';
          if (!file || !trackId) return;
          await setArtwork(trackId, file);
          haptic(10);
        }}
      />

      {/* --- Edit details ---------------------------------------------- */}
      <Sheet
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.scope === 'album' ? 'Album Details' : 'Song Details'}
        height="92vh"
        allowDrag={false}
      >
        {editing && (
          <EditDetails
            // Remounting per target resets the form to that track's values.
            key={editing.ids.join(',')}
            scope={editing.scope}
            tracks={tracks.filter((track) => editing.ids.includes(track.id))}
            onCancel={() => setEditing(null)}
            onSave={async (patch) => {
              await editTracks(editing.ids, patch);
              setEditing(null);
            }}
          />
        )}
      </Sheet>

      {/* --- Add to playlist ------------------------------------------- */}
      <Sheet
        open={Boolean(adding) && !creating}
        onClose={() => setAdding(null)}
        title="Add to Playlist"
        height="56vh"
      >
        <button
          type="button"
          className="row-press hairline-b flex w-full items-center gap-3 px-4 py-3"
          onClick={() => setCreating(true)}
        >
          <div
            className="flex items-center justify-center"
            style={{ width: 46, height: 46, borderRadius: 8, background: 'var(--fill-3)', color: 'var(--tint)' }}
          >
            <Icon name="plus" size={22} />
          </div>
          <span className="t-body" style={{ color: 'var(--tint)' }}>
            New Playlist
          </span>
        </button>

        {playlists.length === 0 ? (
          <p className="t-subhead px-4 py-8 text-center" style={{ color: 'var(--label-2)' }}>
            No playlists yet.
          </p>
        ) : (
          playlists.map((playlist) => (
            <button
              key={playlist.id}
              type="button"
              className="row-press hairline-b flex w-full items-center gap-3 px-4 py-2.5"
              onClick={async () => {
                await addToPlaylist(playlist.id, adding);
                haptic(10);
                setAdding(null);
              }}
            >
              <Artwork trackId={playlist.trackIds[0]} size={46} radius={8} eager />
              <div className="min-w-0 flex-1 text-left">
                <p className="t-body truncate-1">{playlist.name}</p>
                <p className="t-footnote" style={{ color: 'var(--label-2)' }}>
                  {playlist.trackIds.length} song{playlist.trackIds.length === 1 ? '' : 's'}
                </p>
              </div>
            </button>
          ))
        )}
      </Sheet>

      {/* --- New playlist name ----------------------------------------- */}
      <Sheet
        open={creating}
        onClose={() => setCreating(false)}
        title="New Playlist"
        height="42vh"
      >
        <div className="px-4 pt-4">
          <input
            autoFocus
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && commitNewPlaylist()}
            placeholder="Playlist Name"
            className="t-body w-full outline-none"
            style={{
              background: 'var(--fill-3)',
              borderRadius: 10,
              padding: '11px 14px',
              color: 'var(--label)',
            }}
          />
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              className="glass glass-thin glass-press t-headline flex-1 py-3.5"
              style={{ borderRadius: 22 }}
              onClick={() => setCreating(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="glass-press t-headline flex-1 py-3.5"
              style={{ background: 'var(--tint)', color: '#fff', borderRadius: 22 }}
              onClick={commitNewPlaylist}
            >
              Create
            </button>
          </div>
        </div>
      </Sheet>

      {/* --- Destructive confirmation ---------------------------------- */}
      <Sheet
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete Song"
        height="36vh"
      >
        <div className="px-5 pt-3">
          <p className="t-subhead text-center" style={{ color: 'var(--label-2)' }}>
            “{confirmDelete?.title}” will be removed from this device. This can’t be undone.
          </p>
          <button
            type="button"
            className="glass-press t-headline mt-5 w-full py-3.5"
            style={{ background: '#ff453a', color: '#fff', borderRadius: 22 }}
            onClick={async () => {
              await removeTrack(confirmDelete.id);
              haptic([14]);
              setConfirmDelete(null);
            }}
          >
            Delete Song
          </button>
          <button
            type="button"
            className="glass glass-thin glass-press t-headline mt-2.5 w-full py-3.5"
            style={{ borderRadius: 22 }}
            onClick={() => setConfirmDelete(null)}
          >
            Cancel
          </button>
        </div>
      </Sheet>
    </ActionsContext.Provider>
  );
}
