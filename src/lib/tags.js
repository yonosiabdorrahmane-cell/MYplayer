/**
 * Audio metadata reader.
 *
 * Handles the containers a personal library actually contains: MP3 (ID3v2.2/3/4),
 * MP4/M4A (iTunes `ilst` atoms) and FLAC (Vorbis comments). Everything else
 * falls back to parsing the filename, which is still better than nothing.
 *
 * Only the bytes that matter are read — never the whole file — so importing a
 * few hundred tracks doesn't blow up memory.
 */

const latin1 = new TextDecoder('iso-8859-1');
const utf8 = new TextDecoder('utf-8');
const utf16 = new TextDecoder('utf-16');
const utf16be = new TextDecoder('utf-16be');

const readSlice = (file, start, end) =>
  file.slice(start, Math.min(end, file.size)).arrayBuffer();

/** ID3 sizes are "synchsafe": 7 bits per byte so they can't contain 0xFF sync words. */
const synchsafe = (view, offset) =>
  ((view.getUint8(offset) & 0x7f) << 21) |
  ((view.getUint8(offset + 1) & 0x7f) << 14) |
  ((view.getUint8(offset + 2) & 0x7f) << 7) |
  (view.getUint8(offset + 3) & 0x7f);

const ascii = (view, offset, length) => {
  let out = '';
  for (let i = 0; i < length; i += 1) out += String.fromCharCode(view.getUint8(offset + i));
  return out;
};

function decodeText(bytes, encoding) {
  switch (encoding) {
    case 1:
      return utf16.decode(bytes);
    case 2:
      return utf16be.decode(bytes);
    case 3:
      return utf8.decode(bytes);
    default:
      return latin1.decode(bytes);
  }
}

const clean = (value) =>
  typeof value === 'string' ? value.replace(/\0+$/, '').trim() || null : null;

/** "1/12" → 1 */
const leadingNumber = (value) => {
  const match = /^\s*(\d+)/.exec(String(value ?? ''));
  return match ? Number(match[1]) : null;
};

/* ------------------------------------------------------------------- ID3v2 */

async function readID3(file) {
  const head = new DataView(await readSlice(file, 0, 10));
  if (head.byteLength < 10 || ascii(head, 0, 3) !== 'ID3') return null;

  const major = head.getUint8(3);
  const flags = head.getUint8(5);
  const size = synchsafe(head, 6);

  let offset = 10;
  const body = new DataView(await readSlice(file, 0, 10 + size));
  // An extended header sits between the tag header and the first frame.
  if (flags & 0x40) {
    offset += major === 4 ? synchsafe(body, offset) : body.getUint32(offset) + 4;
  }

  const idLength = major === 2 ? 3 : 4;
  const headerLength = major === 2 ? 6 : 10;
  const tags = {};
  const end = Math.min(10 + size, body.byteLength);

  while (offset + headerLength <= end) {
    const id = ascii(body, offset, idLength);
    if (!/^[A-Z0-9]+$/.test(id)) break; // padding

    let frameSize;
    if (major === 2) {
      frameSize = (body.getUint8(offset + 3) << 16) | (body.getUint8(offset + 4) << 8) | body.getUint8(offset + 5);
    } else if (major === 4) {
      frameSize = synchsafe(body, offset + 4);
    } else {
      frameSize = body.getUint32(offset + 4);
    }

    const dataStart = offset + headerLength;
    if (frameSize <= 0 || dataStart + frameSize > body.byteLength) break;

    const raw = new Uint8Array(body.buffer, dataStart, frameSize);

    if (id === 'APIC' || id === 'PIC') {
      tags.picture = parsePicture(raw, id === 'PIC');
    } else if (id[0] === 'T') {
      const text = decodeText(raw.subarray(1), raw[0]);
      // Multi-value frames are null separated; the first value is the one we want.
      tags[id] = clean(text.split('\0')[0]) ?? clean(text);
    }

    offset = dataStart + frameSize;
  }

  return {
    title: tags.TIT2 ?? tags.TT2 ?? null,
    artist: tags.TPE1 ?? tags.TP1 ?? null,
    album: tags.TALB ?? tags.TAL ?? null,
    albumArtist: tags.TPE2 ?? tags.TP2 ?? null,
    genre: normaliseGenre(tags.TCON ?? tags.TCO),
    year: leadingNumber(tags.TDRC ?? tags.TYER ?? tags.TDRL ?? tags.TYE),
    trackNo: leadingNumber(tags.TRCK ?? tags.TRK),
    discNo: leadingNumber(tags.TPOS ?? tags.TPA),
    picture: tags.picture ?? null,
  };
}

function parsePicture(bytes, isV22) {
  const encoding = bytes[0];
  let cursor = 1;
  let mime;

  if (isV22) {
    // v2.2 uses a fixed 3-character format code ("JPG", "PNG").
    const format = latin1.decode(bytes.subarray(1, 4)).toUpperCase();
    mime = format === 'PNG' ? 'image/png' : 'image/jpeg';
    cursor = 4;
  } else {
    const terminator = bytes.indexOf(0, cursor);
    if (terminator < 0) return null;
    mime = latin1.decode(bytes.subarray(cursor, terminator)) || 'image/jpeg';
    cursor = terminator + 1;
  }

  cursor += 1; // picture type byte

  // Skip the description, which is terminated by one or two NULs depending on encoding.
  if (encoding === 1 || encoding === 2) {
    while (cursor + 1 < bytes.length && !(bytes[cursor] === 0 && bytes[cursor + 1] === 0)) cursor += 2;
    cursor += 2;
  } else {
    while (cursor < bytes.length && bytes[cursor] !== 0) cursor += 1;
    cursor += 1;
  }

  if (cursor >= bytes.length) return null;
  if (mime === '-->') return null; // a URL, not embedded image data
  return new Blob([bytes.slice(cursor)], { type: mime });
}

/** ID3v1 numeric genre references, e.g. "(17)" or "17". */
function normaliseGenre(value) {
  const text = clean(value);
  if (!text) return null;
  const match = /^\((\d+)\)$|^(\d+)$/.exec(text);
  if (!match) return text;
  return ID3_GENRES[Number(match[1] ?? match[2])] ?? null;
}

const ID3_GENRES = [
  'Blues', 'Classic Rock', 'Country', 'Dance', 'Disco', 'Funk', 'Grunge', 'Hip-Hop', 'Jazz',
  'Metal', 'New Age', 'Oldies', 'Other', 'Pop', 'R&B', 'Rap', 'Reggae', 'Rock', 'Techno',
  'Industrial', 'Alternative', 'Ska', 'Death Metal', 'Pranks', 'Soundtrack', 'Euro-Techno',
  'Ambient', 'Trip-Hop', 'Vocal', 'Jazz+Funk', 'Fusion', 'Trance', 'Classical', 'Instrumental',
  'Acid', 'House', 'Game', 'Sound Clip', 'Gospel', 'Noise', 'Alt. Rock', 'Bass', 'Soul', 'Punk',
  'Space', 'Meditative', 'Instrumental Pop', 'Instrumental Rock', 'Ethnic', 'Gothic', 'Darkwave',
  'Techno-Industrial', 'Electronic', 'Pop-Folk', 'Eurodance', 'Dream', 'Southern Rock', 'Comedy',
];

/* --------------------------------------------------------------- MP4 / M4A */

/* Only the branch that leads to the iTunes metadata list — descending into
   `trak` would mean slicing megabytes of sample tables for nothing. */
const MP4_CONTAINERS = new Set(['moov', 'udta', 'meta', 'ilst']);

/** Walks the atom tree, reading only the atoms it descends into. */
async function readMP4(file) {
  const tags = {};

  async function walk(start, end, depth) {
    let cursor = start;
    while (cursor + 8 <= end && depth < 6) {
      const header = new DataView(await readSlice(file, cursor, cursor + 16));
      if (header.byteLength < 8) return;

      let size = header.getUint32(0);
      const type = ascii(header, 4, 4);
      let contentStart = cursor + 8;

      if (size === 1) {
        // 64-bit extended size.
        size = Number(header.getBigUint64(8));
        contentStart += 8;
      } else if (size === 0) {
        size = end - cursor;
      }
      if (size < 8) return;

      const contentEnd = Math.min(cursor + size, end);

      if (MP4_CONTAINERS.has(type)) {
        // `meta` is a full atom: 4 bytes of version/flags precede its children.
        await walk(type === 'meta' ? contentStart + 4 : contentStart, contentEnd, depth + 1);
      } else if (depth >= 3 && contentEnd - contentStart > 16 && contentEnd - contentStart < 40_000_000) {
        // Inside `ilst`: every child wraps a `data` atom holding the value.
        const payload = new DataView(await readSlice(file, contentStart, contentEnd));
        if (payload.byteLength > 16 && ascii(payload, 4, 4) === 'data') {
          const dataType = payload.getUint32(8) & 0x00ffffff;
          const bytes = new Uint8Array(payload.buffer, 16, payload.byteLength - 16);
          tags[type] = { dataType, bytes };
        }
      }

      cursor += size;
    }
  }

  await walk(0, file.size, 0);
  if (Object.keys(tags).length === 0) return null;

  const text = (key) => {
    const entry = tags[key];
    return entry ? clean(utf8.decode(entry.bytes)) : null;
  };
  const pair = (key) => {
    const entry = tags[key];
    // trkn/disk store [reserved, index, total, reserved] as big-endian shorts.
    return entry && entry.bytes.length >= 4 ? (entry.bytes[2] << 8) | entry.bytes[3] : null;
  };

  let picture = null;
  const cover = tags.covr;
  if (cover) {
    const type = cover.dataType === 14 ? 'image/png' : 'image/jpeg';
    picture = new Blob([cover.bytes], { type });
  }

  return {
    title: text('©nam'),
    artist: text('©ART'),
    album: text('©alb'),
    albumArtist: text('aART'),
    genre: text('©gen'),
    year: leadingNumber(text('©day')),
    trackNo: pair('trkn'),
    discNo: pair('disk'),
    picture,
  };
}

/* -------------------------------------------------------------------- FLAC */

async function readFLAC(file) {
  const magic = new DataView(await readSlice(file, 0, 4));
  if (magic.byteLength < 4 || ascii(magic, 0, 4) !== 'fLaC') return null;

  let cursor = 4;
  const comments = {};
  let picture = null;

  for (let block = 0; block < 32; block += 1) {
    const header = new DataView(await readSlice(file, cursor, cursor + 4));
    if (header.byteLength < 4) break;

    const flag = header.getUint8(0);
    const isLast = (flag & 0x80) !== 0;
    const type = flag & 0x7f;
    const length = (header.getUint8(1) << 16) | (header.getUint8(2) << 8) | header.getUint8(3);
    const start = cursor + 4;

    if (type === 4 && length < 4_000_000) {
      const view = new DataView(await readSlice(file, start, start + length));
      let offset = view.getUint32(0, true) + 4; // skip vendor string
      const count = view.getUint32(offset, true);
      offset += 4;
      for (let i = 0; i < count && offset + 4 <= view.byteLength; i += 1) {
        const size = view.getUint32(offset, true);
        offset += 4;
        const entry = utf8.decode(new Uint8Array(view.buffer, offset, size));
        const split = entry.indexOf('=');
        if (split > 0) comments[entry.slice(0, split).toUpperCase()] = entry.slice(split + 1);
        offset += size;
      }
    } else if (type === 6 && length < 40_000_000) {
      const view = new DataView(await readSlice(file, start, start + length));
      let offset = 4; // picture type
      const mimeLength = view.getUint32(offset);
      offset += 4;
      const mime = ascii(view, offset, mimeLength);
      offset += mimeLength;
      const descLength = view.getUint32(offset);
      offset += 4 + descLength + 16; // description + width/height/depth/colours
      const dataLength = view.getUint32(offset);
      offset += 4;
      if (offset + dataLength <= view.byteLength) {
        picture = new Blob([view.buffer.slice(offset, offset + dataLength)], {
          type: mime || 'image/jpeg',
        });
      }
    }

    cursor = start + length;
    if (isLast) break;
  }

  return {
    title: clean(comments.TITLE),
    artist: clean(comments.ARTIST),
    album: clean(comments.ALBUM),
    albumArtist: clean(comments.ALBUMARTIST),
    genre: clean(comments.GENRE),
    year: leadingNumber(comments.DATE ?? comments.YEAR),
    trackNo: leadingNumber(comments.TRACKNUMBER),
    discNo: leadingNumber(comments.DISCNUMBER),
    picture,
  };
}

/* -------------------------------------------------------------- filenames */

/** "03 - Artist - Title.mp3" and friends. */
function fromFilename(name) {
  const base = name.replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim();
  const parts = base.split(/\s+-\s+/);

  if (parts.length >= 2) {
    let [first, ...rest] = parts;
    let trackNo = null;
    const numbered = /^(\d{1,3})[.\s]*$/.exec(first);
    if (numbered && rest.length >= 2) {
      trackNo = Number(numbered[1]);
      first = rest.shift();
    }
    return { artist: first.trim(), title: rest.join(' - ').trim(), trackNo };
  }

  const numbered = /^(\d{1,3})[.\s]+(.*)$/.exec(base);
  if (numbered) return { title: numbered[2].trim(), trackNo: Number(numbered[1]) };
  return { title: base };
}

/* --------------------------------------------------------------- duration */

/** The containers don't agree on how to store duration — let the decoder say. */
export function probeDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (value) => {
      URL.revokeObjectURL(url);
      audio.removeAttribute('src');
      resolve(value);
    };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) ? audio.duration : 0);
    audio.onerror = () => done(0);
    // A corrupt or unsupported file would otherwise stall the whole import.
    setTimeout(() => done(0), 8000);
    audio.src = url;
  });
}

/* ----------------------------------------------------------------- public */

export async function readTags(file) {
  const name = file.name ?? 'Unknown';
  let tags = null;

  try {
    if (/\.(mp3|mp2)$/i.test(name) || file.type === 'audio/mpeg') {
      tags = await readID3(file);
    } else if (/\.(m4a|mp4|m4b|aac|alac)$/i.test(name) || /mp4|m4a|aac/.test(file.type)) {
      tags = await readMP4(file);
    } else if (/\.flac$/i.test(name) || /flac/.test(file.type)) {
      tags = await readFLAC(file);
    } else {
      // Unknown extension: an ID3 tag may still be prepended (common on .wav/.ogg).
      tags = await readID3(file);
    }
  } catch {
    // A malformed tag shouldn't stop the file from being playable.
    tags = null;
  }

  const guess = fromFilename(name);

  return {
    title: tags?.title ?? guess.title ?? name,
    artist: tags?.artist ?? guess.artist ?? 'Unknown Artist',
    album: tags?.album ?? 'Unknown Album',
    albumArtist: tags?.albumArtist ?? tags?.artist ?? guess.artist ?? 'Unknown Artist',
    genre: tags?.genre ?? null,
    year: tags?.year ?? null,
    trackNo: tags?.trackNo ?? guess.trackNo ?? null,
    discNo: tags?.discNo ?? null,
    picture: tags?.picture ?? null,
  };
}
