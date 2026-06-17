import { describe, it, expect } from "vitest";
import { buildSearchTerms, primaryArtist } from "../src/search-terms";

describe("primaryArtist", () => {
  it("returns a plain string value trimmed", () => {
    expect(primaryArtist("  Ambrose Akinmusire ")).toBe("Ambrose Akinmusire");
  });

  it("returns the first element of a YAML list", () => {
    expect(primaryArtist(["Ambrose Akinmusire", "Kool A.D."])).toBe("Ambrose Akinmusire");
  });

  it("skips empty leading list entries", () => {
    expect(primaryArtist(["", "  ", "Real Name"])).toBe("Real Name");
  });

  it("returns null for an empty string", () => {
    expect(primaryArtist("   ")).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(primaryArtist([])).toBeNull();
  });

  it("returns null for null/undefined/non-string values", () => {
    expect(primaryArtist(null)).toBeNull();
    expect(primaryArtist(undefined)).toBeNull();
    expect(primaryArtist(42)).toBeNull();
    expect(primaryArtist([{ name: "x" }])).toBeNull();
  });
});

describe("buildSearchTerms", () => {
  it("combines album and artist when both are known (full artist name)", () => {
    // NOTE: spec example shows "Origami Harvest Akinmusire" (last name only);
    // treated as a typo — we use the full frontmatter artist value.
    expect(
      buildSearchTerms({
        album: "Origami Harvest",
        artist: "Ambrose Akinmusire",
        urlHint: null,
      }),
    ).toBe("Origami Harvest Ambrose Akinmusire");
  });

  it("uses the album alone when only album is known", () => {
    expect(buildSearchTerms({ album: "Origami Harvest", artist: null, urlHint: null })).toBe(
      "Origami Harvest",
    );
  });

  it("uses the URL hint when only a hint is available", () => {
    expect(
      buildSearchTerms({ album: null, artist: null, urlHint: "origami harvest" }),
    ).toBe("origami harvest");
  });

  it("returns an empty string when nothing is known", () => {
    expect(buildSearchTerms({ album: null, artist: null, urlHint: null })).toBe("");
  });

  it("prefers a frontmatter album over a URL hint (precedence)", () => {
    expect(
      buildSearchTerms({
        album: "Origami Harvest",
        artist: null,
        urlHint: "some other hint",
      }),
    ).toBe("Origami Harvest");
  });

  it("falls back to the URL hint as the title when album is absent but artist is known", () => {
    // Default for an album-absent/artist-present case (not enumerated in spec):
    // use the hint as the title term and append the known artist.
    expect(
      buildSearchTerms({ album: null, artist: "Ambrose Akinmusire", urlHint: "origami harvest" }),
    ).toBe("origami harvest Ambrose Akinmusire");
  });

  it("returns the artist alone when only artist is known", () => {
    expect(buildSearchTerms({ album: null, artist: "Ambrose Akinmusire", urlHint: null })).toBe(
      "Ambrose Akinmusire",
    );
  });

  it("treats whitespace-only fields as absent", () => {
    expect(buildSearchTerms({ album: "  ", artist: "  ", urlHint: "  " })).toBe("");
  });
});
