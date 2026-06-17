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
  main.ts            Plugin entry: registers the command + settings tab,
                     orchestrates the import flow.
  settings.ts        PluginSettings, DEFAULT_SETTINGS, settings tab UI.
  platform.ts        Detect Qobuz/Apple Music URLs, infer platform, slug hints.
  search-terms.ts    Reduce artist list → primary; build the pre-populated query.
  musicbrainz.ts     MusicBrainz search + release-group detail; pure mappers.
  cover-art.ts       Cover Art Archive download + vault save (injected writer).
  build-fields.ts    Assemble the managed-field object (omit-when-absent rules).
  frontmatter.ts     Hand-rolled lossless frontmatter merge + cover embed.
  search-modal.ts    Single-input search Modal.
  suggest-modal.ts   Results SuggestModal.
test/
  *.test.ts          One spec per logic module.
  obsidian-stub.ts   Runtime stand-in for `obsidian`, aliased in vitest.config.
```

## Testing approach

- **Logic modules** (`platform`, `search-terms`, `frontmatter`, `musicbrainz`,
  `cover-art`, `build-fields`) are developed red/green and held to **100%**
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
   metadata"** from the command palette (Cmd/Ctrl-P).

5. After code changes: `npm run dev` rebuilds `main.js` automatically; reload the
   plugin to pick it up (toggle it off/on in settings, or use the
   [Hot Reload](https://github.com/pjeby/hot-reload) plugin to skip the toggle).

### Faster reloads (optional)

Install the community **Hot Reload** plugin and drop an empty `.hotreload` file
in this folder; it reloads the plugin automatically whenever `main.js` changes,
so you only need `npm run dev` running in the background.

## Deferred upgrade: populating `label`

`pickLabel` in `musicbrainz.ts` is implemented and unit-tested, but the detail
request is intentionally unwired — `fetchReleaseGroupDetail` uses
`inc=artists+releases+genres` (no `+labels`). To reliably populate `label`, add
`+labels` and/or a follow-up `GET /release/{mbid}?inc=labels`, then pass the
release to the existing `pickLabel`. See the `NOTE` comment in that function.
