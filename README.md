# Album Importer

An Obsidian plugin that populates album metadata into a note's YAML frontmatter
by searching [MusicBrainz](https://musicbrainz.org/), and embeds the cover art
at the top of the note.

You provide what you already know (typically `album` and `artist`), optionally
select a Qobuz or Apple Music URL, and the plugin searches MusicBrainz, lets you
pick the right release, writes the metadata back into frontmatter, and downloads
the cover art from the [Cover Art Archive](https://coverartarchive.org/).

## Usage

1. Create a note (typically from a template with empty frontmatter fields).
2. Fill in whatever you know — `album` and `artist` at minimum.
3. *(Optional)* Select a Qobuz or Apple Music URL in the note body.
4. Run **"Import album metadata"** from the command palette.
5. A search box opens, pre-populated with the best available terms — edit if
   needed and submit.
6. Pick the correct release from the results list.
7. The plugin merges metadata into frontmatter and embeds the cover art.

## What gets written

The plugin writes only the fields it manages (see Settings) and leaves every
other frontmatter key — and the entire note body — untouched.

```yaml
album: "Origami Harvest"
artist:
  - Ambrose Akinmusire
year: 2017
label: "Blue Note Records"          # best-effort; omitted if unavailable
genre: "Jazz"                        # best-effort; omitted if unavailable
edition: "Deluxe Edition"            # omitted if MusicBrainz has no edition info
cover: "album-covers/Ambrose Akinmusire - Origami Harvest.jpg"
source_url: "https://open.qobuz.com/album/jznzokc14slkc"  # only if a URL was selected
platform: "qobuz"                    # only if a URL was selected
date_added: "2026-06-10"
```

The cover art is embedded as a wikilink at the top of the note body. Re-running
the import replaces an existing embed rather than adding a second one.

## Settings

- **Frontmatter field names** — the YAML key used for each managed field is
  configurable (defaults shown above). The same key is used both for reading
  search inputs and for writing output.
- **Download cover art** *(default: on)* — when off, no image is downloaded and
  the `cover` field/embed are skipped.
- **Cover art folder** *(default: `album-covers`)* — vault-relative folder where
  cover images are saved.

## Notes & limitations

- `genre` and `label` are **best-effort**: MusicBrainz genre data is often
  sparse, and label requires data the current release lookup does not fetch, so
  both are frequently omitted in this version. They are written when available
  and omitted otherwise (never written as empty values).
- Optional fields from a previous import are **not** removed if a later import
  lacks them.
- A missing or failed cover download never blocks the metadata import; it is
  logged to the console and the rest of the import proceeds.
- Assumes LF line endings (Obsidian's default).

## Development

See [DEVELOPING.md](DEVELOPING.md) for build, test, and live-testing
instructions.

## License

MIT
