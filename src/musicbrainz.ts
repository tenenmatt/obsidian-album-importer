// All MusicBrainz interaction. Pure mappers turn raw JSON into typed results;
// the two HTTP functions use Obsidian's requestUrl (which bypasses CORS). This
// module never touches the vault or UI. Network/HTTP errors propagate to the
// caller, which surfaces them as a Notice.

import { requestUrl } from "obsidian";

export const USER_AGENT =
  "ObsidianAlbumImporter/1.0 (https://github.com/yourname/obsidian-album-importer)";

const BASE = "https://musicbrainz.org/ws/2";

export interface ReleaseGroupResult {
  mbid: string;
  title: string;
  /** Display credit incl. join phrases, e.g. "A & B". */
  artistCredit: string;
  /** Individual artist names, for the frontmatter list. */
  artists: string[];
  year: number | null;
  disambiguation: string | null;
}

export interface AlbumMetadata {
  mbid: string;
  album: string;
  artists: string[];
  artistCredit: string;
  year: number | null;
  label: string | null;
  genre: string | null;
  edition: string | null;
}

interface ArtistCreditEntry {
  name?: string;
  joinphrase?: string;
  artist?: { name?: string };
}

interface MbRelease {
  id?: string;
  date?: string;
  status?: string;
  disambiguation?: string;
  "label-info"?: Array<{ label?: { name?: string } }>;
}

// --- Pure mappers -----------------------------------------------------------

export function parseSearchResults(json: unknown): ReleaseGroupResult[] {
  const groups = asArray((json as Record<string, unknown> | null)?.["release-groups"]);
  return groups.map((raw) => {
    const rg = raw as Record<string, unknown>;
    const credit = asArray(rg["artist-credit"]) as ArtistCreditEntry[];
    return {
      mbid: String(rg.id ?? ""),
      title: String(rg.title ?? ""),
      artistCredit: formatCredit(credit),
      artists: creditNames(credit),
      year: parseYear(rg["first-release-date"]),
      disambiguation: nonEmpty(rg.disambiguation),
    };
  });
}

/** Earliest Official release by date; undated releases sort last. Null if none. */
export function pickCanonicalRelease(releases: MbRelease[]): MbRelease | null {
  const official = releases.filter((r) => r.status === "Official");
  if (official.length === 0) return null;

  return official.slice().sort((a, b) => {
    const da = a.date ?? "￿"; // undated → sort last
    const db = b.date ?? "￿";
    return da < db ? -1 : da > db ? 1 : 0;
  })[0];
}

/** Best-effort: highest-count genre name, or null. */
export function pickGenre(genres: Array<{ name?: string; count?: number }> | undefined): string | null {
  if (!genres || genres.length === 0) return null;
  const top = genres.slice().sort((a, b) => (b.count ?? 0) - (a.count ?? 0))[0];
  return nonEmpty(top.name);
}

/**
 * First label name from a release's label-info. Built and tested now; the
 * detail request does not yet include `inc=labels`, so this is null in practice
 * until that upgrade. Wiring it in is a one-line query change.
 */
export function pickLabel(release: MbRelease): string | null {
  const info = release["label-info"];
  if (!info || info.length === 0) return null;
  return nonEmpty(info[0].label?.name);
}

export function mapReleaseGroupDetail(json: unknown): AlbumMetadata {
  const rg = (json ?? {}) as Record<string, unknown>;
  const credit = asArray(rg["artist-credit"]) as ArtistCreditEntry[];
  const releases = asArray(rg.releases) as MbRelease[];
  const canonical = pickCanonicalRelease(releases);

  return {
    mbid: String(rg.id ?? ""),
    album: String(rg.title ?? ""),
    artists: creditNames(credit),
    artistCredit: formatCredit(credit),
    year: parseYear(canonical?.date) ?? parseYear(rg["first-release-date"]),
    label: canonical ? pickLabel(canonical) : null,
    genre: pickGenre(rg.genres as Array<{ name?: string; count?: number }> | undefined),
    // Release-specific disambiguation is more relevant than the group's.
    edition: nonEmpty(canonical?.disambiguation) ?? nonEmpty(rg.disambiguation),
  };
}

export function formatResultLine(r: ReleaseGroupResult): string {
  const suffix = r.year === null ? "" : ` (${r.year})`;
  return `${r.title} — ${r.artistCredit}${suffix}`;
}

// --- HTTP -------------------------------------------------------------------

export async function searchReleaseGroups(terms: string): Promise<ReleaseGroupResult[]> {
  const url = `${BASE}/release-group?query=${encodeURIComponent(terms)}&type=album&fmt=json&limit=10`;
  const response = await requestUrl({ url, headers: { "User-Agent": USER_AGENT } });
  return parseSearchResults(response.json);
}

export async function fetchReleaseGroupDetail(mbid: string): Promise<AlbumMetadata> {
  // `inc` uses `+` separators per MusicBrainz; do not URL-encode them.
  // NOTE: add `+labels` here (and an extra release lookup) to populate `label`.
  const url = `${BASE}/release-group/${mbid}?inc=artists+releases+genres&fmt=json`;
  const response = await requestUrl({ url, headers: { "User-Agent": USER_AGENT } });
  return mapReleaseGroupDetail(response.json);
}

// --- helpers ----------------------------------------------------------------

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function creditNames(credit: ArtistCreditEntry[]): string[] {
  return credit
    .map((entry) => entry.name ?? entry.artist?.name ?? "")
    .filter((name) => name !== "");
}

function formatCredit(credit: ArtistCreditEntry[]): string {
  return credit
    .map((entry) => `${entry.name ?? entry.artist?.name ?? ""}${entry.joinphrase ?? ""}`)
    .join("");
}

function parseYear(date: unknown): number | null {
  if (typeof date !== "string") return null;
  const match = date.match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

function nonEmpty(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
