// Step 1 (frontmatter inputs) + Step 2 (modal pre-population): reduce a
// possibly-list artist value to its primary name, and assemble the search
// string the modal opens with. Pure — no Obsidian or network access.

export interface SearchTermInput {
  /** Album title from frontmatter (the configured album key), if any. */
  album?: string | null;
  /** Primary artist name (already reduced from any list), if any. */
  artist?: string | null;
  /** Loose hint derived from a selected URL slug, if any. */
  urlHint?: string | null;
}

/**
 * Reduce a frontmatter artist value to a single primary-artist string.
 * Accepts a plain string or a YAML list; returns the first non-empty string
 * entry, or null when no usable value exists.
 */
export function primaryArtist(value: unknown): string | null {
  if (typeof value === "string") {
    return nonEmpty(value);
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === "string") {
        const trimmed = nonEmpty(entry);
        if (trimmed !== null) return trimmed;
      }
    }
  }
  return null;
}

/**
 * Build the pre-populated search string. Frontmatter album takes precedence
 * over a URL hint as the "title" term; the artist (when known) is appended.
 * Returns an empty string when nothing usable is available.
 */
export function buildSearchTerms(input: SearchTermInput): string {
  const title = nonEmpty(input.album ?? "") ?? nonEmpty(input.urlHint ?? "");
  const artist = nonEmpty(input.artist ?? "");

  return [title, artist].filter((part): part is string => part !== null).join(" ");
}

function nonEmpty(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
