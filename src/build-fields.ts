// Assemble the plugin-managed frontmatter object from album metadata and
// the import context, applying the omit-when-absent rules (optional fields are
// left out entirely rather than written as empty values). Pure — type-only
// imports keep this free of Obsidian/network runtime.

import type { ManagedFields } from "./frontmatter";
import type { AlbumMetadata } from "./album";
import type { FieldKeys } from "./settings";

export interface ImportContext {
  metadata: AlbumMetadata;
  sourceUrl: string | null;
  platform: string | null;
  coverPath: string | null;
  /** ISO 8601 date (YYYY-MM-DD). */
  dateAdded: string;
}

export function buildManagedFields(ctx: ImportContext, keys: FieldKeys): ManagedFields {
  const { metadata } = ctx;
  const fields: ManagedFields = {
    [keys.album]: metadata.album,
    [keys.artist]: metadata.artists,
    [keys.dateAdded]: ctx.dateAdded,
  };

  if (metadata.year !== null) fields[keys.year] = metadata.year;
  if (metadata.label !== null) fields[keys.label] = metadata.label;
  if (metadata.genre !== null) fields[keys.genre] = metadata.genre;
  if (metadata.edition !== null) fields[keys.edition] = metadata.edition;
  if (ctx.coverPath !== null) fields[keys.cover] = ctx.coverPath;
  if (ctx.sourceUrl !== null) fields[keys.sourceUrl] = ctx.sourceUrl;
  if (ctx.platform !== null) fields[keys.platform] = ctx.platform;

  return fields;
}
