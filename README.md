# MYplayer

A personal music player, built as an installable PWA that tries hard to feel like a native iPhone app.

Your music lives on your device — files go into IndexedDB as blobs, tags and cover art are read out of the
files themselves, and nothing is ever uploaded anywhere. Once installed it works with no network at all.

## Running it

```bash
npm install
npm run dev      # http://localhost:5174
npm run build    # production build into dist/
npm run preview  # serve the production build
npm run phone    # build, serve, and share over Tailscale  (recommended)
npm run tunnel   # same, via a Cloudflare quick tunnel     (often DNS-blocked)
npm run icons    # regenerate the icon set (needs rsvg-convert)
```

## Getting it onto your iPhone

```bash
npm run phone
```

That builds the app, serves `dist/`, shares it on your tailnet, and prints an
`https://<machine>.<tailnet>.ts.net:8443` address with a QR code.

**Note the `:8443`.** A PWA's service worker, storage and install identity are all keyed to the *origin*, and a
different port is a different origin. MYplayer publishes on 8443 so it stays completely separate from any
other app served from the same machine on 443 — otherwise the two would fight over the service worker
registration at scope `/`, and installing the second would break the first. `HTTPS_PORT` at the top of
`scripts/tailscale.mjs` is what keeps them apart.

One-time setup: enable **HTTPS Certificates** at <https://login.tailscale.com/admin/dns>, and install the
Tailscale app on the phone signed into the same account. The script checks both and says which is missing
rather than failing obscurely.

Either way the phone does **not** need to be on the same wifi, and either way you get an `https://` address —
which is what makes offline caching possible at all: iOS only registers a service worker over `https://` or
`localhost`, never over a plain `http://` LAN address.

**Why Tailscale over the Cloudflare tunnel.** `*.trycloudflare.com` is heavily abused for phishing, so carrier
DNS, DNS-filter profiles and iCloud Private Relay routinely blackhole the entire domain — the phone reports
*"server IP address could not be found"* while the tunnel serves perfectly from the machine that started it,
and there is nothing to fix on this end. MagicDNS resolves inside the tunnel rather than through public DNS,
so no filter can reach it. The Tailscale address is also **permanent**, which fixes the storage problem noted
below. `npm run tunnel` remains available as a fallback.

On the iPhone, **in Safari** (Chrome on iOS can't install PWAs):

1. Open the address.
2. Share → **Add to Home Screen** → Add.
3. **Close Safari and launch MYplayer from the Home Screen.** This step is not optional — the installed app
   has its own storage and registers its own copy of the service worker, so the caching it needs happens
   inside the standalone app, not in the Safari tab.
4. In the app: **Settings → Offline**. Wait until it reads **Ready** (tap the row to retry if it says
   *Incomplete*).

Once it says Ready, press `Ctrl-C` on the computer. The tunnel closes, the computer can be shut down, and
MYplayer keeps launching on the phone with no network at all — Airplane Mode is a fair test.

Add music from **inside the installed app** (Settings → Add Music). Anything imported into the Safari tab
stays in Safari's storage and won't show up in the Home Screen app.

> **Each *quick tunnel* run gets a new hostname.** Its address is random and temporary, and a PWA's storage is
> tied to its origin — so re-running `npm run tunnel` later serves a *different* origin, which installs as a
> second, empty app. The already-installed one keeps working offline regardless; it just can't be updated in
> place.
>
> `npm run phone` does not have this problem: a Tailscale machine name is stable, so later runs land on the
> existing install and your library survives. That is the main reason to prefer it once the app holds music
> you care about. (A named Cloudflare tunnel on a domain you own gives the same stability, if you'd rather.)

### Why the offline check exists

A closed quick tunnel does not stop resolving — Cloudflare's edge answers it with an HTTP 530 error page.
That is a perfectly successful response as far as the browser is concerned, so a service worker that asks the
network first for the page would hand you Cloudflare's error page and cache it over the app. The service
worker therefore serves the shell **cache-first** and only ever replaces it with a same-origin `text/html`
`200`. The Settings → Offline row asks the worker to audit its own cache against the build's file list, so
"Ready" means every file is genuinely on the phone rather than merely probably.

## Adding music

**Library → +**, or **Settings → Add Music**. "Add a Folder" takes an entire music directory in one go.

Reads title / artist / album / album artist / genre / year / track number and embedded cover art from:

| Format | Where the tags come from |
| --- | --- |
| MP3 | ID3v2.2, v2.3, v2.4 |
| M4A / MP4 / AAC / ALAC | iTunes `ilst` atoms |
| FLAC | Vorbis comments + `PICTURE` block |
| anything else | filename (`Artist - Title`, `03 - Title`, …) |

Duration comes from the decoder rather than the container, so it's right even when a file's headers lie.
Files already in the library are skipped on re-import, so re-adding the same folder is safe.

### Fixing metadata

Files that didn't come from a store often have messy tags. Press and hold a song and choose
**Edit Details…** to correct title, artist, album, album artist, track and disc numbers, year and genre.
Press and hold an album — its cover in a grid, or its artwork on the album screen — for the same form scoped
to the whole record, writing the shared fields to every track at once. Where an album's tracks disagree on a
field, it shows *Mixed* and leaving it untouched preserves the differences rather than flattening them.

Album and artist keys are derived from these fields, so renaming an album genuinely regroups the library —
the album grid, artist list and section index all follow.

> This edits MYplayer's copy of the metadata; the audio files on your device are never modified. Re-importing
> a file brings its original tags back.

### Cover art

Embedded art is used when a file has it. When it doesn't, press and hold the song and choose
**Add Artwork…** to pick any image. It's centre-cropped to a square, re-encoded as JPEG capped at 1000px so
a phone photo doesn't sit in IndexedDB at full size, and applied to **every track on the same album** —
which is what "album artwork" means in practice, and what the album grid reads its cover from.

### On the lock screen

Cover art reaches the lock screen and Control Centre through the Media Session API. Each cover is baked to
`data:` URLs at 96/192/256/384/512 rather than passed as a `blob:` URL — iOS is unreliable about blob URLs
in `MediaMetadata` and often shows nothing at all — and the sizes reported are measured, not guessed, so the
platform can pick the right one. Title, artist and album publish immediately, with the art upgrading in
behind them, so the lock screen is never briefly blank.

## What's in it

- **Library** — Artists, Albums, Songs, Genres, Loved, plus Recently Added and Recently Played shelves
- **Playlists** — create, add, reorder-free editing, delete
- **Search** — across songs, albums and artists, accent-insensitive (`bjork` finds `Björk`)
- **Now Playing** — full-screen player with an ambient background derived from the cover art
- **Queue** — Play Next / Play Last, an Up Next sheet, shuffle and repeat (off / all / one)
- **Lock screen controls** — via the Media Session API, including headphone buttons
- **Resume** — the queue and playback position survive a relaunch (it never auto-plays on open)

## Liquid Glass

Chrome is built from floating glass rather than docked bars — the tab bar, mini player, bar buttons, menus
and sheets are all capsules that hover over the content, and lists scroll underneath them.

Each glass surface is four stacked layers (see `src/styles/ios.css`):

1. an angled tint fill, so one corner catches more light than the other
2. the backdrop lens — `backdrop-filter` blur, saturation boost and a brightness lift
3. a 1px **specular rim**, painted as a gradient border via the mask/xor trick, bright at the corners where
   light lands and nearly gone through the middle
4. an internal **sheen** falling from the top edge

The rim carries a faint cool stop on one side and a warm one on the other — a stand-in for the chromatic
fringe real glass shows at its edges — and there's a dark band just inside it, standing in for light
bouncing off the inner wall. Shadows are doubled: a tight contact shadow under a wide ambient one.

**Holding a tab** gathers a thicker slab of glass under your finger (`.glass-blob`): it swells past its
resting size on a loose, overshooting spring, brightens, lifts the glyph with it, and settles back faster
than it grew. A specular bloom follows the touch point across the surface.

**The press travels.** Keep your finger down and slide along the bar — the slab glides with you, previewing
each tab in the accent colour as you pass and ticking a haptic detent at every boundary. Whichever tab
you're over when you lift is the one that opens, so you can change your mind mid-drag. The gesture is owned
by the bar rather than by individual tab buttons, which is what lets it cross between them; a single
indicator is driven by `dragIndex ?? selectedIndex`, gliding on `x` and swelling on `scale`.

That slab deliberately has **no `backdrop-filter` of its own**. Its parent is a `.glass` surface, and
`isolation: isolate` there makes it a *backdrop root* — a nested filter would sample its parent instead of
the page and come out flat. A bright fill layered over an existing lens reads as thicker glass anyway.

> **The one thing that isn't real:** true Liquid Glass refracts — it bends and magnifies what's behind its
> edges. On the web that needs an SVG displacement map fed through `backdrop-filter: url(…)`, which Safari
> doesn't support. So this is blur, saturation, rim and sheen: convincing at a glance and in motion, but the
> content behind stays undistorted.

## The other iOS details

- Large titles that collapse into the nav bar, and stretch when you overscroll
- Push/pop navigation with a real interactive edge-swipe back, including parallax on the screen behind
- The tab bar's selection is one pill that slides between tabs, and the whole bar pulls in to icons while
  you scroll down a list
- Long-press context menus over a blurred, dimmed backdrop
- Now Playing presents as a card — the app behind shrinks and rounds off — and drags down to dismiss
- Artwork shrinks while paused, exactly like the Music app; the play glyph swaps with a spring
- A scrubber that swells under your finger, with fine scrubbing as you slide away from it vertically
- Marquee for titles too long to fit, hairline separators, the A–Z index strip on long lists
- Safe-area handling throughout, and a full light appearance alongside dark

Haptics are wired through `navigator.vibrate`, which iOS doesn't expose to web apps — they're silent there
and real on Android. The calls are harmless either way.

## Layout

```
src/
  lib/        db (IndexedDB), tags (metadata parsers), colors (palette extraction),
              artwork (object-URL cache), format (time/sort/haptics)
  state/      LibraryContext (library + import), PlayerContext (audio engine + queue),
              ActionsContext (shared menus and their sheets)
  ui/         Screen, NavStack, TabBar, MiniPlayer, NowPlaying, IOSSlider, Sheet,
              ContextMenu, TrackRow, Artwork, Icon, …
  screens/    Library, Browse (albums/artists/songs/genres/loved), Album,
              Playlists, Search, Settings
  styles/     ios.css — design tokens, materials, type ramp, motion curves
public/
  sw.js       offline service worker (its precache list is injected at build time)
scripts/
  tailscale.mjs  build + serve + Tailscale share, for installing onto a phone
  tunnel.mjs     build + serve + Cloudflare tunnel (fallback)
```

## Notes

- Storage is subject to the browser's quota. The app calls `navigator.storage.persist()` on first import to
  ask iOS not to evict it; Settings shows how much space the library is using.
- **Erase Library** in Settings clears everything. There's no undo and no backup — if the files matter,
  keep the originals somewhere else too.
