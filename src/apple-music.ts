// All Apple iTunes Search API interaction. Keyless and CORS-friendly via
// Obsidian's requestUrl. Pure mappers turn raw JSON into the shared album
// shapes; two HTTP functions mirror MusicBrainz's search -> detail flow. This
// module never touches the vault or UI. Errors propagate to the caller.

import { requestUrl } from "obsidian";
import { AlbumMetadata, AlbumProvider, AlbumSearchResult, parseYear } from "./album";

const SEARCH = "https://itunes.apple.com/search";
const LOOKUP = "https://itunes.apple.com/lookup";

interface ItunesCollection {
  collectionId?: number | string;
  collectionName?: string;
  artistName?: string;
  releaseDate?: string;
  primaryGenreName?: string;
  artworkUrl100?: string;
}

// --- Pure mappers -----------------------------------------------------------

export function parseSearchResults(json: unknown): AlbumSearchResult[] {
  const results = asArray((json as Record<string, unknown> | null)?.results) as ItunesCollection[];
  return results.map((c) => ({
    id: String(c.collectionId ?? ""),
    title: String(c.collectionName ?? ""),
    artistCredit: String(c.artistName ?? ""),
    year: parseYear(c.releaseDate),
  }));
}

export function mapAlbumDetail(json: unknown): AlbumMetadata {
  const results = asArray((json as Record<string, unknown> | null)?.results) as ItunesCollection[];
  const c = results[0] ?? {};
  const artist = nonEmpty(c.artistName);

  return {
    album: String(c.collectionName ?? ""),
    artists: artist === null ? [] : [artist],
    artistCredit: String(c.artistName ?? ""),
    year: parseYear(c.releaseDate),
    // The iTunes Search API exposes no record label or edition.
    label: null,
    genre: nonEmpty(c.primaryGenreName),
    edition: null,
    coverArtUrl: upscaleArtwork(c.artworkUrl100),
  };
}

/**
 * Artwork URLs come back at 100x100. Apple's CDN serves arbitrary sizes by
 * swapping the dimension token, so request a larger cover. Returns null when no
 * artwork URL is present, or the URL unchanged if it lacks the expected token.
 */
export function upscaleArtwork(url: string | undefined): string | null {
  if (typeof url !== "string" || url.trim() === "") return null;
  return url.replace(/\d+x\d+bb/, "1000x1000bb");
}

// --- HTTP -------------------------------------------------------------------

export async function searchAlbums(terms: string): Promise<AlbumSearchResult[]> {
  const url = `${SEARCH}?term=${encodeURIComponent(terms)}&entity=album&limit=10`;
  const response = await requestUrl({ url });
  return parseSearchResults(response.json);
}

export async function fetchAlbumDetail(id: string): Promise<AlbumMetadata> {
  const url = `${LOOKUP}?id=${encodeURIComponent(id)}&entity=album`;
  const response = await requestUrl({ url });
  return mapAlbumDetail(response.json);
}

export const appleMusicProvider: AlbumProvider = {
  name: "Apple Music",
  search: (terms) => searchAlbums(terms),
  fetchDetail: (result) => fetchAlbumDetail(result.id),
};

// --- helpers ----------------------------------------------------------------

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function nonEmpty(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
