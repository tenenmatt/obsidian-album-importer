import { describe, it, expect, vi, beforeEach } from "vitest";
import { requestUrl } from "obsidian";
import {
  parseSearchResults,
  mapAlbumDetail,
  upscaleArtwork,
  searchAlbums,
  fetchAlbumDetail,
  appleMusicProvider,
} from "../src/apple-music";

vi.mock("obsidian");

const collection = {
  collectionId: 123,
  collectionName: "Origami Harvest",
  artistName: "Ambrose Akinmusire",
  releaseDate: "2017-10-13T07:00:00Z",
  primaryGenreName: "Jazz",
  artworkUrl100: "https://is1.mzstatic.com/image/thumb/abc/100x100bb.jpg",
};

describe("parseSearchResults", () => {
  it("maps collectionId, name, artist, and year", () => {
    expect(parseSearchResults({ results: [collection] })).toEqual([
      {
        id: "123",
        title: "Origami Harvest",
        artistCredit: "Ambrose Akinmusire",
        year: 2017,
      },
    ]);
  });

  it("defaults missing fields and returns [] without a results array", () => {
    const [r] = parseSearchResults({ results: [{}] });
    expect(r).toEqual({ id: "", title: "", artistCredit: "", year: null });
    expect(parseSearchResults({})).toEqual([]);
    expect(parseSearchResults(null)).toEqual([]);
  });
});

describe("mapAlbumDetail", () => {
  it("maps the first collection record to album metadata", () => {
    expect(mapAlbumDetail({ results: [collection] })).toEqual({
      album: "Origami Harvest",
      artists: ["Ambrose Akinmusire"],
      artistCredit: "Ambrose Akinmusire",
      year: 2017,
      label: null,
      genre: "Jazz",
      edition: null,
      coverArtUrl: "https://is1.mzstatic.com/image/thumb/abc/1000x1000bb.jpg",
    });
  });

  it("yields empty defaults (and no artist) when the record is missing", () => {
    expect(mapAlbumDetail(null)).toEqual({
      album: "",
      artists: [],
      artistCredit: "",
      year: null,
      label: null,
      genre: null,
      edition: null,
      coverArtUrl: null,
    });
  });

  it("treats a blank artist name as no artist", () => {
    expect(mapAlbumDetail({ results: [{ artistName: "   " }] }).artists).toEqual([]);
  });
});

describe("upscaleArtwork", () => {
  it("swaps the dimension token for a larger size", () => {
    expect(upscaleArtwork("https://x/100x100bb.jpg")).toBe("https://x/1000x1000bb.jpg");
    expect(upscaleArtwork("https://x/60x60bb.png")).toBe("https://x/1000x1000bb.png");
  });

  it("returns null for a missing or empty URL", () => {
    expect(upscaleArtwork(undefined)).toBeNull();
    expect(upscaleArtwork("   ")).toBeNull();
  });

  it("leaves a URL without the expected token unchanged", () => {
    expect(upscaleArtwork("https://x/cover.jpg")).toBe("https://x/cover.jpg");
  });
});

describe("HTTP", () => {
  beforeEach(() => {
    vi.mocked(requestUrl).mockReset();
  });

  it("searchAlbums requests the search endpoint", async () => {
    vi.mocked(requestUrl).mockResolvedValue({ json: { results: [] } } as never);

    await searchAlbums("Origami Harvest");

    const arg = vi.mocked(requestUrl).mock.calls[0][0] as { url: string };
    expect(arg.url).toBe(
      "https://itunes.apple.com/search?term=Origami%20Harvest&entity=album&limit=10",
    );
  });

  it("fetchAlbumDetail requests the lookup endpoint and maps the result", async () => {
    vi.mocked(requestUrl).mockResolvedValue({ json: { results: [collection] } } as never);

    const meta = await fetchAlbumDetail("123");

    const arg = vi.mocked(requestUrl).mock.calls[0][0] as { url: string };
    expect(arg.url).toBe("https://itunes.apple.com/lookup?id=123&entity=album");
    expect(meta.album).toBe("Origami Harvest");
    expect(meta.genre).toBe("Jazz");
  });
});

describe("appleMusicProvider", () => {
  beforeEach(() => {
    vi.mocked(requestUrl).mockReset();
  });

  it("is named and delegates search + fetchDetail", async () => {
    expect(appleMusicProvider.name).toBe("Apple Music");

    vi.mocked(requestUrl).mockResolvedValue({ json: { results: [collection] } } as never);

    await appleMusicProvider.search("terms");
    const searchArg = vi.mocked(requestUrl).mock.calls[0][0] as { url: string };
    expect(searchArg.url).toContain("/search?term=terms");

    const meta = await appleMusicProvider.fetchDetail({
      id: "123",
      title: "Origami Harvest",
      artistCredit: "Ambrose Akinmusire",
      year: 2017,
    });
    const detailArg = vi.mocked(requestUrl).mock.calls[1][0] as { url: string };
    expect(detailArg.url).toContain("/lookup?id=123");
    expect(meta.album).toBe("Origami Harvest");
  });
});
