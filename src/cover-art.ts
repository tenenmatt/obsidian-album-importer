// Step 6: download the front cover from the Cover Art Archive and save it to
// the vault. A missing or failed cover must never block the import, so every
// failure path is swallowed (logged) and yields null. The vault is injected as
// a tiny interface so this module is testable without a real Obsidian Vault.

import { requestUrl } from "obsidian";

const CAA_BASE = "https://coverartarchive.org";

// Characters that are unsafe in filenames across platforms, plus control chars.
const UNSAFE_CHARS = /[\\/:*?"<>|\x00-\x1f]/g;

export interface VaultFileWriter {
  /** Create the folder if it does not already exist. */
  ensureFolder(folder: string): Promise<void>;
  /** Write bytes to a vault-relative path, overwriting if present. */
  writeBinary(path: string, data: ArrayBuffer): Promise<void>;
}

/** Compose `{Artist} - {Album}.jpg`, replacing unsafe characters with `_`. */
export function sanitizeFilename(artist: string, album: string): string {
  const clean = (s: string) => s.replace(UNSAFE_CHARS, "_").trim();
  return `${clean(artist)} - ${clean(album)}.jpg`;
}

/**
 * Fetch the release group's front cover and save it under `folder`. Returns the
 * vault-relative path on success, or null on any failure (404, network error,
 * or write error) after logging a warning.
 */
export async function downloadCoverArt(
  mbid: string,
  artist: string,
  album: string,
  folder: string,
  vault: VaultFileWriter,
): Promise<string | null> {
  const url = `${CAA_BASE}/release-group/${mbid}/front`;
  const path = `${folder}/${sanitizeFilename(artist, album)}`;

  try {
    const response = await requestUrl({ url });
    await vault.ensureFolder(folder);
    await vault.writeBinary(path, response.arrayBuffer);
    return path;
  } catch (error) {
    console.warn(`Album Importer: cover art unavailable for ${mbid}:`, error);
    return null;
  }
}
