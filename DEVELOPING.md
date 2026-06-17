# Developing

## Prerequisites

- Node 18+ and npm
- `npm install` once to pull dev dependencies (the only runtime dependency is
  `obsidian` itself, which the app provides)

## Commands

| Command | What it does |
|---|---|
| `npm test` | Run the Vitest suite once. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run coverage` | Run tests with a v8 coverage report (logic modules are held to 100%). |
| `npm run dev` | esbuild in watch mode → rebuilds `main.js` on save. |
| `npm run build` | Type-check (`tsc --noEmit`) then produce a production `main.js`. |

## Project layout

```
src/
  main.ts            Plugin entry: registers the two import commands + settings
                     tab, orchestrates the import flow over a provider.
  settings.ts        PluginSettings, DEFAULT_SETTINGS, settings tab UI.
  platform.ts        Detect Qobuz/Apple Music URLs, infer platform, slug hints.
  search-terms.ts    Reduce artist list → primary; build the pre-populated query.
  album.ts           Cross-provider contract (types) + shared helpers
                     (parseYear, result-line formatting).
  musicbrainz.ts     MusicBrainz search + release-group detail; pure mappers.
  apple-music.ts     Apple Music (iTunes Search API) search + detail; pure mappers.
  cover-art.ts       Download a cover image from a URL + vault save (injected
                     writer); used by both providers.
  build-fields.ts    Assemble the managed-field object (omit-when-absent rules).
  frontmatter.ts     Hand-rolled lossless frontmatter merge + cover embed.
  search-modal.ts    Single-input search Modal.
  suggest-modal.ts   Results SuggestModal.
test/
  *.test.ts          One spec per logic module.
  obsidian-stub.ts   Runtime stand-in for `obsidian`, aliased in vitest.config.
```

## Testing approach

- **Logic modules** (`platform`, `search-terms`, `album`, `musicbrainz`,
  `apple-music`, `cover-art`, `build-fields`, `frontmatter`) are developed
  red/green and held to **100%**
  coverage. This is enforced by thresholds in `vitest.config.ts`.
- **UI/glue** (`main.ts`, `*-modal.ts`, `settings.ts`) is **excluded** from the
  coverage target. These are thin wrappers over Obsidian base classes whose
  behaviour lives in the extracted pure functions above; asserting against a
  mock of Obsidian's DOM would test the mock, not our code.
- The real `obsidian` module is injected by the app at runtime and is not
  resolvable in a test process, so `vitest.config.ts` aliases `obsidian` to
  `test/obsidian-stub.ts`. HTTP-touching tests `vi.mock("obsidian")` and stub
  `requestUrl` per-test.

If you add a branch to a logic module, add the test that exercises it — the
coverage thresholds will fail the run otherwise.

## Trying it live in Obsidian

A plugin folder needs `main.js` and `manifest.json`. The build is gitignored, so
build it first, then point a vault at this directory.

1. Build the bundle:
   ```
   npm run dev      # watch mode: rebuilds main.js on every save
   ```
   (or `npm run build` for a one-off production bundle)

2. Link this repo into a test vault's plugin folder (symlink avoids copying on
   every change):
   ```
   ln -s "$(pwd)" /path/to/YourVault/.obsidian/plugins/album-importer
   ```
   On Windows, copy the folder or use `mklink /D` instead.

3. In Obsidian: **Settings → Community plugins**, enable **Album Importer**
   (turn off Restricted Mode if needed).

4. Open a note with `album`/`artist` frontmatter and run **"Import album
   metadata (MusicBrainz)"** or **"Import album metadata (Apple Music)"** from
   the command palette (Cmd/Ctrl-P).

5. After code changes: `npm run dev` rebuilds `main.js` automatically; reload the
   plugin to pick it up (toggle it off/on in settings, or use the
   [Hot Reload](https://github.com/pjeby/hot-reload) plugin to skip the toggle).

### Faster reloads (optional)

Install the community **Hot Reload** plugin and drop an empty `.hotreload` file
in this folder; it reloads the plugin automatically whenever `main.js` changes,
so you only need `npm run dev` running in the background.

## Releasing

Releases are produced by `.github/workflows/release.yml`, which runs on a pushed
**tag** — not on PR merges. The cycle:

1. **Bump the version.** From a clean working tree, run
   `npm version <patch|minor|major>`. This invokes `version-bump.mjs`, which
   syncs `manifest.json` and `versions.json` to the new `package.json` version
   (and stages them), then `npm version` makes the bump commit and a matching
   git tag. (`versions.json` maps each plugin version → its `minAppVersion`.)
2. **Push the commit and the tag.**
   ```
   git push && git push --tags
   ```
   Pushing the tag is the trigger; pushing a branch alone never pushes tags.
3. **The workflow builds and drafts.** It type-checks, builds, and creates a
   **draft** GitHub release named for the tag, with `main.js` and
   `manifest.json` attached. It does *not* publish.
4. **Publish the draft.**
   ```
   gh release edit <version> --draft=false
   ```
   (or the Edit → Publish button on the repo's Releases page).

Notes:

- Tag names must match the `manifest.json` version **exactly, with no `v`
  prefix** (`1.0.0`, not `v1.0.0`). The workflow titles the release from the
  tag, and Obsidian matches a release tag against the manifest version.
- A draft lives at a temporary `untagged-…` URL and does **not** own the public
  `/releases/tag/<version>` page until published — until then that tag page
  shows only GitHub's auto-generated source archives, not the build artifacts.
- `gh release view <version>` shows the draft's attached assets before you
  publish.
- First-time directory listing is separate: submit a one-line entry to
  [`obsidianmd/obsidian-releases`](https://github.com/obsidianmd/obsidian-releases)
  pointing at this repo. After that, users update via the published releases
  above.

## Deferred upgrade: populating `label`

`pickLabel` in `musicbrainz.ts` is implemented and unit-tested, but the detail
request is intentionally unwired — `fetchReleaseGroupDetail` uses
`inc=artists+releases+genres` (no `+labels`). To reliably populate `label`, add
`+labels` and/or a follow-up `GET /release/{mbid}?inc=labels`, then pass the
release to the existing `pickLabel`. See the `NOTE` comment in that function.
