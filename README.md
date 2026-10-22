# Sync Lyrics · v1.0 Beta 7

Peer-to-peer lyrics syncing for Projector, Stage and Control. Static HTML, CSS and JavaScript hosted on GitHub Pages at https://lyrics.notjack.au.

## Start and join

1. Create a session on the host computer. Keep that browser open and prevent the device from sleeping.
2. Share the six-character code or invite link. Stage and Projector join without a password; Control requires the controller password.
3. Sessions start blank. Prepare the set, then choose Go live.

## Write a song

Only four formatting rules are needed:

| Type | What happens |
| --- | --- |
| `[Verse 1]` | Starts a section. It continues until the next heading. |
| `---` on its own line | Starts a new slide within the current section. |
| `[G]` before words | Shows a yellow chord on Stage and Control, hidden on Projector. |
| `# Guitar only` on its own line | Shows a neon green stage note for the section, hidden on Projector. |

```text
[Verse 1]
# Guitar only. Sing softly.
[G]First line of verse one
[D]Second line of verse one
---
[Em]Third line of verse one
[C]Fourth line of verse one

[Verse 2]
# All voices in.
[G]First line of verse two
[D]Second line of verse two

[Chorus]
# Build here.
[C]Chorus line one
[G]Chorus line two

[Outro]
# Guitar only, four bars.
```

Verse 1 has two slides. Verse 2 and Chorus each have one. Blank lines add spacing in the editor; they do not split slides. There is no automatic line-count split and no closing section tag. Add --- wherever you want another slide. Keep each slide short enough to read on your display.

A section containing only a # note works as an instrumental cue and projects black. Notes remain visible above the scrolling lyrics for the current section. Enter title, key and BPM in their fields above the lyrics. The editor includes examples beside the actual Stage and Projector output.

### Section order

Define each section once. Type `Verse 1, Chorus, Verse 2, Chorus` or `V1, C, V2, C` in Section order to arrange repetitions. Section numbers also work. Leave it empty to follow the source. The live preview shows the sequence, slide counts and any unknown headings before saving.

## Prepare and go live

- Saving a song updates the library and leaves the current live version unchanged. Go live / reload explicitly applies saved changes.
- Edit set selects a set for preparation. Go live with this set explicitly switches the live set.
- In Edit Setlist, move songs with the arrows or type their position. Reordering preserves the live song and slide. Switch to another song before removing the live song.
- Back and Next move between slides, then sections, then songs. Tap a section or slide in Control to jump there.
- Blank hides projector output while Stage remains readable. You can navigate while blank; Go live reveals the selected slide.
- Arrow keys navigate; B toggles Blank. Shortcuts are inactive while typing or inside dialogs.
- Display settings control local chord visibility and font size. Projector settings include fullscreen.

## Data and connections

The host stores its library in browser localStorage. Use Session options → Export backup regularly. Import replaces the host library and starts blank. Browser storage can be cleared, so keep a separate backup.

The host is required for live updates. Devices retain received lyrics during an interruption and attempt to reconnect. Control actions wait for host confirmation. Test your actual devices and Wi-Fi before a service, including Safari fullscreen and reconnecting.

VDO.Ninja SDK 1.6.2 supplies encrypted WebRTC data channels; external signaling and sometimes TURN relay services are needed. This is a trusted-team beta: host discovery is not cryptographically authenticated, so do not use it for confidential data. Older song formats remain readable for compatibility, but only the four rules above are taught in the editor.

Refresh all devices after an update. Beta 7 uses protocol lyrics-live/3. Older clients should not join the session.

## Deploy and test

Upload this repository to GitHub Pages using main / (root). CNAME is lyrics.notjack.au. DNS CNAME lyrics points to dannotjack.github.io. Enable HTTPS when available.

Run `npm test` for model and transport tests. No npm install is required. For local demo use `python3 -m http.server 8000` and open `http://localhost:8000/?demo=1`.

Uses the VDO.Ninja SDK (MPL-2.0); this application is not affiliated with VDO.Ninja. Use lyrics you have permission to display.

The homepage uses the supplied original photograph without altering it. The title is positioned relative to the photograph’s yellow frame; session controls sit below it. Short windows scroll to preserve usable controls.

Inspired by Ben Yap's project at syncmylyrics.benyap.com
