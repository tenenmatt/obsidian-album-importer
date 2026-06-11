import { describe, it, expect } from "vitest";
import { buildManagedFields } from "../src/build-fields";
import { DEFAULT_SETTINGS } from "../src/settings";
import type { AlbumMetadata } from "../src/musicbrainz";

const keys = DEFAULT_SETTINGS.fieldKeys;

const fullMetadata: AlbumMetadata = {
  mbid: "rg-1",
  album: "Origami Harvest",
  artists: ["Ambrose Akinmusire"],
  artistCredit: "Ambrose Akinmusire",
  year: 2017,
  label: "Blue Note Records",
  genre: "Jazz",
  edition: "Deluxe Edition",
};

describe("buildManagedFields", () => {
  it("writes every field when all data and a URL and cover are present", () => {
    const result = buildManagedFields(
      {
        metadata: fullMetadata,
        sourceUrl: "https://open.qobuz.com/album/abc",
        platform: "qobuz",
        coverPath: "album-covers/Ambrose Akinmusire - Origami Harvest.jpg",
        dateAdded: "2026-06-10",
      },
      keys,
    );
    expect(result).toEqual({
      album: "Origami Harvest",
      artist: ["Ambrose Akinmusire"],
      year: 2017,
      label: "Blue Note Records",
      genre: "Jazz",
      edition: "Deluxe Edition",
      cover: "album-covers/Ambrose Akinmusire - Origami Harvest.jpg",
      source_url: "https://open.qobuz.com/album/abc",
      platform: "qobuz",
      date_added: "2026-06-10",
    });
  });

  it("omits optional fields that are absent (no empty strings written)", () => {
    const result = buildManagedFields(
      {
        metadata: {
          ...fullMetadata,
          year: null,
          label: null,
          genre: null,
          edition: null,
        },
        sourceUrl: null,
        platform: null,
        coverPath: null,
        dateAdded: "2026-06-10",
      },
      keys,
    );
    expect(result).toEqual({
      album: "Origami Harvest",
      artist: ["Ambrose Akinmusire"],
      date_added: "2026-06-10",
    });
    expect(result).not.toHaveProperty("year");
    expect(result).not.toHaveProperty("source_url");
    expect(result).not.toHaveProperty("cover");
  });

  it("honours configured key names", () => {
    const result = buildManagedFields(
      {
        metadata: { ...fullMetadata, label: null, genre: null, edition: null },
        sourceUrl: null,
        platform: null,
        coverPath: null,
        dateAdded: "2026-06-10",
      },
      { ...keys, album: "title", artist: "performers", dateAdded: "imported" },
    );
    expect(result.title).toBe("Origami Harvest");
    expect(result.performers).toEqual(["Ambrose Akinmusire"]);
    expect(result.imported).toBe("2026-06-10");
    expect(result).not.toHaveProperty("album");
  });
});
