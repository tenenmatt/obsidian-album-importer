# Album Importer — Obsidian Plugin Spec

> **Status: historical.** This is the original pre-implementation design brief
> (June 2026). It is preserved for provenance — `DECISIONS.md` references it —
> but is **not** kept in sync with the shipped plugin. For current behavior, see
> `README.md` (what it does), `DECISIONS.md` (where the implementation diverged
> from this spec), and the source. Notably, this spec predates the Apple Music /
> iTunes import command (a second command added after writing) and treats
> `label` as fetched when in practice it is best-effort and usually omitted.

## Purpose

A plugin that populates album metadata into a note's YAML frontmatter by
searching MusicBrainz. The user provides search terms via existing frontmatter
and/or a selected URL; the plugin queries MusicBrainz, presents results for
disambiguation, writes the chosen album's metadata back into frontmatter, and
embeds cover art at the top of the note body.

---

## User Workflow

1. Create a new note from a template. The template includes empty frontmatter
   fields for all relevant metadata (field names match plugin configuration).
2. Fill in whatever is already known — typically `album` and `artist` at
   minimum.
3. Optionally, select a Qobuz or Apple Music URL in the note body.
4. Invoke the command **"Import album metadata"** from the command palette.
5. A search modal opens, pre-populated with the best available search terms.
   The user can edit these before submitting.
6. A results list appears. The user selects the correct release.
7. Frontmatter is merged (plugin fields written, all other fields preserved),
   cover art is downloaded and embedded at the top of the note body.

---

## Plugin Settings

All settings are stored in the standard Obsidian plugin data file.

### Field name configuration

Each setting controls the YAML key the plugin uses for both *reading* (as a
search input) and *writing* (as metadata output). Defaults shown in
parentheses.

| Purpose | Default key |
|---|---|
| Album title | `album` |
| Artist | `artist` |
| Year | `year` |
| Label | `label` |
| Genre | `genre` |
| Edition | `edition` |
| Cover art path | `cover` |
| Source URL | `source_url` |
| Source platform | `platform` |
| Date imported | `date_added` |

### Behaviour settings

| Setting | Type | Default |
|---|---|---|
| Download cover art | Toggle | On |
| Cover art folder | Text | `album-covers` |

---

## Data Model

### Fields written to frontmatter

```yaml
album: "Origami Harvest"
artist:
  - Ambrose Akinmusire
year: 2017
label: "Blue Note Records"
genre: "Jazz"
edition: "Deluxe Edition"        # omitted if not present in MusicBrainz data
cover: "album-covers/Ambrose Akinmusire - Origami Harvest.jpg"
source_url: "https://open.qobuz.com/album/jznzokc14slkc"  # omitted if no URL was selected
platform: "qobuz"                # omitted if no URL was selected
date_added: "2026-06-10"
```

**Notes:**

- `artist` is always written as a YAML list, even when there is only one
  artist. This matches the user's existing template convention and accommodates
  albums with multiple credited artists.
- `edition` is only written if MusicBrainz returns a disambiguation comment or
  explicit edition label for the release (e.g. "Remastered", "Deluxe Edition").
  It is omitted entirely — not written as an empty string — if absent.
- `source_url` and `platform` are only written if a URL was selected when the
  command was invoked.
- `platform` is inferred from the URL hostname: `qobuz` for any qobuz.com
  domain, `apple_music` for music.apple.com. Value is a lowercase string
  without spaces.
- `cover` stores the vault-relative path to the downloaded image file as a
  plain string. It is omitted if cover art download is disabled or if no image
  is found.
- `date_added` is always written as an ISO 8601 date string (`YYYY-MM-DD`).

### Frontmatter merge behaviour

The plugin overwrites only the fields it manages (the configured key names
listed above). All other frontmatter keys — including user fields like `rating`,
`tags`, or `notes` — are left untouched. If a managed field already has a value
from a previous import, it is overwritten with fresh data from MusicBrainz.

Parsing and re-serialising frontmatter must preserve the rest of the note body
exactly, including any content between the closing `---` and end of file.

---

## Command Flow

### Step 1 — Gather inputs

On invocation, the plugin collects two kinds of input:

**From the current selection:**

- If selected text matches a Qobuz URL pattern (`qobuz.com` or
  `open.qobuz.com`), store it as the candidate `source_url` and set
  `platform` to `"qobuz"`. Attempt to extract a search hint from the URL slug
  if one is present (e.g. `origami-harvest-ambrose-akinmusire` from a
  `www.qobuz.com` URL); convert hyphens to spaces as a loose hint. For
  `open.qobuz.com` short URLs the ID segment is opaque — no hint can be
  extracted.
- If selected text matches an Apple Music URL pattern (`music.apple.com`),
  store it as the candidate `source_url`, set `platform` to `"apple_music"`,
  and extract the slug segment as a search hint.
- If selected text is neither of the above, ignore it for URL purposes.

**From existing frontmatter:**

- Read the configured album field → primary search term.
- Read the configured artist field → secondary search term. If the value is a
  YAML list, join the first element (primary artist) as the search term.

**Search term precedence:**

Frontmatter values take priority over URL-derived hints. If frontmatter
provides an album title, use it; only fall back to a URL hint if the frontmatter
field is absent or empty.

### Step 2 — Search modal

Open a small modal containing a single text input labelled "Search MusicBrainz".

Pre-populate the input with the best available terms:
- If both album and artist are known: `{album} {artist}` (e.g.
  `Origami Harvest Akinmusire`)
- If only album is known: the album title
- If only a URL hint is available: the hint text
- If nothing is known: leave blank

The user may edit the text freely before submitting. Submitting an empty string
shows a notice ("Enter an album title to search") and closes without proceeding.

### Step 3 — MusicBrainz search

Query the MusicBrainz **release group** search endpoint with the submitted text:

```
GET https://musicbrainz.org/ws/2/release-group
  ?query={terms}
  &type=album
  &fmt=json
  &limit=10
```

The `User-Agent` header must be set to a descriptive string per MusicBrainz
policy, e.g.:

```
ObsidianAlbumImporter/1.0 (https://github.com/yourname/obsidian-album-importer)
```

Omitting or genericising the User-Agent risks request blocking.

MusicBrainz enforces a rate limit of approximately 1 request/second for
unauthenticated clients. A single search call will not exceed this.

### Step 4 — Results modal

Display results using Obsidian's `SuggestModal`. Each result renders as a
single line showing enough context to disambiguate:

```
Origami Harvest — Ambrose Akinmusire (2017, Blue Note Records)
```

If MusicBrainz returns no results, close the modal and show a Notice:
"No results found — try different search terms."

The user selects a release group. If they dismiss the modal without selecting,
the command exits silently.

### Step 5 — Fetch release details

Using the selected release group's MusicBrainz ID (MBID), fetch the primary
release to obtain label, exact year, and edition information:

```
GET https://musicbrainz.org/ws/2/release-group/{mbid}
  ?inc=artists+releases
  &fmt=json
```

From the returned releases array, select the earliest release (by date) with
`status: "Official"` as the canonical release. Use its label and date. If a
disambiguation comment is present on either the release group or the selected
release, use it as the `edition` value.

### Step 6 — Cover art

Request the front cover image from the Cover Art Archive using the release group
MBID:

```
GET https://coverartarchive.org/release-group/{mbid}/front
```

This returns a redirect to the actual image file. Follow the redirect and
download the image bytes.

Save the image to the configured cover art folder using the filename:
`{Artist} - {Album}.jpg` with filesystem-unsafe characters replaced by
underscores. If the file already exists (re-importing the same album),
overwrite it silently.

If the Cover Art Archive returns a 404 or the download fails for any reason,
log a warning to the console and continue without a cover. Do not block the
rest of the import.

### Step 7 — Write output

**Frontmatter:** Parse the existing frontmatter, merge in plugin-managed fields
(overwriting any prior values for those keys), leave all other keys untouched,
and write the result back to the note.

**Note body:** If cover art was successfully downloaded, prepend
`![[{vault-relative-cover-path}]]` followed by a blank line immediately after
the closing `---` of the frontmatter. If the note body already begins with an
image embed from a previous import (detect by checking whether the first
non-empty line of the body is a wikilink embed), replace it rather than
prepending a second one.

**Completion:** Show a Notice: `✅ {Artist} — {Album}`.

---

## API Reference

### MusicBrainz

- Base URL: `https://musicbrainz.org/ws/2/`
- Auth: none required
- Required header: `User-Agent` (descriptive string, see above)
- Rate limit: ~1 req/sec unauthenticated
- Response format: JSON (`&fmt=json` required)

Key endpoints used:

| Endpoint | Purpose |
|---|---|
| `GET /release-group?query=...` | Text search for album candidates |
| `GET /release-group/{mbid}?inc=artists+releases` | Fetch releases for selected group |

### Cover Art Archive

- Base URL: `https://coverartarchive.org/`
- Auth: none required
- Key endpoint: `GET /release-group/{mbid}/front` → redirect to image

---

## Module Architecture

Suggested file breakdown for implementation:

```
main.ts              Plugin entry point. Registers the command and settings tab.
                     Orchestrates the command flow by calling other modules in
                     sequence.

settings.ts          PluginSettings interface, DEFAULT_SETTINGS constant, and
                     the PluginSettingTab class that renders the settings UI.

frontmatter.ts       Functions for parsing YAML frontmatter from note content,
                     merging plugin fields into an existing frontmatter object,
                     and serialising it back to a string. Must not disturb any
                     fields not explicitly managed by the plugin.

search-modal.ts      A Modal subclass presenting a single text input. Resolves
                     a Promise with the submitted search string, or null if
                     dismissed.

suggest-modal.ts     A SuggestModal subclass that accepts an array of
                     MusicBrainz release group results and resolves a Promise
                     with the user's selection, or null if dismissed.

musicbrainz.ts       All MusicBrainz API interaction: search release groups,
                     fetch release group detail, select canonical release.
                     Returns typed result objects; does not touch the vault
                     or UI.

cover-art.ts         Downloads a cover image from the Cover Art Archive by
                     release group MBID. Saves to vault. Returns the
                     vault-relative path, or null on failure.
```

No external npm dependencies beyond `obsidian` (dev dependency only). All HTTP
calls use Obsidian's `requestUrl`, which bypasses CORS and works on both
desktop and mobile.

---

## Error Handling

| Situation | Behaviour |
|---|---|
| Search modal submitted empty | Notice: "Enter an album title to search." No further action. |
| MusicBrainz returns no results | Notice: "No results found — try different search terms." |
| MusicBrainz API error / network failure | Notice: "MusicBrainz search failed: {error message}." |
| User dismisses results modal | Silent exit, no changes to the note. |
| Cover art not found (404) | Log warning; continue import without cover field or embed. |
| Cover art download fails | Same as above. |
| No active note/editor | Notice: "Open a note first." |
| Frontmatter parse error | Notice: "Could not parse existing frontmatter." No changes written. |

Errors from MusicBrainz are surfaced to the user as Notices. Errors from the
Cover Art Archive are silent (logged only), since a missing image should not
block a successful metadata import.

---

## Future Possibilities (Out of Scope for v1)

- **Automatic search on note open:** Watch for notes with template-shaped
  frontmatter and offer to import on open. Deferred — additive trigger is
  sufficient and less surprising.
- **Replace source URL with cover embed:** Currently the URL is left in place;
  a future option could remove it or replace it with the embedded image.
- **Format/resolution metadata:** If Qobuz credentials are ever added, the
  `format` field (e.g. `24bit/96kHz`) could be populated from their API.
- **Multi-artist handling:** Currently uses the first artist from the `artist`
  list for search. Could be extended to search all credited artists.
- **Configurable result count:** The MusicBrainz search `limit` is hardcoded
  to 10. Could be a setting.
