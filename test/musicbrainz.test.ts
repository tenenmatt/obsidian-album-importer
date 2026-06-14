import { describe, it, expect, vi, beforeEach } from "vitest";
import { requestUrl } from "obsidian";
import {
  parseSearchResults,
  pickCanonicalRelease,
  pickGenre,
  pickLabel,
  mapReleaseGroupDetail,
  searchReleaseGroups,
  fetchReleaseGroupDetail,
  musicBrainzProvider,
  USER_AGENT,
} from "../src/musicbrainz";

vi.mock("obsidian");

describe("parseSearchResults", () => {
  it("maps id, title, artist credit, and year", () => {
    const json = {
      "release-groups": [
        {
          id: "mbid-1",
          title: "Origami Harvest",
          "first-release-date": "2017-10-13",
          disambiguation: "",
          "artist-credit": [
            { name: "Ambrose Akinmusire", joinphrase: " & " },
            { name: "Kool A.D.", joinphrase: "" },
          ],
        },
      ],
    };
    expect(parseSearchResults(json)).toEqual([
      {
        id: "mbid-1",
        title: "Origami Harvest",
        artistCredit: "Ambrose Akinmusire & Kool A.D.",
        year: 2017,
      },
    ]);
  });

  it("yields null year when the date is absent", () => {
    const json = {
      "release-groups": [
        {
          id: "m",
          title: "T",
          "artist-credit": [{ name: "A", joinphrase: "" }],
        },
      ],
    };
    expect(parseSearchResults(json)[0].year).toBeNull();
  });

  it("falls back to artist.name and returns [] when there are no release groups", () => {
    const json = {
      "release-groups": [
        { id: "m", title: "T", "artist-credit": [{ artist: { name: "Nested" } }] },
      ],
    };
    expect(parseSearchResults(json)[0].artistCredit).toBe("Nested");
    expect(parseSearchResults({})).toEqual([]);
    expect(parseSearchResults(null)).toEqual([]);
  });

  it("drops nameless credit entries, defaults missing id/title, and yields null year for a non-year date", () => {
    const json = {
      "release-groups": [{ "first-release-date": "", "artist-credit": [{}] }],
    };
    const [r] = parseSearchResults(json);
    expect(r.id).toBe("");
    expect(r.title).toBe("");
    expect(r.artistCredit).toBe("");
    expect(r.year).toBeNull();
  });
});

describe("pickCanonicalRelease", () => {
  it("returns the earliest Official release", () => {
    const releases = [
      { id: "c", date: "2018-01-01", status: "Official" },
      { id: "a", date: "2017-10-13", status: "Official" },
      { id: "b", date: "2016-01-01", status: "Promotion" },
    ];
    expect(pickCanonicalRelease(releases)?.id).toBe("a");
  });

  it("orders partial dates and sorts undated releases last", () => {
    const releases = [
      { id: "undated", status: "Official" },
      { id: "year-only", date: "2017", status: "Official" },
      { id: "full", date: "2017-03-02", status: "Official" },
    ];
    expect(pickCanonicalRelease(releases)?.id).toBe("year-only");
  });

  it("returns null when there are no Official releases or the list is empty", () => {
    expect(pickCanonicalRelease([{ id: "x", date: "2017", status: "Bootleg" }])).toBeNull();
    expect(pickCanonicalRelease([])).toBeNull();
  });

  it("treats two undated officials as equal (stable, no throw)", () => {
    const result = pickCanonicalRelease([
      { id: "p", status: "Official" },
      { id: "q", status: "Official" },
    ]);
    expect(["p", "q"]).toContain(result?.id);
  });
});

describe("pickGenre", () => {
  it("returns the highest-count genre name", () => {
    const genres = [
      { name: "hip hop", count: 2 },
      { name: "jazz", count: 9 },
    ];
    expect(pickGenre(genres)).toBe("jazz");
  });

  it("treats a missing count as zero when ranking", () => {
    expect(
      pickGenre([{ name: "ambient" }, { name: "noise" }, { name: "jazz", count: 3 }]),
    ).toBe("jazz");
  });

  it("returns null when genres are absent or empty", () => {
    expect(pickGenre([])).toBeNull();
    expect(pickGenre(undefined)).toBeNull();
  });
});

describe("pickLabel", () => {
  // Built and tested now; the detail request does not yet request `inc=labels`,
  // so this returns null in practice until that one-line upgrade is made.
  it("returns the first label name from label-info", () => {
    const release = {
      "label-info": [{ label: { name: "Blue Note Records" } }],
    };
    expect(pickLabel(release)).toBe("Blue Note Records");
  });

  it("returns null when there is no label-info", () => {
    expect(pickLabel({})).toBeNull();
    expect(pickLabel({ "label-info": [{}] })).toBeNull();
  });
});

describe("mapReleaseGroupDetail", () => {
  const detail = {
    id: "rg-1",
    title: "Origami Harvest",
    "first-release-date": "2017-10-13",
    disambiguation: "",
    "artist-credit": [{ name: "Ambrose Akinmusire", joinphrase: "" }],
    genres: [{ name: "jazz", count: 5 }],
    releases: [
      {
        id: "rel-1",
        date: "2017-10-13",
        status: "Official",
        disambiguation: "Deluxe Edition",
      },
    ],
  };

  it("derives album metadata from the canonical release", () => {
    expect(mapReleaseGroupDetail(detail)).toEqual({
      album: "Origami Harvest",
      artists: ["Ambrose Akinmusire"],
      artistCredit: "Ambrose Akinmusire",
      year: 2017,
      label: null, // request is unwired; canonical release carries no label-info
      genre: "jazz",
      edition: "Deluxe Edition",
      coverArtUrl: "https://coverartarchive.org/release-group/rg-1/front",
    });
  });

  it("prefers a release-group disambiguation when the release has none", () => {
    const d = {
      ...detail,
      disambiguation: "Mono",
      releases: [{ id: "r", date: "2017", status: "Official" }],
    };
    expect(mapReleaseGroupDetail(d).edition).toBe("Mono");
  });

  it("reads artist names from nested credits and drops nameless entries", () => {
    const d = {
      ...detail,
      "artist-credit": [{ artist: { name: "Nested" } }, {}],
    };
    expect(mapReleaseGroupDetail(d).artists).toEqual(["Nested"]);
  });

  it("falls back to first-release-date when there is no canonical release", () => {
    const d = { ...detail, releases: [{ id: "r", status: "Bootleg" }] };
    const meta = mapReleaseGroupDetail(d);
    expect(meta.year).toBe(2017);
    expect(meta.edition).toBeNull();
  });

  it("returns empty defaults (and a null cover) for a null/empty detail", () => {
    expect(mapReleaseGroupDetail(null)).toEqual({
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
});

describe("HTTP", () => {
  beforeEach(() => {
    vi.mocked(requestUrl).mockReset();
  });

  it("searchReleaseGroups requests the right URL with a descriptive User-Agent", async () => {
    vi.mocked(requestUrl).mockResolvedValue({
      json: { "release-groups": [] },
    } as never);

    await searchReleaseGroups("Origami Harvest Akinmusire");

    expect(requestUrl).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(requestUrl).mock.calls[0][0] as {
      url: string;
      headers: Record<string, string>;
    };
    expect(arg.url).toBe(
      "https://musicbrainz.org/ws/2/release-group?query=Origami%20Harvest%20Akinmusire&type=album&fmt=json&limit=10",
    );
    expect(arg.headers["User-Agent"]).toBe(USER_AGENT);
  });

  it("fetchReleaseGroupDetail requests the detail endpoint and maps the result", async () => {
    vi.mocked(requestUrl).mockResolvedValue({
      json: {
        id: "rg-1",
        title: "Origami Harvest",
        "first-release-date": "2017",
        "artist-credit": [{ name: "A", joinphrase: "" }],
        releases: [{ id: "r", date: "2017", status: "Official" }],
      },
    } as never);

    const meta = await fetchReleaseGroupDetail("rg-1");

    const arg = vi.mocked(requestUrl).mock.calls[0][0] as { url: string };
    expect(arg.url).toBe(
      "https://musicbrainz.org/ws/2/release-group/rg-1?inc=artists+releases+genres&fmt=json",
    );
    expect(meta.album).toBe("Origami Harvest");
    expect(meta.year).toBe(2017);
  });
});

describe("musicBrainzProvider", () => {
  beforeEach(() => {
    vi.mocked(requestUrl).mockReset();
  });

  it("is named and delegates search + fetchDetail to the HTTP endpoints", async () => {
    expect(musicBrainzProvider.name).toBe("MusicBrainz");

    vi.mocked(requestUrl).mockResolvedValue({
      json: { "release-groups": [], id: "rg-9", title: "Detail" },
    } as never);

    await musicBrainzProvider.search("terms");
    const searchArg = vi.mocked(requestUrl).mock.calls[0][0] as { url: string };
    expect(searchArg.url).toContain("/release-group?query=terms");

    const meta = await musicBrainzProvider.fetchDetail({
      id: "rg-9",
      title: "Detail",
      artistCredit: "A",
      year: null,
    });
    const detailArg = vi.mocked(requestUrl).mock.calls[1][0] as { url: string };
    expect(detailArg.url).toContain("/release-group/rg-9?");
    expect(meta.album).toBe("Detail");
  });
});
