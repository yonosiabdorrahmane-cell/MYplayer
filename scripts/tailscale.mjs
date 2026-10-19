#!/usr/bin/env node
/**
 * Serves MYplayer over Tailscale so an iPhone can install it as a PWA.
 *
 * Preferred over `npm run tunnel` (Cloudflare) for three reasons:
 *
 *  - **It resolves.** `*.trycloudflare.com` is heavily abused for phishing, so
 *    carrier DNS, DNS-filter profiles and iCloud Private Relay routinely block
 *    it — the phone reports "server IP address could not be found" and there is
 *    nothing to fix on this end. MagicDNS resolves inside the tunnel instead of
 *    through public DNS, so no filter can reach it.
 *  - **The hostname is permanent.** A quick tunnel gets a random hostname every
 *    run, and to iOS a new hostname is a new origin — a second app with an empty
 *    library. This address never changes, so a later run updates the app you
 *    already installed and keeps its music.
 *  - **It is private.** Serve is visible only to your own tailnet, never the
 *    public internet.
 *
 * Once the app reports Ready it is entirely self-contained: no Tailscale, no
 * wifi, no this machine. Serve is only how the app gets onto the phone.
 *
 *   npm run phone                  build, serve, share over Tailscale
 *   npm run phone -- --no-build    reuse the existing dist/
 */

import { spawnSync } from 'node:child_process'

import { build, preview } from 'vite'

const PORT = 5174

/**
 * The tailnet port this app is published on — and therefore its **origin**.
 *
 * A PWA's service worker, its storage and its install identity are all keyed to
 * the origin, and a different port is a different origin. That is the whole
 * reason this is a constant rather than always 443: Requiem publishes itself on
 * 443 from the same machine, and two apps sharing one origin would fight over
 * the service worker registration at scope `/` — installing the second would
 * break the first. Keep these distinct per app.
 */
const HTTPS_PORT = 8443

const ADMIN_DNS = 'https://login.tailscale.com/admin/dns'

const color = (code, text) => `[${code}m${text}[0m`
const bold = (text) => color(1, text)
const dim = (text) => color(2, text)
const green = (text) => color(32, text)
const yellow = (text) => color(33, text)

function fail(message) {
  console.error(`\n${yellow(message)}\n`)
  process.exit(1)
}

const PHONE_PLATFORMS = ['iOS', 'iPadOS', 'android']

/** Reads the tailnet state. Only the shape we care about. */
function readStatus() {
  const probe = spawnSync('tailscale', ['status', '--json'], { encoding: 'utf8' })

  if (probe.error) {
    fail(`Tailscale is not installed.\n\n  Arch   sudo pacman -S tailscale\n  other  https://tailscale.com/download`)
  }

  let status
  try {
    status = JSON.parse(probe.stdout)
  } catch {
    fail(`Could not read Tailscale status. Is the daemon running?\n\n  sudo systemctl enable --now tailscaled\n  sudo tailscale up`)
  }

  if (status.BackendState !== 'Running') {
    fail(`Tailscale is installed but not connected (state: ${status.BackendState}).\n\n  sudo tailscale up`)
  }

  return {
    host: (status.Self?.DNSName ?? '').replace(/\.$/, ''),
    // Populated only once HTTPS Certificates is switched on for the tailnet.
    certs: Array.isArray(status.CertDomains) && status.CertDomains.length > 0,
    phone: Object.values(status.Peer ?? {}).find((peer) =>
      PHONE_PLATFORMS.includes(peer.OS),
    ),
  }
}

/**
 * Can this user change the serve config without sudo?
 *
 * `tailscale serve` is root-only until the tailnet is told which local user may
 * drive it. Checking here turns a bare "Access denied: serve config denied"
 * half a minute into the run — after a full production build — into one command
 * you run once and never think about again.
 */
function canServe() {
  if (process.getuid?.() === 0) return true

  const probe = spawnSync('tailscale', ['debug', 'prefs'], { encoding: 'utf8' })
  if (probe.error || probe.status !== 0) return true // can't tell; let serve speak

  try {
    return JSON.parse(probe.stdout).OperatorUser === (process.env.USER ?? '')
  } catch {
    return true
  }
}

/**
 * Blocks until a phone shows up in the tailnet.
 *
 * This is not optional politeness. A MagicDNS name has no public DNS record —
 * 1.1.1.1 and 8.8.8.8 both return nothing for it — so a phone outside the
 * tailnet cannot resolve the address at all, and reports the same "server IP
 * address could not be found" that a blocked Cloudflare tunnel does. Printing a
 * URL that provably cannot work is worse than waiting for one that can.
 */
async function waitForPhone(existing) {
  if (existing) return existing

  console.log(`
${yellow('No phone in your tailnet yet.')} The address below only resolves for devices
that are signed in, so this will wait for yours.

  ${bold('1.')} Install ${bold('Tailscale')} from the App Store.
  ${bold('2.')} Sign in with the same account as this machine.
  ${bold('3.')} Switch the VPN toggle ${bold('on')}.
`)
  process.stdout.write(dim('  Waiting for the phone to appear… (Ctrl-C to give up)'))

  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 3000))
    const { phone } = readStatus()
    if (phone) {
      console.log(`\n${green(`  Found ${phone.DNSName?.replace(/\.$/, '') ?? 'a phone'} (${phone.OS}).`)}`)
      return phone
    }
    process.stdout.write(dim('.'))
  }
}

function printQr(url) {
  const qr = spawnSync('qrencode', ['-t', 'ANSIUTF8', '-m', '2', url], { encoding: 'utf8' })
  if (qr.error || qr.status !== 0) return false
  process.stdout.write(`\n${qr.stdout}`)
  return true
}

function printInstructions(url, hasQr) {
  const line = '─'.repeat(Math.max(url.length, 46) + 4)

  console.log(`
${green(line)}
  ${bold(url)}
${green(line)}`)

  console.log(`
${yellow('It must be Safari.')} Chrome on iOS cannot install a PWA at all — "Add to
Home Screen" there makes a plain bookmark with no offline support. ${dim('Scanning a')}
${dim('QR opens your *default* browser, so if that is Chrome, do not scan it:')}
${dim('open Safari and type the address, or paste it in from Notes.')}
${dim('Chrome shows "This site can\'t be reached"; Safari says "Cannot Find the Server".')}
${hasQr ? `\n${dim('  If Safari is your default browser, the code above is the quick way.')}` : ''}

${bold('On the iPhone:')}

  ${bold('1.')} Open the address above ${bold('in Safari')}.
  ${bold('2.')} Share ${dim('(the square with the arrow)')} → ${bold('Add to Home Screen')} → Add.
  ${bold('3.')} Close Safari and open ${bold('MYplayer')} from the Home Screen.
     ${dim('This step matters: the installed app caches itself separately.')}
  ${bold('4.')} In the app: ${bold('Settings')} → ${bold('Offline')}.
     Wait for ${green('Ready')}. Tap the row to retry if Incomplete.

${bold('Then, and only then:')} press ${bold('Ctrl-C')} here.

After that MYplayer needs nothing at all — not this machine, not Tailscale, not
wifi. Turn on Airplane Mode and open it to prove it.

${dim('This address is permanent. Run this again after a rebuild and the phone')}
${dim('updates the app it already has, keeping your music library.')}
`)
}

async function main() {
  const { host, certs, phone } = readStatus()

  if (!host) fail('Could not determine this machine’s Tailscale name.')

  if (!canServe()) {
    fail(
      `Tailscale will not let this user change the serve config.\n\n` +
        `Run this once, and never again:\n\n` +
        `  sudo tailscale set --operator=$USER\n\n` +
        `Then run this command again. (The alternative is prefixing every run\n` +
        `with sudo, which would also make the build run as root.)`,
    )
  }

  if (!certs) {
    fail(
      `HTTPS certificates are not enabled for your tailnet.\n\n` +
        `Without them there is no https:// address, and iOS will not register a\n` +
        `service worker — which is the whole point of doing this.\n\n` +
        `  1. Open ${ADMIN_DNS}\n` +
        `  2. Scroll to "HTTPS Certificates" and press Enable.\n` +
        `  3. Run this again.\n\n` +
        `It is a single switch and it is free.`,
    )
  }

  // Before the build, so a missing phone costs a wait rather than a wasted one.
  await waitForPhone(phone)

  if (!process.argv.includes('--no-build')) {
    console.log(dim('\nBuilding…\n'))
    await build()
  }

  const server = await preview({ preview: { port: PORT, strictPort: false, host: '127.0.0.1' } })

  // Vite walks up from the requested port when it is taken while the resolved
  // config keeps reporting the one we asked for, so read it off the socket.
  const address = server.httpServer.address()
  const port = typeof address === 'object' && address ? address.port : PORT

  console.log(dim(`\nServing dist/ on http://127.0.0.1:${port}`))

  const share = spawnSync(
    'tailscale',
    ['serve', '--bg', `--https=${HTTPS_PORT}`, String(port)],
    { encoding: 'utf8' },
  )
  if (share.status !== 0) {
    await server.close()
    const message = share.stderr || share.stdout || ''
    fail(
      /denied|permission/i.test(message)
        ? `Tailscale denied the serve config.\n\nRun this once:\n\n  sudo tailscale set --operator=$USER\n\nthen try again.\n\n${message}`
        : `tailscale serve failed:\n\n${message}`,
    )
  }

  const url = HTTPS_PORT === 443 ? `https://${host}` : `https://${host}:${HTTPS_PORT}`
  printInstructions(url, printQr(url))

  let closing = false
  async function shutdown(code = 0) {
    if (closing) return
    closing = true
    console.log(dim('\nWithdrawing the share. The phone keeps the app.'))
    // Only this app's mapping — `serve reset` would also tear down whatever the
    // other app published on its own port.
    spawnSync('tailscale', ['serve', `--https=${HTTPS_PORT}`, 'off'], { stdio: 'ignore' })
    await server.close()
    process.exit(code)
  }

  process.on('SIGINT', () => shutdown(0))
  process.on('SIGTERM', () => shutdown(0))
}

main().catch((error) => {
  console.error(error)
  spawnSync('tailscale', ['serve', `--https=${HTTPS_PORT}`, 'off'], { stdio: 'ignore' })
  process.exit(1)
})
