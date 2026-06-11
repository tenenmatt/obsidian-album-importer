import { App, PluginSettingTab, Setting } from "obsidian";
import type AlbumImporterPlugin from "./main";

/** The configured YAML key name used for each managed field. */
export interface FieldKeys {
  album: string;
  artist: string;
  year: string;
  label: string;
  genre: string;
  edition: string;
  cover: string;
  sourceUrl: string;
  platform: string;
  dateAdded: string;
}

export interface PluginSettings {
  fieldKeys: FieldKeys;
  downloadCover: boolean;
  coverFolder: string;
}

export const DEFAULT_SETTINGS: PluginSettings = {
  fieldKeys: {
    album: "album",
    artist: "artist",
    year: "year",
    label: "label",
    genre: "genre",
    edition: "edition",
    cover: "cover",
    sourceUrl: "source_url",
    platform: "platform",
    dateAdded: "date_added",
  },
  downloadCover: true,
  coverFolder: "album-covers",
};

const FIELD_LABELS: Array<{ key: keyof FieldKeys; name: string }> = [
  { key: "album", name: "Album title" },
  { key: "artist", name: "Artist" },
  { key: "year", name: "Year" },
  { key: "label", name: "Label" },
  { key: "genre", name: "Genre" },
  { key: "edition", name: "Edition" },
  { key: "cover", name: "Cover art path" },
  { key: "sourceUrl", name: "Source URL" },
  { key: "platform", name: "Source platform" },
  { key: "dateAdded", name: "Date imported" },
];

export class AlbumImporterSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: AlbumImporterPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Frontmatter field names" });
    for (const { key, name } of FIELD_LABELS) {
      new Setting(containerEl).setName(name).addText((text) =>
        text.setValue(this.plugin.settings.fieldKeys[key]).onChange(async (value) => {
          this.plugin.settings.fieldKeys[key] = value.trim() || DEFAULT_SETTINGS.fieldKeys[key];
          await this.plugin.saveSettings();
        }),
      );
    }

    containerEl.createEl("h2", { text: "Cover art" });
    new Setting(containerEl)
      .setName("Download cover art")
      .setDesc("Download front cover from the Cover Art Archive and embed it.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.downloadCover).onChange(async (value) => {
          this.plugin.settings.downloadCover = value;
          await this.plugin.saveSettings();
        }),
      );
    new Setting(containerEl)
      .setName("Cover art folder")
      .setDesc("Vault-relative folder where cover images are saved.")
      .addText((text) =>
        text.setValue(this.plugin.settings.coverFolder).onChange(async (value) => {
          this.plugin.settings.coverFolder = value.trim() || DEFAULT_SETTINGS.coverFolder;
          await this.plugin.saveSettings();
        }),
      );
  }
}
