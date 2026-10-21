# Lyrics Live · v1.0 beta

A **browser-hosted worship lyrics and chords system**. The host browser owns the songs and live slide position. Projector, Stage and Control connect using a six-character session code and VDO.Ninja's **data-only WebRTC** transport.

The entire website is static HTML/CSS/JavaScript. **GitHub Pages is enough to serve it.** There is no Supabase, user-account service, server app, or mandatory build tool.

> **Beta / important:** This package has passed local model tests and a local browser smoke test, but live multi-device WebRTC connections still need to be verified on your target network. Test thoroughly before running a service. VDO.Ninja's signaling and sometimes TURN relay services are external dependencies for joining and connecting.

## 1. Deploy to GitHub Pages

1. Create a **public** GitHub repository (for example, `lyrics-live`).
2. Upload the **contents** of this folder to the repository root: `index.html`, `styles.css`, `favicon.svg`, `.nojekyll`, `src/`, etc. Do **not** upload the ZIP file instead of extracting it.
3. Go to **Settings → Pages → Build and deployment**, select **Deploy from a branch**, `main`, `/ (root)`, and save.
4. Open the generated `https://YOUR-NAME.github.io/lyrics-live/` URL.
5. To connect a custom domain, add it in **Settings → Pages → Custom domain** and configure your DNS at the domain provider using GitHub's documented DNS records. Enable **Enforce HTTPS** when available.

The site uses relative asset paths, so it works at a project URL (`/lyrics-live/`) or custom domain root without editing code.

## 2. Start a session

1. Open the website in the **host browser** (ideally the projector laptop).
2. Click **Create Session**, enter a controller password (at least 6 characters), then **Start session**.
3. The host opens in **Control** and gets a random six-character session code. **Keep the host tab open and disable computer sleep.**
4. Select **Open projector tab** in the invite window to open a second browser tab as a projector; move that tab to the external display and click **Fullscreen** in its projector controls. Or switch the host tab directly to the Projector view.
5. Share the session code or invitation URL. Other devices visit the same website, join the code and choose **Stage**, **Projector**, or **Control**.
6. Extra Control devices must enter the controller password. Stage and Projector join without it.
7. Click **Setlist → Edit Setlist** on any authorized Control device to create songs, manage the library, add songs and reorder the set. Tap **Go live** to change the song.

The host may also act as a controller; hosting and controlling are independent roles.

## 3. Controls

- **Control screen** = Stage view + large permanently docked **Back / Next / Blank** buttons.
- **Tap section heading** in Control to project its first slide.
- **Tap a particular lyric slide** in Control to project that slide.
- **Setlist** lets Stage see the running order, and Control change songs or open Edit Setlist.
- **Blank** blacks out the projector but leaves Stage/Control lyrics visible. You can keep navigating while blanked; **Show** restores the *current* slide.
- **Arrow keys** (left/up = previous, right/down = next) work when authorized and not typing. **B** toggles Blank.
- Stage and Control can scroll independently; **Return to live** is available after scrolling away.
- Each browser has its **own font-size and chord visibility settings**; projector font controls appear when hovering or tapping settings.

## 4. Song formatting

Edit a song from **Setlist → Edit Setlist → Song library**. Example:

```text
[Verse 1]
[G]When the morning [D]finds us here
[Em]Hope is rising, [C]clear and near
---
[G]Every moment, [D]every breath
[C]Held in kindness, [G]held in grace

[Chorus]
[C]Lead us on into the [G]light
[D]Hold us through the [Em]darkest night
```

`[Verse 1]`, `[Chorus]`, `[Bridge]` create sections. Chords in square brackets before words appear on Stage/Control but not Projector. **Two lines make a slide by default**; use a blank line or `---` for an explicit break. This is a lightweight *ChordPro-inspired* format, not yet full ChordPro spec compatibility. Use licensed lyrics you have permission to display.

The site includes three **original placeholder songs** to test with.

## 5. Your data and backups

- The song library and saved sets are stored in the **host browser's localStorage**. No hosted database is used. Stage and Control peers receive temporary copies for rendering.
- Use **Session options → Export backup** frequently. JSON backup files can be **imported on the host**. Browser storage may be cleared, browsers in private mode may not retain it, and a host browser or device can fail.
- Changes made by a remote authorized controller are committed to the **host browser**. Remote controllers are not independent persistent libraries.
- If the host closes or its computer sleeps, live navigation stops. Already received lyrics remain visible on connected devices, and peers attempt to reconnect when the host returns.
- Once the last host tab is gone, the session code is not a durable, resumable cloud room. Create a new session with the local saved library when needed.

## 6. Networking and security caveats

- The VDO.Ninja SDK is loaded from the version-pinned URL `@vdoninja/sdk@1.6.2` on jsDelivr. All browsers must be able to load this script and reach the hosted WebRTC signaling service. Some connections may use external TURN relays. No external service is used as a **song database**.
- WebRTC data channels encrypt data in transit. The host checks the controller password before accepting presentation/edit commands and sends that password **only over the targeted WebRTC data channel**.
- **This is a trusted-team beta, not a hardened zero-trust authentication service**: the session code is not a secret; peer discovery and identifying the true host use a trust-on-first-message approach, and a malicious participant with the code could attempt host impersonation. Do not use it for confidential data or expose sensitive passwords. Before public use, the host identity should be cryptographically authenticated and rate limiting added.
- A six-character code may collide with another simultaneously active session. If you see someone else's session, leave and create a new code.
- Peer-to-peer connectivity is network-dependent. Restrictive school/church guest Wi-Fi or isolated clients may prevent peers from connecting. Test same Wi-Fi and different-network joins **before** relying on the system live.
- The signaling service is a free community service with fair-use limits. This beta sends application data **only** over WebRTC data channels, not over signaling.

## 7. Test locally

For interface preview:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/?demo=1`. This **demo mode** allows you to click through the interface without networking (and won't save your demo edits).

For live connections, open the site from a normal HTTPS GitHub Pages URL on **two real devices**. Host on device A, join from device B and then verify:

1. Join as Stage and see all current lyrics.
2. In Control, press Next and tap a different section; Stage follows and Projector changes.
3. Tap Blank; confirm the projector is black while Stage is unaffected. Tap Show.
4. Join as Control using a **wrong** password and verify that actions remain unavailable; retry with the correct password.
5. Create a new song and add it to the setlist on a remote controller; verify the host and other devices update.
6. Disconnect a stage device, reconnect, and confirm it catches up with the latest song and slide.
7. Check browser sleep, projector fullscreen and local network isolation behavior.

Run pure model tests with `npm test` (Node 20+). **No `npm install` is needed.**

## 8. Roadmap

- **V1:** The browser host (projector), live P2P sync, views, basic song/set editing, backups.
- **V2:** UX, full ChordPro import, transpose/capo, reliability and offline support if useful.
- **V3:** Optional dedicated always-on Node.js home host, without replacing Stage/Control UI.

### Acknowledgments

Uses the [VDO.Ninja JavaScript SDK](https://sdk.vdo.ninja/) hosted by its maintainers; SDK core is MPL-2.0. This application is not affiliated with VDO.Ninja.

## Beta 2 update

Home shows Create session, Join and Try demo. Display settings are collapsed. Projector settings open only when selected.

Controller permissions reset and authenticate again after disconnection. Commands wait for host acknowledgement, reject on timeout or loss, and are deduplicated. Navigation uses compact revision-checked updates; joins, edits and missed revisions use full snapshots.

Removing earlier entries preserves the live song and slide. Removing or deleting the live song is blocked until another song is selected. Creating a set does not activate it; choosing a set explicitly takes it live. Saving edits to the live song updates its lyrics immediately.

Open form nodes and fullscreen projector container survive live updates. Refresh all devices after this update: Beta 2 uses protocol lyrics-live/2.
