# Album Importer

I've been using Obsidian to keep track of recent music listening,
things I _intend to_ listen to, and the inherently nonlinear relationships
between albums I find compelling for one reason or another.

To facilitate that listening practice, I want to easily come up with album details,
including album art to help with visual reference.

This repo provides an Obsidian plugin that populates album metadata into a note's
YAML frontmatter by searching [MusicBrainz](https://musicbrainz.org/) or
[Apple Music](https://music.apple.com/) (via the iTunes Search API), and embeds
the cover art at the top of the note.

You provide what you already know (typically `album` and `artist`), optionally
select a Qobuz or Apple Music URL in the note, then run one of the import
commands. The plugin searches the chosen source, lets you pick the right
release, writes the metadata back into frontmatter, and downloads the cover art.

**Note:** this solves a personal problem in a particular way. At time of writing,
I primarily listen to music via Qobuz and Apple Music. I've made no effort to
interface with a comprehensive set of streaming platforms, nor to collect
more comprehensive metadata. I'm not _opposed_ to a more general approach,
as long as additional complexity doesn't spill into practical use.

## Commands

The plugin registers two commands. They behave identically but source their data
differently:

- **Import album metadata (MusicBrainz)** — searches MusicBrainz and downloads
  cover art from the [Cover Art Archive](https://coverartarchive.org/).
- **Import album metadata (Apple Music)** — searches the iTunes Search API and
  downloads cover art from Apple's CDN.

Both are keyless (no account or API key required) and work on desktop and
mobile.

## Usage

1. Create a note (typically from a template with empty frontmatter fields).
2. Fill in whatever you know — `album` and `artist` at minimum.
3. _(Optional)_ Select a Qobuz or Apple Music URL in the note body.
4. Run either import command from the command palette.
5. A search box opens, pre-populated with the best available terms and labelled
   for the source you chose — edit if needed and submit.
6. Pick the correct release from the results list.
7. The plugin merges metadata into frontmatter and embeds the cover art.

## What gets written

The plugin writes only the fields it manages (see Settings) and **leaves every
other frontmatter key — and the entire note body — untouched**.

```yaml
album: "Origami Harvest"
artist:
  - Ambrose Akinmusire
year: 2017
label: "Blue Note Records"          # best-effort; omitted if unavailable
genre: "Jazz"                        # best-effort; omitted if unavailable
edition: "Deluxe Edition"            # omitted if the source has no edition info
cover: "album-covers/Ambrose Akinmusire - Origami Harvest.jpg"
source_url: "https://open.qobuz.com/album/jznzokc14slkc"  # only if a URL was selected
platform: "qobuz"                    # only if a URL was selected
date_added: "2026-06-10"
```

The cover art is embedded as a wikilink at the top of the note body. Re-running
the import replaces an existing embed rather than adding a second one.

`source_url` and `platform` come from a Qobuz or Apple Music URL selected in the
note when you invoke the command, and are independent of which import command
you run. `platform` is `qobuz` or `apple_music`.

## Settings

- **Frontmatter field names** — the YAML key used for each managed field is
  configurable (defaults shown above). The same key is used both for reading
  search inputs and for writing output.
- **Download cover art** _(default: on)_ — when off, no image is downloaded and
  the `cover` field/embed are skipped.
- **Cover art folder** _(default: `album-covers`)_ — vault-relative folder where
  cover images are saved.

## Notes & limitations

- Which optional fields you get depends on the source:
  - **MusicBrainz** — `genre` and `label` are **best-effort** and frequently
    omitted (MusicBrainz genre data is sparse, and label requires data the
    current release lookup does not fetch). `edition` is taken from a
    disambiguation comment when present.
  - **Apple Music** — `genre` is usually present (the album's primary genre).
    The iTunes Search API exposes no record label or edition, so `label` and
    `edition` are never written.
  - In all cases, fields are written only when available and omitted otherwise —
    never written as empty values.
- Optional fields from a previous import are **not** removed if a later import
  lacks them.
- A missing or failed cover download never blocks the metadata import; it is
  logged to the console and the rest of the import proceeds.
- Assumes LF line endings (Obsidian's default).

## Development

See [DEVELOPING.md](DEVELOPING.md) for build, test, and live-testing
instructions. The original design brief is archived at
[docs/original-spec.md](docs/original-spec.md), and implementation judgment calls
are logged in [DECISIONS.md](DECISIONS.md).

## License

[MIT](LICENSE)
