# Fretz

Fretz is a browser app for keeping a personal library of guitar tabs and chord sheets. You can search for songs, save them, write or paste your own tabs, sort them into playlists, and keep track of how well you know each song. It shows tabs with highlighting and can scroll through them for you while you play.

Fretz does **not** play audio. It is a tool for reading and organizing tabs, not a music player.

It is built with React 19, Vite 8 and React Router, and has no backend. All of your data stays in your browser's `localStorage`.

## Features

### Finding and adding songs

- **Search** from the box on the Home page. Results update as you type.
  - **Fretz Picks** (marked ♛) are a few built-in songs with full tabs, defined in [src/data/mockSongs.js](src/data/mockSongs.js).
  - Other results come from the public [iTunes Search API](https://performance-partners.apple.com/search-api). These include the title, artist, album and cover art, but **no tab content**. Saving one gives you a placeholder tab to fill in yourself.
- **Add song** creates a custom tab with a title, artist, tuning, capo, difficulty, tab font size (8 to 40 px) and tab text. Fretz then looks up album art for it automatically.

### Importing from Ultimate Guitar

The **Find chords and tabs on Ultimate Guitar** area on Home works in two ways:

- **Fetch from a link (automatic).** This needs the optional local helper running on the same computer.
- **Paste (manual).** This always works, including on a phone.

Search itself always happens on Ultimate Guitar's website, not inside Fretz (see [why](#why-search-stays-on-ultimate-guitars-website)).

1. Type a song or artist and press **Search UG** (or Enter). Ultimate Guitar's own search results open in a new browser tab.
2. Open an arrangement there and copy the page link.
3. Back in Fretz, press **Paste** and paste the link into **Ultimate Guitar link**.
4. Get the text in one of two ways:
   - **Fetch text** (helper running): Fretz loads that one arrangement. It fills in the title, artist, text, tuning, capo and difficulty, then opens the preview. The preview also shows the version, rating, votes and key when Ultimate Guitar supplies them.
   - **Manually** (no helper, or on a phone): copy the chords or tab text from the page into the large field, fill in title and artist, and press **Preview**.
5. Check the preview. **Back to edit** lets you fix anything first.
6. Press **Import to My Songs**. A confirmation appears with an **Open song** button.

If the helper is not running, the form says so and you can paste instead. If Ultimate Guitar refuses a request, the form shows its exact response, for example `HTTP 403`. Fretz never fills in placeholder text.

#### Running the helper

The helper is a small Node script in [helper/](helper/). It has no extra dependencies.

```bash
npm run ug-helper      # in a second terminal, next to npm run dev
```

It listens on `http://127.0.0.1:8787`, which is only reachable from this computer. To use another port, set `UG_HELPER_PORT` for the helper and `VITE_UG_HELPER_URL` (for example `http://127.0.0.1:9000`) for the app.

What the helper does and does not do:

- **One page per request.** It fetches only arrangement pages under `https://tabs.ultimate-guitar.com/tab/…`. Every other URL is refused, including search, other hosts, other paths and `..` tricks. Redirects must land on an allowed arrangement URL too, with at most 2 hops.
- **No search, ever.** Ultimate Guitar's `robots.txt` disallows automated access to `/search.php`.
- **Polite requests.** It sends an honest `User-Agent` (`Fretz-UG-Helper/0.1`), waits at least 3 seconds between upstream requests, times out after 15 seconds and caps pages at 3 MB. It caches each result in memory for 24 hours, so repeating a fetch doesn't hit Ultimate Guitar again.
- **No workarounds.** It never retries a refusal, and it never imitates a browser or solves challenges to get past bot protection. A blocked request is reported, not worked around.
- **Public text only.** It imports only arrangements whose page marks them `public`, with type Chords or Tabs. Paid, marketing, blocked and Pro/interactive arrangements are refused.
- **Locked to Fretz.** It answers only requests from `localhost`/`127.0.0.1` pages, and rejects other websites and DNS-rebinding hosts. It is not a general proxy.

**On a phone:** the helper runs on your computer and accepts connections only from that computer, so **Fetch text** isn't available when you use Fretz on a phone. There, the form shows "Helper not running" and you use manual paste. Making it work on a phone would need the helper hosted somewhere your phone can reach. That is a deployment decision, and it raises the terms questions below for a server that isn't yours personally.

#### Why search stays on Ultimate Guitar's website

These are separate questions:

1. **Can it technically be retrieved?** Yes, for single arrangement pages. A plain request (no browser imitation) to a public Chords page returned HTTP 200. The page embeds its data as JSON in `<div class="js-store" data-content="…">`, including the text with `[ch]`/`[tab]` markup, title, artist, type, version, rating, votes, tuning, capo, key and difficulty. Search results technically sit in the same JSON on `search.php`.
2. **Browser or helper?** A helper is required. Ultimate Guitar sends no CORS headers, so the Fretz page in your browser cannot read it directly. A local helper is not subject to CORS.
3. **Terms, rights and reliability:**
   - **robots.txt** disallows `/search.php` (and `/explore…song_id[]=`) for all automated clients. `/tab/` pages are allowed. That is why Fretz fetches a page you chose but never searches.
   - **Terms of Service:** content may be accessed "for your personal, non-commercial use only" (§6.3). The Terms also say you may not "copy, reproduce … or access (except as expressly authorized)" the service (§6.4), and they allow printing text tabs for personal use (§6.2). A personal helper that fetches one page you picked is closest to that personal use. Ultimate Guitar has not expressly authorized it, so decide whether you're comfortable with that.
   - **Content rights:** tabs are user-contributed transcriptions of songs whose lyrics and music are owned by their rights holders. The MIT/ISC licenses of open-source scrapers cover only their code, never the songs. Keep imports for your own practice and don't redistribute them.
   - **Reliability:** this depends on Ultimate Guitar's undocumented page structure and its bot protection. Other projects using plain requests have received `403` and "bot challenge" responses. If that happens, or the layout changes, the helper reports the error and you can paste manually.

Projects reviewed:

- [MaxJW/justchords](https://github.com/MaxJW/justchords): MIT, 2 commits, Aug 2026.
- [RyannKim327/UltimateGuitar-Project](https://github.com/RyannKim327/UltimateGuitar-Project): ISC, last updated May 2026.

Both read the same `js-store` JSON, including from `search.php`, and both use `got-scraping`, which imitates browser fingerprints. The second project switched to it explicitly to get past Ultimate Guitar's bot challenge (issues #2, #3 and #5). Fretz uses neither library nor their search approach.

What Fretz does with the text:

- It keeps spacing, indentation and line breaks, so chord positions above lyrics and `e|---|` staff lines stay aligned.
- It converts Windows line endings and non-breaking spaces, removes zero-width characters, and strips Ultimate Guitar's `[ch]…[/ch]` and `[tab]…[/tab]` markup if you copied from an edit/source view.
- It refuses text that looks like webpage HTML and shows it only as plain text, never as HTML.

What is supported:

- **Chords** and **Tab** arrangements (links like `…/tab/artist/song-chords-123` or `…-tabs-123`) are supported. Links without a type, such as `/tab/123`, are accepted too.
- **Guitar Pro**, **Power**, **Pro**, **Official** (paid), video, bass, ukulele and drums links are flagged and cannot be imported. Fretz does not import paid or interactive content.

Imported songs work like any other saved song: styled and plain views, auto-scroll, font size, **Edit tab**, playlists, pinning, progress tracking, album art lookup and backups. They are marked **UG · Chords** or **UG · Tab** in the list (not ♛ Fretz Pick). The viewer shows a **From Ultimate Guitar** link to the original page and the import date. This attribution is kept when you edit the tab.

**Duplicates.** Fretz recognizes an arrangement you already imported by its Ultimate Guitar ID or by its normalized link (ignoring `www`/`tabs` host, query string and trailing slash). You can then **Open saved song**, or **Replace its tab**. Replacing asks for confirmation, overwrites only the tab text (plus any tuning, capo or difficulty you entered), and keeps the title, playlists, pin and progress. Different versions or arrangements of the same song have different IDs and are saved separately. Fretz never refreshes an imported tab from the source on its own.

### Reading tabs

- Open a song to see its tuning, capo and difficulty, followed by the tab.
- **Styled view** (the default) colors the tab's content by line type:
  - `[Intro]` lines are section headings.
  - Lines made only of chord names, such as `G D/F# Em C`, are chord lines.
  - `(play softly)` lines are performance notes.
  - Lines like `e|---3---|` are tab staff lines.
  - Inline `[Am]` chords inside lyrics are highlighted too.
  - Everything else is shown as lyrics.
- **Plain view** shows the raw text.
- **Auto-scroll** scrolls the page at an adjustable speed from 10 to 120 px/s. It stops by itself at the bottom of the page. **Reset** returns you to the top.

### Organizing your library

The Home page has three library tabs:

| Tab | What it shows |
| --- | --- |
| **My Songs** | Every saved song. Pinned songs show a ★ and appear at the top. |
| **Playlists** | A built-in **♛ Fretz Picks** playlist with your saved built-in songs, plus any playlists you create. |
| **Progress** | Songs you are tracking, each with a "% learned" slider (in steps of 5%) and practice notes. The header shows your average progress. |

Each saved song has a three-dot menu with these options: **Open tab**, **Edit tab**, **Add to playlist**, **Track progress / View progress**, **Pin to top**, **Find album art** and **Remove**.

To add a song to a playlist, type a new playlist name, or type the name of an existing playlist to add the song to it. Names are not case-sensitive.

### Backup and profile

- **Export** downloads your saved songs, playlists and progress as `fretz-backup-YYYY-MM-DD.json`.
- **Import** reads that file back in. It also accepts a plain JSON array of songs. Imported items are merged into your library, and a song or playlist with the same ID as an existing one replaces it.
- **Delete all** removes every saved song, playlist and progress entry. It asks you to confirm first.
- The **Profile** page shows your display name, instrument, skill level and bio, which you can edit. It also shows counts of your saved tabs, playlists, pinned songs and Fretz Picks.

## Getting started

### Prerequisites

- Node.js `^20.19.0` or `>=22.12.0`. This is what Vite 8 requires.
- npm. The project uses npm and includes a `package-lock.json`.

No environment variables, API keys or accounts are needed.

### Install and run

```bash
npm install
npm run dev
```

Then open the local URL that Vite prints. By default this is `http://localhost:5173`.

## Using the app

1. Type a song or artist into **"What do you want to play?"**, then press **+** on a result to save it.
   Or use **Search UG** and **Paste** to import an arrangement from Ultimate Guitar (see [Importing from Ultimate Guitar](#importing-from-ultimate-guitar)).
2. Click a saved song to open its tab below the library. If you saved a song from iTunes, choose **Edit tab** in its menu and paste in your chords or tab. Imported songs can be edited the same way.
3. Use **Auto-scroll** and the speed slider to scroll through the tab hands-free while you play.
4. Use **Add to playlist**, **Pin to top** and **Track progress** to organize your practice.
5. Click **Export** from time to time to keep a backup.

Fretz has no custom keyboard shortcuts.

### Tab format example

```text
[Verse]
G              D/F#
When I was a young boy
(Let ring)
e|-----3-----|
```

## Data and privacy

**Stored locally.** Everything is kept in this browser's `localStorage`, under these keys:

| Key | Contents |
| --- | --- |
| `savedSongs` | Your library, including tab text and metadata |
| `playlists` | Your playlists, with copies of the songs in them |
| `songProgress` | Percent learned and practice notes for each song |
| `fretzProfile` | Your profile fields |

Your data is not synced between browsers or devices. If you clear this site's data in your browser, it is deleted. Use **Export** to keep a copy.

**Network requests.** The only outside service Fretz contacts is `itunes.apple.com`. It sends a request there:

- for your search text when you search;
- for the song's title and artist when it looks up album art. This happens when you add a custom song, when you choose **Find album art**, and for search results that have no art yet.

Cover images then load from Apple's image servers. Fretz has no accounts, analytics or backend of its own.

**Ultimate Guitar.** The Fretz page never contacts Ultimate Guitar itself. **Search UG** opens `ultimate-guitar.com/search.php?…` in a new tab, so your search text goes to Ultimate Guitar the same way it would if you typed it on their site, under their privacy policy. When you press **Fetch text**, the app sends the link to the local helper on `127.0.0.1`. The helper then requests that one page from `tabs.ultimate-guitar.com` from your computer's IP address, with no cookies or account. After an import, Fretz sends the song's title and artist to iTunes for album art, as it does for custom songs. Imported songs store these extra fields alongside the usual ones, and they are included in **Export**/**Import** backups: `sourceName`, `sourceUrl`, `sourceArrangementId`, `sourceArrangementType` and `importedAt`. Older backups and libraries without these fields still load unchanged.

## Development

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the Vite dev server with hot reload |
| `npm run build` | Builds the app for production into `dist/` |
| `npm run preview` | Serves the built `dist/` folder locally |
| `npm run lint` | Runs ESLint on the project |
| `npm test` | Runs unit tests with Node's built-in test runner (`src/**/*.test.js`, `helper/**/*.test.js`) |
| `npm run ug-helper` | Starts the optional local Ultimate Guitar helper on `127.0.0.1:8787` |

The [React Compiler](https://react.dev/learn/react-compiler) is turned on through Babel in [vite.config.js](vite.config.js). This can make dev and build runs slower. The unit tests cover Ultimate Guitar link parsing, text cleanup and duplicate detection ([src/utils/ultimateGuitar.test.js](src/utils/ultimateGuitar.test.js)), plus the helper's URL allow-list and page extraction ([helper/ugPage.test.js](helper/ugPage.test.js)). They run against synthetic fixtures, not the live site.

### Project structure

```text
public/                 Logos and icons (FretzLogo-*.png, favicon.svg)
helper/
  ug-helper.mjs         Optional local helper: fetches one public Ultimate Guitar arrangement page
  ugPage.js             Helper URL allow-list and page extraction (tested in ugPage.test.js)
src/
  main.jsx              Entry point and BrowserRouter
  App.jsx               Routes (/ and /profile) and the bottom tab bar
  pages/Home.jsx        Search, library tabs, playlists, progress, import/export, modals
  pages/Profile.jsx     Profile editor and library stats
  components/SongTab.jsx  Tab viewer: styled/plain views and auto-scroll
  components/UltimateGuitarImport.jsx  Ultimate Guitar search link, fetch/paste, preview and import form
  utils/ultimateGuitar.js  Link parsing, pasted-text cleanup, duplicate detection
  api/songSearch.js     iTunes song search
  api/albumArt.js       iTunes album art lookup
  data/mockSongs.js     Built-in "Fretz Picks" songs
```

## Known limitations

- **No audio.** Fretz cannot play music or backing tracks.
- **iTunes results have no tabs.** Only the built-in Fretz Picks come with tab content. You write or paste tabs for everything else.
- **No in-app Ultimate Guitar search.** Search happens on Ultimate Guitar's website, because its `robots.txt` disallows automated search. In-app search would need Ultimate Guitar's permission or an official API.
- **Fetch text needs the local helper**, works only on the computer running it (not on a phone), and depends on Ultimate Guitar's undocumented page layout and bot protection. When it fails, use manual paste. Interactive (Guitar Pro/Power/Pro) and paid (Official) arrangements cannot be imported either way.
- **Limited playlist management.** You cannot rename or delete a single playlist. You also cannot remove a song from one playlist on its own: removing a song deletes it from your library and from all playlists. **Delete all** clears everything.
- **Pins are permanent.** There is no way to unpin a song.
- **Profile is not backed up.** **Export** leaves out your profile, and **Delete all** does not reset it.
- **Search depends on iTunes.** If the iTunes API cannot be reached, search shows only matching Fretz Picks, or "Could not search songs right now." if none match.
- **Lint currently fails.** `npm run lint` reports 11 errors and 1 warning. Most are unused variables, and the rest are React hooks rules. This does not stop `npm run dev` from running.

## Troubleshooting

- **The dev server won't start, or Vite reports a Node version error:** check `node -v` against the versions listed under Prerequisites.
- **Search results or album art are missing:** check that your network can reach `itunes.apple.com`.
- **Import fails with "Could not import this file":** the file must be valid JSON. It should be either a Fretz export (with `savedSongs` and `playlists` arrays) or an array of song objects.
- **Your library is suddenly empty:** your data belongs to one browser and one site address. A different browser, a private window, a different port, or cleared site data will each start with an empty library. To bring your songs back, import a backup.
