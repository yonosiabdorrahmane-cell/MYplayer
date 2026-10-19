import { useMemo, useState } from 'react';

import Artwork from './Artwork.jsx';
import { haptic } from '../lib/format.js';

/** A grouped-inset form row: label on the left, field filling the rest. */
function Field({ label, value, onChange, placeholder, numeric = false, last = false }) {
  return (
    <div
      className="flex items-center gap-3 pl-4"
      style={{ boxShadow: last ? 'none' : 'inset 0 -0.5px 0 var(--separator)' }}
    >
      <span className="t-body shrink-0" style={{ width: 104, color: 'var(--label-2)' }}>
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={numeric ? 'numeric' : 'text'}
        autoComplete="off"
        autoCapitalize={numeric ? 'off' : 'words'}
        spellCheck={false}
        // The keyboard covers the lower half of a sheet on a phone; nudging the
        // focused row up keeps whatever is being typed in view.
        onFocus={(event) =>
          setTimeout(() => event.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 260)
        }
        className="t-body min-w-0 flex-1 bg-transparent py-3 pr-4 outline-none"
        style={{ color: 'var(--label)' }}
      />
    </div>
  );
}

function Group({ header, children }) {
  return (
    <section className="px-4 pb-5">
      {header && (
        <h2
          className="t-footnote px-4 pb-1.5 uppercase"
          style={{ color: 'var(--label-2)', letterSpacing: 0.2 }}
        >
          {header}
        </h2>
      )}
      <div style={{ background: 'var(--bg-elevated)', borderRadius: 12, overflow: 'hidden' }}>
        {children}
      </div>
    </section>
  );
}

const asText = (value) => (value == null ? '' : String(value));

/** Blank means "no value", not the string "null". */
const cleanText = (value, fallback = null) => {
  const trimmed = value.trim();
  return trimmed === '' ? fallback : trimmed;
};

const cleanNumber = (value) => {
  const digits = value.replace(/[^\d]/g, '');
  if (digits === '') return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/**
 * The details form, in one of two scopes:
 *  - `track` edits a single song, every field
 *  - `album` edits the fields shared by a whole album and writes them to all
 *    of its tracks at once
 *
 * This edits the library's copy of the metadata. The audio files themselves are
 * left untouched, so re-importing a file brings its original tags back.
 */
export default function EditDetails({ scope, tracks, onCancel, onSave }) {
  const first = tracks[0];
  const isAlbum = scope === 'album';

  // Where the album's tracks disagree, show a placeholder instead of pretending
  // one of the values applies to all of them.
  const shared = useMemo(() => {
    const agree = (selector) => {
      const values = new Set(tracks.map(selector));
      return values.size === 1 ? [...values][0] : null;
    };
    return {
      album: agree((track) => track.album),
      albumArtist: agree((track) => track.albumArtist),
      genre: agree((track) => track.genre),
      year: agree((track) => track.year),
      mixed: {
        album: new Set(tracks.map((track) => track.album)).size > 1,
        albumArtist: new Set(tracks.map((track) => track.albumArtist)).size > 1,
        genre: new Set(tracks.map((track) => track.genre)).size > 1,
        year: new Set(tracks.map((track) => track.year)).size > 1,
      },
    };
  }, [tracks]);

  const [form, setForm] = useState(() => ({
    title: asText(first.title),
    artist: asText(first.artist),
    album: asText(isAlbum ? shared.album : first.album),
    albumArtist: asText(isAlbum ? shared.albumArtist : first.albumArtist),
    genre: asText(isAlbum ? shared.genre : first.genre),
    year: asText(isAlbum ? shared.year : first.year),
    trackNo: asText(first.trackNo),
    discNo: asText(first.discNo),
  }));

  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = () => {
    const patch = {
      album: cleanText(form.album, 'Unknown Album'),
      albumArtist: cleanText(form.albumArtist, 'Unknown Artist'),
      genre: cleanText(form.genre),
      year: cleanNumber(form.year),
    };

    if (!isAlbum) {
      patch.title = cleanText(form.title, first.fileName);
      patch.artist = cleanText(form.artist, 'Unknown Artist');
      patch.trackNo = cleanNumber(form.trackNo);
      patch.discNo = cleanNumber(form.discNo);
    } else {
      // An album edit must not blank out fields the tracks disagreed on and the
      // user never touched.
      if (shared.mixed.album && form.album === '') delete patch.album;
      if (shared.mixed.albumArtist && form.albumArtist === '') delete patch.albumArtist;
      if (shared.mixed.genre && form.genre === '') delete patch.genre;
      if (shared.mixed.year && form.year === '') delete patch.year;
    }

    haptic(10);
    onSave(patch);
  };

  return (
    /* Generous bottom padding so the footnote clears the sheet's own edge and
       leaves room to scroll when the keyboard is up. */
    <div className="pb-28">
      <div className="flex flex-col items-center px-4 pb-4 pt-4">
        <Artwork
          trackId={tracks.find((track) => track.hasArtwork)?.id ?? first.id}
          size={104}
          radius={10}
          eager
          style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.3)' }}
        />
        <p className="t-footnote mt-2.5 text-center" style={{ color: 'var(--label-2)' }}>
          {isAlbum
            ? `${tracks.length} song${tracks.length === 1 ? '' : 's'} on this album`
            : first.fileName}
        </p>
      </div>

      {!isAlbum && (
        <Group header="Song">
          <Field label="Title" value={form.title} onChange={set('title')} placeholder="Title" />
          <Field label="Artist" value={form.artist} onChange={set('artist')} placeholder="Artist" />
          <Field
            label="Track"
            value={form.trackNo}
            onChange={set('trackNo')}
            placeholder="—"
            numeric
          />
          <Field
            label="Disc"
            value={form.discNo}
            onChange={set('discNo')}
            placeholder="—"
            numeric
            last
          />
        </Group>
      )}

      <Group header="Album">
        <Field
          label="Album"
          value={form.album}
          onChange={set('album')}
          placeholder={isAlbum && shared.mixed.album ? 'Mixed' : 'Album'}
        />
        <Field
          label="Album Artist"
          value={form.albumArtist}
          onChange={set('albumArtist')}
          placeholder={isAlbum && shared.mixed.albumArtist ? 'Mixed' : 'Album Artist'}
        />
        <Field
          label="Genre"
          value={form.genre}
          onChange={set('genre')}
          placeholder={isAlbum && shared.mixed.genre ? 'Mixed' : 'Genre'}
        />
        <Field
          label="Year"
          value={form.year}
          onChange={set('year')}
          placeholder={isAlbum && shared.mixed.year ? 'Mixed' : '—'}
          numeric
          last
        />
      </Group>

      <div className="flex gap-3 px-4">
        <button
          type="button"
          className="glass glass-thin glass-press t-headline flex-1 py-3.5"
          style={{ borderRadius: 22 }}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="glass-press t-headline flex-1 py-3.5"
          style={{ background: 'var(--tint)', color: '#fff', borderRadius: 22 }}
          onClick={submit}
        >
          Save
        </button>
      </div>

      <p className="t-caption px-8 pt-4 text-center" style={{ color: 'var(--label-3)' }}>
        Changes apply inside MYplayer. The audio files on your device aren’t modified.
      </p>
    </div>
  );
}
