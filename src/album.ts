// Cross-provider contract. Both the MusicBrainz and Apple Music clients produce
// these shapes, so the import flow in main.ts and the picker modal can be
// written once against any provider. Pure types + one formatter — no Obsidian
// or network access.

/** A single row in the disambiguation picker (Step 4). */
export interface AlbumSearchResult {
  /** Provider id used to fetch full detail (mbid, or iTunes collectionId). */
  id: string;
  title: string;
  /** Display credit incl. join phrases, e.g. "A & B". */
  artistCredit: string;
  year: number | null;
}

/** Full album metadata used to build managed frontmatter + download cover art. */
export interface AlbumMetadata {
  album: string;
  artists: string[];
  artistCredit: string;
  year: number | null;
  label: string | null;
  genre: string | null;
  edition: string | null;
  /** Direct URL to the front cover image, or null when unavailable. */
  coverArtUrl: string | null;
}

/**
 * A lookup backend. `search` returns light rows for the picker; `fetchDetail`
 * turns the chosen row into full metadata (which may involve a second request).
 */
export interface AlbumProvider {
  /** Human name shown in Notices and the search modal label. */
  readonly name: string;
  search(terms: string): Promise<AlbumSearchResult[]>;
  fetchDetail(result: AlbumSearchResult): Promise<AlbumMetadata>;
}

export function formatResultLine(r: AlbumSearchResult): string {
  const suffix = r.year === null ? "" : ` (${r.year})`;
  return `${r.title} — ${r.artistCredit}${suffix}`;
}

/**
 * Extract a 4-digit leading year from a date string (e.g. "2017-10-13" or an
 * ISO timestamp), or null when the value is not a string or has no leading year.
 * Shared by every provider, since both MusicBrainz and iTunes return
 * year-leading date strings.
 */
export function parseYear(date: unknown): number | null {
  if (typeof date !== "string") return null;
  const match = date.match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}
