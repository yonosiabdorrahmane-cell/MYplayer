#!/usr/bin/env node
/**
 * Builds MYplayer, serves it, and puts it behind a Cloudflare quick tunnel so
 * an iPhone can install it as a PWA.
 *
 * The tunnel exists only to hand the app to the phone. Once Settings → Offline
 * shows "Ready", everything lives on the phone and this can be closed for good.
 *
 *   npm run tunnel              build, serve, tunnel
 *   npm run tunnel -- --no-build    reuse the existing dist/
 */

import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';

import { build, preview } from 'vite';

const PORT = 5174;
const URL_PATTERN = /https:\/\/[a-z0-9][a-z0-9-]*\.trycloudflare\.com/i;

const color = (code, text) => `[${code}m${text}[0m`;
const bold = (text) => color(1, text);
const dim = (text) => color(2, text);
const green = (text) => color(32, text);
const yellow = (text) => color(33, text);

function requireCloudflared() {
  const probe = spawnSync('cloudflared', ['--version'], { stdio: 'ignore' });
  if (probe.error) {
    console.error(`
${yellow('cloudflared is not installed.')}

  Arch      sudo pacman -S cloudflared
  macOS     brew install cloudflared
  other     https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
`);
    process.exit(1);
  }
}

/** A scannable QR beats typing a random hostname on a phone keyboard. */
function printQr(url) {
  const qr = spawnSync('qrencode', ['-t', 'ANSIUTF8', '-m', '2', url], { encoding: 'utf8' });
  if (qr.error || qr.status !== 0) return false;
  process.stdout.write(`\n${qr.stdout}`);
  return true;
}

function printInstructions(url, hasQr) {
  const line = '─'.repeat(Math.max(url.length, 46) + 4);

  console.log(`
${green(line)}
  ${bold(url)}
${green(line)}`);

  if (hasQr) console.log(dim('  Point the iPhone camera at the code above.'));
  else console.log(dim('  Type this into Safari on the iPhone.'));

  console.log(`
${bold('On the iPhone — in Safari, not Chrome:')}

  ${bold('1.')} Open the address above.
  ${bold('2.')} Share ${dim('(the square with the arrow)')} → ${bold('Add to Home Screen')} → Add.
  ${bold('3.')} Close Safari and open ${bold('MYplayer')} from the Home Screen.
     ${dim('This step matters: the installed app caches itself separately.')}
  ${bold('4.')} In the app: ${bold('Settings → Offline')}. Wait for ${green('Ready')}.
     ${dim('If it says Incomplete, tap the row to finish the download.')}

${bold('Then, and only then:')} press ${bold('Ctrl-C')} here. The tunnel dies, this
machine can be shut down, and MYplayer keeps launching on the phone with no
network — put it in Airplane Mode and check if you like.

${yellow('Add your music from inside the installed app')} (Settings → Add Music), not
from Safari — the two keep separate storage.

${dim('This hostname is temporary; a later run gets a different one and installs')}
${dim('as a second app. Delete the old icon first if you re-install.')}
`);
}

async function main() {
  requireCloudflared();

  const rebuild = !process.argv.includes('--no-build');
  if (rebuild) {
    console.log(dim('Building…\n'));
    await build();
  }

  const server = await preview({ preview: { port: PORT, strictPort: false, host: '127.0.0.1' } });
  // Vite walks up from the requested port when it is taken, and the config keeps
  // reporting the one we asked for — so the tunnel has to follow the socket, or
  // it happily serves whatever else was already listening there.
  const address = server.httpServer.address();
  const port = typeof address === 'object' && address ? address.port : PORT;
  console.log(dim(`\nServing dist/ on http://127.0.0.1:${port}`));
  console.log(dim('Opening tunnel…'));

  const tunnel = spawn(
    'cloudflared',
    ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  let announced = false;
  // cloudflared logs to stderr; the URL shows up in a banner a second or two in.
  for (const stream of [tunnel.stdout, tunnel.stderr]) {
    createInterface({ input: stream }).on('line', (line) => {
      const match = !announced && line.match(URL_PATTERN);
      if (!match) return;
      announced = true;
      const url = match[0];
      printInstructions(url, printQr(url));
    });
  }

  tunnel.on('exit', (code) => {
    if (!announced) console.error(yellow(`\ncloudflared exited (${code}) before the tunnel opened.`));
    shutdown(code ?? 0);
  });

  let closing = false;
  async function shutdown(code = 0) {
    if (closing) return;
    closing = true;
    console.log(dim('\nClosing the tunnel. The phone keeps the app.'));
    if (!tunnel.killed) tunnel.kill('SIGTERM');
    await server.close();
    process.exit(code);
  }

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
