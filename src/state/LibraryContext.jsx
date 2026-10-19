import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  clearLibrary,
  deletePlaylist,
  deleteTrack,
  estimateUsage,
  getAllPlaylists,
  getAllTracks,
  putArtwork,
  putPlaylist,
  putTrack,
  updateTrack,
} from '../lib/db.js';
import { probeDuration, readTags } from '../lib/tags.js';
import { releaseAllArtwork, releaseArtwork } from '../lib/artwork.js';
import { albumKeyOf, artistKeyOf, byName, collator, sortKey, uid } from '../lib/format.js';

const LibraryContext = createContext(null);

export const useLibrary = () => {
  const value = useContext(LibraryContext);
  if (!value) throw new Error('useLibrary must be used inside <LibraryProvider>');
  return value;
};

const AUDIO_PATTERN = /\.(mp3|m4a|m4b|aac|flac|wav|ogg|oga|opus|weba|webm|mp4|alac|aiff?|caf)$/i;

const isAudioFile = (file) =>
  file.type.startsWith('audio/') || AUDIO_PATTERN.test(file.name ?? '');

/** Identity used to skip files that are already in the library. */
const fingerprint = (file) => `${file.name}::${file.size}`;

/** Centre-crops an image file to a square JPEG, capped at `max` pixels. */
function squareJpeg(file, max) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      const source = Math.min(image.naturalWidth, image.naturalHeight);
      if (!source) return resolve(null);

      const edge = Math.min(max, source);
      const canvas = document.createElement('canvas');
      canvas.width = edge;
      canvas.height = edge;
      canvas
        .getContext('2d')
        .drawImage(
          image,
          (image.naturalWidth - source) / 2,
          (image.naturalHeight - source) / 2,
          source,
          source,
          0,
          0,
          edge,
          edge,
        );
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.88);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}

export function LibraryProvider({ children }) {
  const [tracks, setTracks] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [ready, setReady] = useState(false);
  const [importState, setImportState] = useState(null); // { done, total, current }
  const [usage, setUsage] = useState(null);

  const fingerprints = useRef(new Set());

  const refreshUsage = useCallback(() => {
    estimateUsage().then(setUsage);
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getAllTracks(), getAllPlaylists()])
      .then(([storedTracks, storedPlaylists]) => {
        if (cancelled) return;
        fingerprints.current = new Set(storedTracks.map((track) => track.fingerprint));
        setTracks(storedTracks);
        setPlaylists(storedPlaylists);
        setReady(true);
        refreshUsage();
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshUsage]);

  useEffect(() => releaseAllArtwork, []);

  /* ------------------------------------------------------------- importing */

  const importFiles = useCallback(
    async (fileList) => {
      const files = [...fileList].filter(isAudioFile);
      if (files.length === 0) {
        setImportState(null);
        return { added: 0, skipped: 0, failed: 0 };
      }

      // Ask the browser to stop evicting our data once a real library exists.
      navigator.storage?.persist?.().catch(() => {});

      let added = 0;
      let skipped = 0;
      let failed = 0;
      const imported = [];

      setImportState({ done: 0, total: files.length, current: files[0].name });

      for (const [index, file] of files.entries()) {
        setImportState({ done: index, total: files.length, current: file.name });

        const print = fingerprint(file);
        if (fingerprints.current.has(print)) {
          skipped += 1;
          continue;
        }

        try {
          const [tags, duration] = await Promise.all([readTags(file), probeDuration(file)]);
          const id = uid();
          const track = {
            id,
            fingerprint: print,
            title: tags.title,
            artist: tags.artist,
            album: tags.album,
            albumArtist: tags.albumArtist,
            genre: tags.genre,
            year: tags.year,
            trackNo: tags.trackNo,
            discNo: tags.discNo,
            duration,
            fileName: file.name,
            mime: file.type || 'audio/mpeg',
            size: file.size,
            addedAt: Date.now(),
            playCount: 0,
            lastPlayedAt: null,
            favorite: false,
            hasArtwork: Boolean(tags.picture),
            albumKey: '',
            artistKey: '',
          };
          track.albumKey = albumKeyOf(track);
          track.artistKey = artistKeyOf(track);

          await putTrack(track, { audio: file, artwork: tags.picture ?? undefined });
          fingerprints.current.add(print);
          imported.push(track);
          added += 1;

          // Surface tracks in batches so a large import fills the list as it runs.
          if (imported.length >= 12) {
            const batch = imported.splice(0, imported.length);
            setTracks((current) => [...current, ...batch]);
          }
        } catch {
          failed += 1;
        }
      }

      if (imported.length) setTracks((current) => [...current, ...imported]);
      setImportState(null);
      refreshUsage();
      return { added, skipped, failed };
    },
    [refreshUsage],
  );

  /* --------------------------------------------------------------- mutation */

  const removeTrack = useCallback(
    async (id) => {
      const track = tracks.find((item) => item.id === id);
      await deleteTrack(id);
      releaseArtwork(id);
      if (track) fingerprints.current.delete(track.fingerprint);
      setTracks((current) => current.filter((item) => item.id !== id));
      setPlaylists((current) =>
        current.map((playlist) =>
          playlist.trackIds.includes(id)
            ? { ...playlist, trackIds: playlist.trackIds.filter((trackId) => trackId !== id) }
            : playlist,
        ),
      );
      refreshUsage();
    },
    [refreshUsage, tracks],
  );

  /**
   * Attaches a cover to a track from an image file, applied across every track
   * on the same album — "album artwork" is what people mean by this, and the
   * album grid picks its cover from the first track that has one.
   *
   * The image is re-encoded to a square JPEG so a 12MP photo doesn't end up
   * sitting in IndexedDB.
   */
  const setArtwork = useCallback(
    async (trackId, file) => {
      const track = tracks.find((item) => item.id === trackId);
      if (!track || !file) return;

      const blob = await squareJpeg(file, 1000);
      if (!blob) return;

      const targets = tracks.filter((item) => item.albumKey === track.albumKey);
      await Promise.all(
        targets.map(async (item) => {
          await putArtwork(item.id, blob);
          await updateTrack(item.id, { hasArtwork: true });
          // Drop the cached object URL so every view re-reads the new cover.
          releaseArtwork(item.id);
        }),
      );

      const ids = new Set(targets.map((item) => item.id));
      setTracks((current) =>
        current.map((item) => (ids.has(item.id) ? { ...item, hasArtwork: true } : item)),
      );
      refreshUsage();
    },
    [refreshUsage, tracks],
  );

  /**
   * Rewrites tags on one or more tracks.
   *
   * Album and artist keys are derived, so they have to be recomputed here —
   * renaming an album is what actually moves a track into a different group,
   * and the grid and artist lists read straight off those keys.
   *
   * Only the audio file on disk is left alone; this edits the library's copy of
   * the metadata, not the file's own tags.
   */
  const editTracks = useCallback(async (ids, patch) => {
    const targets = new Set(ids);
    const next = new Map();

    setTracks((current) =>
      current.map((track) => {
        if (!targets.has(track.id)) return track;
        const edited = { ...track, ...patch };
        edited.albumKey = albumKeyOf(edited);
        edited.artistKey = artistKeyOf(edited);
        next.set(track.id, edited);
        return edited;
      }),
    );

    await Promise.all([...next.values()].map((track) => updateTrack(track.id, track)));
    return [...next.values()];
  }, []);

  const toggleFavorite = useCallback(async (id) => {
    let next = false;
    setTracks((current) =>
      current.map((track) => {
        if (track.id !== id) return track;
        next = !track.favorite;
        return { ...track, favorite: next };
      }),
    );
    await updateTrack(id, { favorite: next });
  }, []);

  const registerPlay = useCallback(async (id) => {
    const stamp = Date.now();
    let playCount = 1;
    setTracks((current) =>
      current.map((track) => {
        if (track.id !== id) return track;
        playCount = (track.playCount ?? 0) + 1;
        return { ...track, playCount, lastPlayedAt: stamp };
      }),
    );
    await updateTrack(id, { playCount, lastPlayedAt: stamp });
  }, []);

  const createPlaylist = useCallback(async (name, trackIds = []) => {
    const playlist = {
      id: uid(),
      name: name.trim() || 'New Playlist',
      trackIds,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await putPlaylist(playlist);
    setPlaylists((current) => [...current, playlist]);
    return playlist;
  }, []);

  const savePlaylist = useCallback(async (id, patch) => {
    let saved = null;
    setPlaylists((current) =>
      current.map((playlist) => {
        if (playlist.id !== id) return playlist;
        saved = { ...playlist, ...patch, updatedAt: Date.now() };
        return saved;
      }),
    );
    if (saved) await putPlaylist(saved);
    return saved;
  }, []);

  const addToPlaylist = useCallback(
    (playlistId, trackIds) => {
      const playlist = playlists.find((item) => item.id === playlistId);
      if (!playlist) return null;
      const additions = trackIds.filter((id) => !playlist.trackIds.includes(id));
      if (additions.length === 0) return playlist;
      return savePlaylist(playlistId, { trackIds: [...playlist.trackIds, ...additions] });
    },
    [playlists, savePlaylist],
  );

  const removePlaylist = useCallback(async (id) => {
    await deletePlaylist(id);
    setPlaylists((current) => current.filter((playlist) => playlist.id !== id));
  }, []);

  const wipeLibrary = useCallback(async () => {
    await clearLibrary();
    releaseAllArtwork();
    fingerprints.current = new Set();
    setTracks([]);
    setPlaylists([]);
    refreshUsage();
  }, [refreshUsage]);

  /* ---------------------------------------------------------------- derived */

  const albums = useMemo(() => {
    const grouped = new Map();
    for (const track of tracks) {
      let album = grouped.get(track.albumKey);
      if (!album) {
        album = {
          key: track.albumKey,
          title: track.album,
          artist: track.albumArtist || track.artist,
          year: track.year,
          tracks: [],
          duration: 0,
        };
        grouped.set(track.albumKey, album);
      }
      album.tracks.push(track);
      album.duration += track.duration || 0;
      if (!album.year && track.year) album.year = track.year;
    }

    for (const album of grouped.values()) {
      album.tracks.sort(
        (a, b) =>
          (a.discNo ?? 1) - (b.discNo ?? 1) ||
          (a.trackNo ?? 9999) - (b.trackNo ?? 9999) ||
          collator.compare(a.title, b.title),
      );
      // The first track with art is the one whose cover represents the album.
      album.artworkId = album.tracks.find((track) => track.hasArtwork)?.id ?? null;
      album.addedAt = Math.max(...album.tracks.map((track) => track.addedAt));
    }

    return [...grouped.values()].sort(byName((album) => album.title));
  }, [tracks]);

  const artists = useMemo(() => {
    const grouped = new Map();
    for (const album of albums) {
      const key = sortKey(album.artist);
      let artist = grouped.get(key);
      if (!artist) {
        artist = { key, name: album.artist, albums: [], trackCount: 0, artworkId: null };
        grouped.set(key, artist);
      }
      artist.albums.push(album);
      artist.trackCount += album.tracks.length;
      artist.artworkId ??= album.artworkId;
    }
    for (const artist of grouped.values()) {
      artist.albums.sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || collator.compare(a.title, b.title));
    }
    return [...grouped.values()].sort(byName((artist) => artist.name));
  }, [albums]);

  const songs = useMemo(() => [...tracks].sort(byName((track) => track.title)), [tracks]);

  const favorites = useMemo(
    () => songs.filter((track) => track.favorite),
    [songs],
  );

  const recentlyAdded = useMemo(
    () => [...albums].sort((a, b) => b.addedAt - a.addedAt).slice(0, 24),
    [albums],
  );

  const recentlyPlayed = useMemo(
    () =>
      tracks
        .filter((track) => track.lastPlayedAt)
        .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
        .slice(0, 25),
    [tracks],
  );

  const trackById = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks]);

  const genres = useMemo(() => {
    const grouped = new Map();
    for (const track of tracks) {
      const name = track.genre?.trim();
      if (!name) continue;
      const key = sortKey(name);
      let genre = grouped.get(key);
      if (!genre) {
        genre = { key, name, tracks: [], artworkId: null };
        grouped.set(key, genre);
      }
      genre.tracks.push(track);
      genre.artworkId ??= track.hasArtwork ? track.id : null;
    }
    return [...grouped.values()].sort(byName((genre) => genre.name));
  }, [tracks]);

  const value = useMemo(
    () => ({
      ready,
      tracks,
      songs,
      albums,
      artists,
      genres,
      playlists,
      favorites,
      recentlyAdded,
      recentlyPlayed,
      trackById,
      importState,
      usage,
      importFiles,
      editTracks,
      removeTrack,
      setArtwork,
      toggleFavorite,
      registerPlay,
      createPlaylist,
      savePlaylist,
      addToPlaylist,
      removePlaylist,
      wipeLibrary,
      refreshUsage,
    }),
    [
      ready,
      tracks,
      songs,
      albums,
      artists,
      genres,
      playlists,
      favorites,
      recentlyAdded,
      recentlyPlayed,
      trackById,
      importState,
      usage,
      importFiles,
      editTracks,
      removeTrack,
      setArtwork,
      toggleFavorite,
      registerPlay,
      createPlaylist,
      savePlaylist,
      addToPlaylist,
      removePlaylist,
      wipeLibrary,
      refreshUsage,
    ],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}
