import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

import NavStack from './ui/NavStack.jsx';
import TabBar from './ui/TabBar.jsx';
import MiniPlayer from './ui/MiniPlayer.jsx';
import NowPlaying from './ui/NowPlaying.jsx';
import Icon from './ui/Icon.jsx';
import { MenuProvider } from './ui/ContextMenu.jsx';

import LibraryScreen from './screens/LibraryScreen.jsx';
import AlbumScreen from './screens/AlbumScreen.jsx';
import SearchScreen from './screens/SearchScreen.jsx';
import SettingsScreen from './screens/SettingsScreen.jsx';
import { PlaylistScreen, PlaylistsScreen } from './screens/PlaylistScreens.jsx';
import {
  AlbumsScreen,
  ArtistScreen,
  ArtistsScreen,
  GenreScreen,
  GenresScreen,
  LovedScreen,
  SongsScreen,
} from './screens/BrowseScreens.jsx';

import { LibraryProvider, useLibrary } from './state/LibraryContext.jsx';
import { PlayerProvider, usePlayer } from './state/PlayerContext.jsx';
import { ActionsProvider } from './state/ActionsContext.jsx';
import { AuroraProvider } from './state/AuroraContext.jsx';
import { ChromeProvider } from './state/ChromeContext.jsx';
import { uid } from './lib/format.js';

const ROOTS = ['library', 'playlists', 'search', 'settings'];

export default function App() {
  return (
    <LibraryProvider>
      <PlayerProvider>
        <AuroraProvider>
          <ActionsProvider>
            <ChromeProvider>
              <MenuProvider>
                <Shell />
              </MenuProvider>
            </ChromeProvider>
          </ActionsProvider>
        </AuroraProvider>
      </PlayerProvider>
    </LibraryProvider>
  );
}

function Shell() {
  const { ready, importState } = useLibrary();
  const { currentTrack } = usePlayer();

  const [tab, setTab] = useState('library');
  const [nowPlaying, setNowPlaying] = useState(false);

  // Every tab keeps its own navigation stack, the way UITabBarController does.
  const [stacks, setStacks] = useState(() =>
    Object.fromEntries(ROOTS.map((root) => [root, [{ key: `${root}-root`, route: root, params: {} }]])),
  );

  const push = useCallback(
    (route, params = {}) =>
      setStacks((current) => ({
        ...current,
        [tab]: [...current[tab], { key: `${route}-${uid()}`, route, params }],
      })),
    [tab],
  );

  const pop = useCallback(
    () =>
      setStacks((current) => ({
        ...current,
        [tab]: current[tab].length > 1 ? current[tab].slice(0, -1) : current[tab],
      })),
    [tab],
  );

  const selectTab = useCallback(
    (next) => {
      // Tapping the active tab again pops it back to its root, like iOS.
      if (next === tab) {
        setStacks((current) => ({ ...current, [next]: current[next].slice(0, 1) }));
        return;
      }
      setTab(next);
    },
    [tab],
  );

  // Hardware/browser back closes the player, then unwinds the stack.
  useEffect(() => {
    const onPopState = () => {
      if (nowPlaying) setNowPlaying(false);
      else pop();
      window.history.pushState(null, '');
    };
    window.history.pushState(null, '');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [nowPlaying, pop]);

  /* The chrome floats, so lists reserve room to scroll clear of it rather than
     being boxed in above it — content passes under the glass. */
  const bottomInset = currentTrack
    ? 'calc(var(--safe-bottom) + var(--tab-h) + var(--mini-h) + 26px)'
    : 'calc(var(--safe-bottom) + var(--tab-h) + 18px)';

  const renderRoute = useCallback(
    (entry) => {
      const props = { push, pop, params: entry.params, bottomInset };
      switch (entry.route) {
        case 'library':
          return <LibraryScreen {...props} />;
        case 'albums':
          return <AlbumsScreen {...props} />;
        case 'artists':
          return <ArtistsScreen {...props} />;
        case 'songs':
          return <SongsScreen {...props} />;
        case 'genres':
          return <GenresScreen {...props} />;
        case 'genre':
          return <GenreScreen {...props} />;
        case 'loved':
          return <LovedScreen {...props} />;
        case 'album':
          return <AlbumScreen {...props} />;
        case 'artist':
          return <ArtistScreen {...props} />;
        case 'playlists':
          return <PlaylistsScreen {...props} />;
        case 'playlist':
          return <PlaylistScreen {...props} />;
        case 'search':
          return <SearchScreen {...props} />;
        case 'settings':
          return <SettingsScreen {...props} />;
        default:
          return null;
      }
    },
    [bottomInset, pop, push],
  );

  const tabStacks = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(stacks).map(([key, entries]) => [
          key,
          entries.map((entry) => ({ key: entry.key, render: () => renderRoute(entry) })),
        ]),
      ),
    [renderRoute, stacks],
  );

  if (!ready) {
    return <div className="aurora-surface h-full" />;
  }

  return (
    <>
      {/* The app recedes as Now Playing comes forward — the iOS card presentation. */}
      <motion.div
        className="aurora-surface relative h-full overflow-hidden"
        style={{ transformOrigin: 'center 0%' }}
        animate={{
          scale: nowPlaying ? 0.92 : 1,
          borderRadius: nowPlaying ? 38 : 0,
          opacity: nowPlaying ? 0.55 : 1,
        }}
        transition={{ type: 'spring', stiffness: 380, damping: 40 }}
      >
        {Object.keys(tabStacks).map((key) => (
          <motion.div
            key={key}
            className="absolute inset-0"
            style={{
              visibility: tab === key ? 'visible' : 'hidden',
              pointerEvents: tab === key ? 'auto' : 'none',
            }}
            animate={{ opacity: tab === key ? 1 : 0, scale: tab === key ? 1 : 0.985 }}
            transition={{ duration: 0.26, ease: [0.19, 1, 0.22, 1] }}
          >
            <NavStack stack={tabStacks[key]} onPop={pop} />
          </motion.div>
        ))}

        {/* Floating chrome */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex flex-col gap-2"
          style={{
            paddingLeft: 'calc(var(--safe-left) + var(--chrome-gutter))',
            paddingRight: 'calc(var(--safe-right) + var(--chrome-gutter))',
            paddingBottom: 'calc(var(--safe-bottom) + 8px)',
          }}
        >
          <AnimatePresence>
            {currentTrack && !nowPlaying && (
              <div className="pointer-events-auto">
                <MiniPlayer key="mini" onExpand={() => setNowPlaying(true)} />
              </div>
            )}
          </AnimatePresence>
          <div className="pointer-events-auto">
            <TabBar active={tab} onSelect={selectTab} />
          </div>
        </div>
      </motion.div>

      <NowPlaying open={nowPlaying} onClose={() => setNowPlaying(false)} />

      <ImportToast state={importState} />
    </>
  );
}

/** Glass pill that reports import progress. */
function ImportToast({ state }) {
  return (
    <AnimatePresence>
      {state && (
        <motion.div
          className="glass glass-thick fixed left-1/2 z-[95] flex items-center gap-3 px-4 py-2.5"
          style={{
            top: 'calc(var(--safe-top) + 8px)',
            x: '-50%',
            borderRadius: 26,
            maxWidth: '86vw',
          }}
          initial={{ opacity: 0, y: -28, scale: 0.88 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -28, scale: 0.88 }}
          transition={{ type: 'spring', stiffness: 480, damping: 32 }}
        >
          <div
            className="relative z-10"
            style={{ animation: 'spin-slow 1.1s linear infinite', color: 'var(--tint)' }}
          >
            <Icon name="note" size={17} />
          </div>
          <div className="relative z-10 min-w-0">
            <p className="t-footnote" style={{ fontWeight: 600 }}>
              Adding {state.done + 1} of {state.total}
            </p>
            <p className="t-caption2 truncate-1" style={{ color: 'var(--label-2)', maxWidth: '60vw' }}>
              {state.current}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
