import {
  Editor,
  MarkdownFileInfo,
  MarkdownView,
  Notice,
  Plugin,
  TFile,
  normalizePath,
} from "obsidian";
import {
  AlbumImporterSettingTab,
  DEFAULT_SETTINGS,
  PluginSettings,
} from "./settings";
import { parseSelectionUrl } from "./platform";
import { primaryArtist, buildSearchTerms } from "./search-terms";
import { searchReleaseGroups, fetchReleaseGroupDetail } from "./musicbrainz";
import { downloadCoverArt, VaultFileWriter } from "./cover-art";
import { buildManagedFields } from "./build-fields";
import { mergeFrontmatter, setCoverEmbed, FrontmatterParseError } from "./frontmatter";
import { SearchModal } from "./search-modal";
import { ResultSuggestModal } from "./suggest-modal";

export default class AlbumImporterPlugin extends Plugin {
  settings!: PluginSettings;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addCommand({
      id: "import-album-metadata",
      name: "Import album metadata",
      editorCallback: (editor, ctx) => this.importAlbum(editor, ctx),
    });
    this.addSettingTab(new AlbumImporterSettingTab(this.app, this));
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) ?? {};
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...data,
      fieldKeys: { ...DEFAULT_SETTINGS.fieldKeys, ...(data.fieldKeys ?? {}) },
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async importAlbum(
    editor: Editor,
    ctx: MarkdownView | MarkdownFileInfo,
  ): Promise<void> {
    const file = ctx.file;
    if (!file) {
      new Notice("Open a note first.");
      return;
    }

    try {
      await this.runImport(editor, file);
    } catch (error) {
      // Safety net: surface any unexpected failure instead of failing silently.
      console.error("[Album Importer] unexpected error:", error);
      new Notice(`Album import failed: ${messageOf(error)}`);
    }
  }

  private async runImport(editor: Editor, file: TFile): Promise<void> {
    const keys = this.settings.fieldKeys;

    // Step 1 — gather inputs from the selection and existing frontmatter.
    const urlInfo = parseSelectionUrl(editor.getSelection());
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    const album = typeof fm[keys.album] === "string" ? (fm[keys.album] as string) : null;
    const artist = primaryArtist(fm[keys.artist]);
    const prepopulated = buildSearchTerms({
      album,
      artist,
      urlHint: urlInfo?.hint ?? null,
    });

    // Step 2 — search modal.
    const terms = await new SearchModal(this.app, prepopulated).openAndAwait();
    if (terms === null) return; // dismissed
    if (terms.trim() === "") {
      new Notice("Enter an album title to search.");
      return;
    }

    // Step 3 — MusicBrainz search.
    let results;
    try {
      results = await searchReleaseGroups(terms.trim());
    } catch (error) {
      new Notice(`MusicBrainz search failed: ${messageOf(error)}`);
      return;
    }
    if (results.length === 0) {
      new Notice("No results found — try different search terms.");
      return;
    }

    // Step 4 — results modal.
    const chosen = await new ResultSuggestModal(this.app, results).openAndAwait();
    if (chosen === null) return; // dismissed silently

    // Step 5 — fetch release details. User disambiguation provides natural
    // spacing for the ~1 req/sec MusicBrainz rate limit.
    let metadata;
    try {
      metadata = await fetchReleaseGroupDetail(chosen.mbid);
    } catch (error) {
      new Notice(`MusicBrainz search failed: ${messageOf(error)}`);
      return;
    }

    // Step 6 — cover art (failures are non-blocking, handled within).
    let coverPath: string | null = null;
    if (this.settings.downloadCover) {
      coverPath = await downloadCoverArt(
        metadata.mbid,
        metadata.artistCredit,
        metadata.album,
        normalizePath(this.settings.coverFolder),
        this.vaultWriter(),
      );
    }

    // Step 7 — write output.
    const fields = buildManagedFields(
      {
        metadata,
        sourceUrl: urlInfo?.sourceUrl ?? null,
        platform: urlInfo?.platform ?? null,
        coverPath,
        dateAdded: todayIso(),
      },
      keys,
    );

    const original = editor.getValue();
    let merged: string;
    try {
      merged = mergeFrontmatter(original, fields);
    } catch (error) {
      if (error instanceof FrontmatterParseError) {
        new Notice("Could not parse existing frontmatter.");
        return;
      }
      throw error;
    }

    editor.setValue(coverPath ? setCoverEmbed(merged, coverPath) : merged);
    new Notice(`✅ ${metadata.artistCredit} — ${metadata.album}`);
  }

  private vaultWriter(): VaultFileWriter {
    const adapter = this.app.vault.adapter;
    return {
      ensureFolder: async (folder) => {
        if (!(await adapter.exists(folder))) await adapter.mkdir(folder);
      },
      writeBinary: async (path, data) => {
        await adapter.writeBinary(path, data);
      },
    };
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
