# Sync Lyrics · v1.0 Beta 10

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

A section containing only a # note works as an instrumental cue and projects black. Notes stay inside their section blocks and scroll with the lyrics. Enter title, key and BPM in their fields above the lyrics. The editor includes examples beside the actual Stage and Projector output.

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

Refresh all devices after an update. Beta 8 uses protocol lyrics-live/3. Older clients should not join the session.

## Deploy and test

Upload this repository to GitHub Pages using main / (root). CNAME is lyrics.notjack.au. DNS CNAME lyrics points to dannotjack.github.io. Enable HTTPS when available.

Use Node.js 24.15 or later. Run `npm ci`, then `npm test` for model, transport and Studio workflow tests. The deployed site itself has no build step. For local demo use `python3 -m http.server 8000` and open `http://localhost:8000/?demo=1`.

Uses the VDO.Ninja SDK (MPL-2.0); this application is not affiliated with VDO.Ninja. Use lyrics you have permission to display.

The homepage uses the supplied original photograph without altering it. The title is positioned relative to the photograph’s yellow frame; session controls sit below it. Short windows scroll to preserve usable controls.

## Edit the shared song library on GitHub

Open https://github.com/dannotjack/sync/edit/main/songs/library.json. Copy a song object, give it a unique stable id, and edit title, key, bpm, optional order and lyrics. Each lyrics-array entry is one line of song text. Commit the file and wait for GitHub Pages to finish deploying. Start a new host session to load the shared songs; they appear in Song library and can be added to any set. Existing live sessions are not changed.

New shared songs are added automatically. Later GitHub changes update an unchanged local copy. If a song was edited in the app, the host's version is kept. Removing a song from the file does not erase saved browser copies. The app does not write to GitHub; its Save button saves to the host browser. The source file is in a public repository, so its contents are public.

Use the example below. Add a comma between song objects. Use a stable id: changing it creates another song. Lyrics use only the normal four rules: [Section], --- slides, [G] chords and # stage notes.

```json
{
  "version": 1,
  "songs": [
    {
      "id": "my-song",
      "title": "My Song",
      "key": "G",
      "bpm": 76,
      "order": "V1, C, V1, C",
      "lyrics": [
        "[Verse 1]",
        "# Guitar only",
        "[G]First line",
        "[D]Second line",
        "---",
        "[C]Next slide, still Verse 1",
        "[Chorus]",
        "# All voices in",
        "[G]Chorus words"
      ]
    }
  ]
}
```

If the shared file cannot load or contains errors, the host opens using its saved library and shows a message. Preview/demo continues to use the existing local sample data.

## Sync Lyrics Studio

Open **https://lyrics.notjack.au/studio/** to prepare songs without starting a session.

- **Master Library**: edit the public song collection as a local working copy. Preview Stage and Projector formatting, import JSON or text, then use **Export master JSON** to download `library.json`. To publish that master library, replace `songs/library.json` in this repository manually. No GitHub credential is entered in Studio.
- **Local Sets**: create a set, add independent copies of master songs, edit lyrics and section order, and export a portable set JSON. The exported set has `format: "lyrics-live-set"`.
- **Live app**: on the host, choose **Setlist → Import Studio set**, select the exported set JSON, and review the new set in Edit Setlist before going live. This adds songs and a set without replacing the existing library or interrupting the live projection.
- **Local backup**: use **Backup all** to export a complete Studio copy. Studio saves to browser localStorage and shows a persistent warning if saving fails. Invalid stored data is retained for recovery. Browser storage may be cleared by the browser. Keep JSON backups when moving devices.
- The master format is the existing `{ "version": 1, "songs": [...] }` manifest with an array of text lines per song. The set format is designed separately for import into the live host.

Studio is hosted statically on GitHub Pages, requires no account or cloud database, and uses the existing model parser.

### Import the Matt Graham OnSong collection

In **Studio → Master Library → Browse OnSong collection**, browse the metadata-only index of 677 `.onsong` files from [mattgraham/worship](https://github.com/mattgraham/worship). Filter by song name, select multiple entries or choose **Import all missing**. Studio retrieves files directly from a pinned public GitHub revision and converts their inline chords, headings, key and tempo into the existing Lyrics Live song syntax **in the current browser**. Importing is incremental and preserves pre-existing master songs and locally edited versions that already use the same source ID.

The app does **not** embed or publish the upstream lyrics in its repository. The source contains modern worship songs and does not provide an explicit redistribution licence. Ensure you have permission for your intended copying, display, or publication. The importer is for creating a local working library; publishing exported lyrics to a public repository is a separate rights decision.

The Studio library accommodates up to 1000 entries. A very large master library may produce a large host snapshot; for reliable live projection, importing only the songs needed for a set remains preferable. Keep browser backups when importing hundreds of songs.

### Linked master-library song catalogue (Studio)

The Master Library view automatically includes all **677 source song titles** from the pinned Matt Graham OnSong catalogue alongside the library's existing songs. The public repository contains only the filenames and source references for this collection. Searching and choosing a linked title downloads just that song into the current browser for editing and preview; adding one to a local set creates an independent local copy. Local edits are preserved on the device.

Exporting `library.json` includes only locally created, edited or individually downloaded songs, **not** linked-only source entries. Neither the upstream lyrics nor a full copy of the collection is committed to the public site. This allows people to discover a large catalogue while remaining mindful of copyright and copying permissions. The existing **Bulk import OnSong** option remains available for local bulk loading.

## Current starter demo

The three original example songs are removed from the public song manifest and from new browser sessions. **Build My Life** is the only starter demo, in both the live app demo and new host library. `songs/library.json` stores a pinned external OnSong reference rather than reproducing its copyrighted lyrics in this repository. The visitor's browser retrieves it on demand from the upstream public songbook; an internet connection and access to GitHub's raw-content host are needed.

Old default browser libraries are migrated at host startup: **only unmodified** Morning Light / Still Waters / All Things New placeholders are deleted, and a Sunday Worship set made empty by that cleanup is populated with Build My Life. Independently edited songs and real sets remain intact. Studio similarly drops unchanged old sample entries from its local master working copy, without modifying user-created local sets.

If the original source is unavailable, a loading note appears instead of the song text; this doesn't affect other saved songs. The repository retains no copy of Build My Life's lyrics.


Studio uses explicit Merge / Replace / Cancel actions for master imports, validates backups before replacing work, and limits local sets to 120 songs. Master and set JSON exports are checked against the 2 MB import limit; Studio backups use an 8 MB limit. Export details distinguish downloaded songs from linked catalogue titles and preserve published source references. On smaller screens, switch between Songs, Editor and Preview. Projector previews use a 16:9 frame and warn about overflow; only `---` creates a slide break. Live devices show Loading lyrics until a full snapshot arrives, with retry guidance for missing hosts.
