// Step 1 (selection parsing): detect a Qobuz or Apple Music URL in the user's
// selection, infer the platform, and extract a loose search hint from the URL
// slug where one is available. Pure — no Obsidian or network access.

export type Platform = "qobuz" | "apple_music";

export interface UrlInfo {
  sourceUrl: string;
  platform: Platform;
  /** Loose search hint derived from the URL slug, or null when none exists. */
  hint: string | null;
}

/**
 * Parse a selection into URL metadata, or null if it is not a recognised
 * music URL. Hyphens in an extracted slug are converted to spaces as a loose
 * hint; for opaque short-URL ids no hint is produced.
 */
export function parseSelectionUrl(selection: string): UrlInfo | null {
  const trimmed = selection.trim();
  if (trimmed === "") return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();

  if (host === "qobuz.com" || host.endsWith(".qobuz.com")) {
    // open.qobuz.com short links carry an opaque id with no usable slug.
    const hint = host === "open.qobuz.com" ? null : slugHintAfterAlbum(url.pathname);
    return { sourceUrl: trimmed, platform: "qobuz", hint };
  }

  if (host === "music.apple.com") {
    return {
      sourceUrl: trimmed,
      platform: "apple_music",
      hint: slugHintAfterAlbum(url.pathname),
    };
  }

  return null;
}

/**
 * Find the path segment immediately following an `album` segment and turn it
 * into a hint by replacing hyphens with spaces. Returns null when there is no
 * such slug.
 */
function slugHintAfterAlbum(pathname: string): string | null {
  const segments = pathname.split("/").filter((s) => s.length > 0);
  const albumIndex = segments.indexOf("album");
  if (albumIndex === -1 || albumIndex + 1 >= segments.length) return null;

  const slug = decodeURIComponent(segments[albumIndex + 1]);
  const hint = slug.replace(/-/g, " ").replace(/\s+/g, " ").trim();
  return hint === "" ? null : hint;
}
