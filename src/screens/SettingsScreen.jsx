import { useCallback, useEffect, useState } from 'react';

import Screen from '../ui/Screen.jsx';
import Icon from '../ui/Icon.jsx';
import Sheet from '../ui/Sheet.jsx';
import Logo from '../ui/Logo.jsx';
import ImportButton from '../ui/ImportButton.jsx';
import { useLibrary } from '../state/LibraryContext.jsx';
import { usePlayer } from '../state/PlayerContext.jsx';
import { formatBytes, haptic, isStandalone } from '../lib/format.js';
import { offlineStatus } from '../lib/offline.js';

/** Grouped-inset list section, the standard iOS Settings container. */
function Group({ header, footer, children }) {
  return (
    <section className="px-4 pb-6">
      {header && (
        <h2
          className="t-footnote px-4 pb-1.5 uppercase"
          style={{ color: 'var(--label-2)', letterSpacing: 0.2 }}
        >
          {header}
        </h2>
      )}
      <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, overflow: 'hidden' }}>
        {children}
      </div>
      {footer && (
        <p className="t-footnote px-4 pt-1.5" style={{ color: 'var(--label-2)' }}>
          {footer}
        </p>
      )}
    </section>
  );
}

function Row({ icon, tint = 'var(--tint)', label, value, onClick, destructive, last, as }) {
  const Element = as ?? (onClick ? 'button' : 'div');
  return (
    <Element
      type={Element === 'button' ? 'button' : undefined}
      onClick={onClick}
      className={`flex w-full items-center gap-3 pl-4 ${onClick ? 'row-press' : ''}`}
    >
      {icon && (
        <div
          className="flex shrink-0 items-center justify-center"
          style={{ width: 29, height: 29, borderRadius: 7, background: tint, color: '#fff' }}
        >
          <Icon name={icon} size={17} />
        </div>
      )}
      <div
        className="flex min-w-0 flex-1 items-center justify-between py-2.5 pr-4"
        style={{ boxShadow: last ? 'none' : 'inset 0 -0.5px 0 var(--separator)' }}
      >
        <span className="t-body truncate-1" style={{ color: destructive ? '#ff453a' : 'var(--label)' }}>
          {label}
        </span>
        {value != null && (
          <span className="t-body shrink-0 pl-3" style={{ color: 'var(--label-2)' }}>
            {value}
          </span>
        )}
      </div>
    </Element>
  );
}

/** Copy for each offline state, keyed by what the user should do about it. */
const OFFLINE_COPY = {
  ready: {
    value: 'Ready',
    tint: '#30d158',
    icon: 'checkmark',
    footer:
      'Every part of the app is stored on this iPhone. The tunnel can be closed — MYplayer will keep opening with no network at all.',
  },
  partial: {
    value: 'Incomplete',
    tint: '#ff9f0a',
    icon: 'arrow',
    footer: 'Some files are still missing. Tap to finish downloading while the tunnel is still open.',
  },
  installing: {
    value: 'Preparing…',
    tint: '#8e8e93',
    icon: 'arrow',
    footer: 'Downloading the app for offline use. Keep this page open for a moment.',
  },
  none: {
    value: 'Not saved',
    tint: '#8e8e93',
    icon: 'arrow',
    footer: 'Reload this page while the tunnel is open to store the app for offline use.',
  },
  unsupported: {
    value: 'Unavailable',
    tint: '#8e8e93',
    icon: 'arrow',
    footer:
      'Offline storage needs an https:// address. Open MYplayer through the tunnel URL rather than a plain http:// one.',
  },
};

/** Polls the service worker until the shell is fully cached, then stops. */
function useOfflineStatus() {
  const [status, setStatus] = useState({ state: 'installing', ready: false });

  const check = useCallback(async (options) => {
    setStatus(await offlineStatus(options));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer;

    const poll = async () => {
      const next = await offlineStatus();
      if (cancelled) return;
      setStatus(next);
      // Once it is ready the answer cannot get worse on its own, and without a
      // service worker it can never improve; anything between is still settling.
      if (!next.ready && next.state !== 'unsupported') timer = setTimeout(poll, 2000);
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return [status, check];
}

export default function SettingsScreen({ bottomInset }) {
  const { tracks, albums, artists, playlists, usage, wipeLibrary } = useLibrary();
  const { volumeMode, inAppVolume, toggleInAppVolume } = usePlayer();
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [offline, recheckOffline] = useOfflineStatus();
  const offlineCopy = OFFLINE_COPY[offline.state] ?? OFFLINE_COPY.installing;

  const totalBytes = tracks.reduce((sum, track) => sum + (track.size || 0), 0);

  return (
    <Screen title="Settings" bottomInset={bottomInset} contentClassName="" >
      <div style={{ background: 'var(--bg)', minHeight: '100%' }} className="pt-3">
        <Group header="Library" footer="Music is stored on this device only. Nothing is uploaded anywhere.">
          <Row icon="note" label="Songs" value={tracks.length} />
          <Row icon="albums" tint="#ff9f0a" label="Albums" value={albums.length} />
          <Row icon="person" tint="#30d158" label="Artists" value={artists.length} />
          <Row icon="playlist" tint="#5e5ce6" label="Playlists" value={playlists.length} last />
        </Group>

        <Group
          header="Add Music"
          footer="Importing reads title, artist, album and cover art straight out of each file."
        >
          <ImportButton
            folder
            className="row-press flex w-full items-center gap-3 pl-4"
          >
            <div
              className="flex shrink-0 items-center justify-center"
              style={{ width: 29, height: 29, borderRadius: 7, background: 'var(--tint)', color: '#fff' }}
            >
              <Icon name="folder" size={17} />
            </div>
            <div
              className="flex min-w-0 flex-1 items-center justify-between py-2.5 pr-4"
              style={{ boxShadow: 'inset 0 -0.5px 0 var(--separator)' }}
            >
              <span className="t-body">Add a Folder</span>
              <Icon name="chevron.right" size={15} style={{ color: 'var(--label-3)' }} />
            </div>
          </ImportButton>

          <ImportButton className="row-press flex w-full items-center gap-3 pl-4">
            <div
              className="flex shrink-0 items-center justify-center"
              style={{ width: 29, height: 29, borderRadius: 7, background: '#0a84ff', color: '#fff' }}
            >
              <Icon name="plus" size={17} />
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-between py-2.5 pr-4">
              <span className="t-body">Add Files</span>
              <Icon name="chevron.right" size={15} style={{ color: 'var(--label-3)' }} />
            </div>
          </ImportButton>
        </Group>

        <Group header="Storage">
          <Row icon="arrow" tint="#64d2ff" label="Music Files" value={formatBytes(totalBytes)} />
          <Row
            icon="clock"
            tint="#8e8e93"
            label="Used on Device"
            value={usage ? formatBytes(usage.usage) : '—'}
            last
          />
        </Group>

        {volumeMode() !== 'element' && (
          <Group
            header="Playback"
            footer={
              inAppVolume
                ? 'In-app volume is on, so music stops when you leave MYplayer. Switch it off and relaunch to get background playback back.'
                : 'iOS gives the volume buttons to the system and ignores anything an app asks for. MYplayer can take over its own volume, but only by routing audio in a way iOS refuses to keep alive in the background — so music would stop the moment you leave the app. Use the phone’s volume buttons instead.'
            }
          >
            <Row
              icon="speaker.high"
              tint="#5e5ce6"
              label="In-App Volume"
              value={inAppVolume ? 'On' : 'Off'}
              last
              onClick={() => {
                haptic([8]);
                toggleInAppVolume(!inAppVolume);
              }}
            />
          </Group>
        )}

        <Group header="Offline" footer={offlineCopy.footer}>
          <Row
            icon={offlineCopy.icon}
            tint={offlineCopy.tint}
            label="Offline Ready"
            value={
              offline.state === 'partial' && offline.total
                ? `${offline.cached}/${offline.total}`
                : offlineCopy.value
            }
            last
            onClick={
              offline.ready
                ? undefined
                : () => {
                    haptic([8]);
                    recheckOffline({ repair: true });
                  }
            }
          />
        </Group>

        <Group
          footer={
            isStandalone()
              ? 'Installed and running offline.'
              : 'Tip: tap Share, then “Add to Home Screen”, to run MYplayer full screen with no browser chrome.'
          }
        >
          <Row
            icon="trash"
            tint="#ff453a"
            label="Erase Library"
            destructive
            last
            onClick={() => setConfirmWipe(true)}
          />
        </Group>

        <div className="flex flex-col items-center gap-2 pb-8 pt-1">
          <Logo size={52} />
          <p
            className="t-caption"
            style={{ color: 'var(--label-3)', letterSpacing: 1.4, textTransform: 'uppercase' }}
          >
            MYplayer 1.0
          </p>
        </div>
      </div>

      <Sheet open={confirmWipe} onClose={() => setConfirmWipe(false)} title="Erase Library" height="36vh">
        <div className="px-5 pt-3">
          <p className="t-subhead text-center" style={{ color: 'var(--label-2)' }}>
            Every song, cover and playlist will be deleted from this device. This can’t be undone.
          </p>
          <button
            type="button"
            className="glass-press t-headline mt-5 w-full py-3.5"
            style={{ background: '#ff453a', color: '#fff', borderRadius: 22 }}
            onClick={async () => {
              await wipeLibrary();
              haptic([18]);
              setConfirmWipe(false);
            }}
          >
            Erase Everything
          </button>
          <button
            type="button"
            className="glass glass-thin glass-press t-headline mt-2.5 w-full py-3.5"
            style={{ borderRadius: 22 }}
            onClick={() => setConfirmWipe(false)}
          >
            Cancel
          </button>
        </div>
      </Sheet>
    </Screen>
  );
}
