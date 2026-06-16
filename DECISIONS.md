# Decisions Log

A running record of judgment calls made while implementing against
`docs/original-spec.md` — particularly where the spec was ambiguous, silent, or
internally inconsistent. Each entry: the decision, why, and where it diverged
from the spec. Low-risk/reversible calls are made and logged here; data-model,
hard-to-reverse, dependency, or user-visible-divergent calls are raised before
landing.

## 2026-06-11 — bug fix

### SuggestModal: defer the dismissal resolve
The results modal was resolving its promise with `null` even when a release was
selected, so nothing downstream ran. Cause: on a mouse selection Obsidian fires
`SuggestModal.onClose` (which resolved `null`) *before* `onChooseSuggestion`
(which resolves the chosen item), and a promise only resolves once. Fix:
`onClose` now defers its `null` resolution via `setTimeout(…, 0)` so the
synchronous `onChooseSuggestion` wins the single-resolve race. Affects mouse and
keyboard selection alike. Also added a top-level try/catch in `main.ts` so any
unexpected failure surfaces as a Notice instead of failing silently.

## 2026-06-10 — initial implementation

### genre / label sourcing = best-effort (raised, not unilateral)
Decided with the user. MusicBrainz genre data is sparse and `label` requires
data the specced release lookup doesn't return. Write when available, omit when
not (never empty). `pickLabel` is built + tested but the request is unwired
(`inc=artists+releases+genres`, no `+labels`) — upgrade is one line later.
*Spec divergence:* the data model promises `genre`/`label`, but the Step 5 API
call returns neither.

### YAML handling = hand-rolled line-oriented merge (raised)
Decided with the user. No `yaml` dependency; only managed keys' lines are
edited, preserving other keys, comments, order, and the body byte-for-byte.
*Spec note:* honors the spec's "no deps beyond obsidian."

### Results-modal line = `Title — Artist (Year)` (no label)
The spec's example line includes the label, but label isn't known until after
selection (Step 5). Dropped label from the disambiguation line.
*Spec divergence:* Step 4 example shows `(2017, Blue Note Records)`.

### Search pre-population uses the full artist name
The spec example renders `Origami Harvest Akinmusire` (last name only); treated
as a typo and used the full frontmatter artist value.
*Spec divergence:* line ~149 of the spec.

### Frontmatter merge is "set-only" (no auto-delete) — REVISIT
Optional fields absent from a new import are not removed if a prior import left
a value. Simpler and matches "overwrite only fields it writes," but may surprise
on re-import with fewer fields. Flagged to the user as the most likely thing to
revisit. *Spec:* silent on removal of stale optional fields.

### Notes without frontmatter get a block created
If a note has no `---` block, one is created. *Spec:* assumes a template-created
note already has frontmatter; silent on the empty case.

### LF line endings only
CRLF not handled, to keep the hand-rolled parser bounded. *Spec:* silent.

### `year` written as a bare integer; `date_added` overwrites on re-import
Matches the data-model example (`year: 2017`) and the "managed fields are
overwritten" rule. *Spec:* consistent; `date_added` re-write behavior was
implicit.

### Apple Music slug hint converts hyphens → spaces
The spec states this explicitly only for Qobuz; applied the same to Apple Music
for consistency. *Spec divergence:* Step 1 only specifies it for Qobuz.

### Cover filename uses the display artist credit
`{artistCredit} - {album}.jpg` with unsafe chars (`\ / : * ? " < > |` + control)
→ `_`. *Spec:* "filesystem-unsafe characters" left undefined; set chosen here.

### No artificial MusicBrainz rate-limit delay
Search → detail are two musicbrainz.org calls, but the user's disambiguation
step sits between them, providing natural spacing for the ~1 req/sec limit.
*Spec:* notes the limit; no explicit mitigation required.
