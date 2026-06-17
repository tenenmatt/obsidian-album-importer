import { describe, it, expect } from "vitest";
import { parseSelectionUrl } from "../src/platform";

describe("parseSelectionUrl", () => {
  describe("Qobuz", () => {
    it("extracts platform and hint from a full www.qobuz.com album URL", () => {
      const result = parseSelectionUrl(
        "https://www.qobuz.com/us-en/album/origami-harvest-ambrose-akinmusire/jznzokc14slkc",
      );
      expect(result).toEqual({
        sourceUrl:
          "https://www.qobuz.com/us-en/album/origami-harvest-ambrose-akinmusire/jznzokc14slkc",
        platform: "qobuz",
        hint: "origami harvest ambrose akinmusire",
      });
    });

    it("returns no hint for an open.qobuz.com short URL (opaque id)", () => {
      const result = parseSelectionUrl("https://open.qobuz.com/album/jznzokc14slkc");
      expect(result).toEqual({
        sourceUrl: "https://open.qobuz.com/album/jznzokc14slkc",
        platform: "qobuz",
        hint: null,
      });
    });

    it("recognises a bare qobuz.com host without an album slug", () => {
      const result = parseSelectionUrl("https://qobuz.com/");
      expect(result).toEqual({
        sourceUrl: "https://qobuz.com/",
        platform: "qobuz",
        hint: null,
      });
    });
  });

  describe("Apple Music", () => {
    it("extracts platform and hint from a music.apple.com album URL", () => {
      const result = parseSelectionUrl(
        "https://music.apple.com/us/album/origami-harvest/1639612087",
      );
      expect(result).toEqual({
        sourceUrl: "https://music.apple.com/us/album/origami-harvest/1639612087",
        platform: "apple_music",
        hint: "origami harvest",
      });
    });

    it("returns no hint when there is no album slug segment", () => {
      const result = parseSelectionUrl("https://music.apple.com/us/browse");
      expect(result).toEqual({
        sourceUrl: "https://music.apple.com/us/browse",
        platform: "apple_music",
        hint: null,
      });
    });

    it("returns no hint when the slug collapses to empty (all hyphens)", () => {
      const result = parseSelectionUrl("https://music.apple.com/us/album/---/123");
      expect(result?.platform).toBe("apple_music");
      expect(result?.hint).toBeNull();
    });
  });

  describe("non-matching input", () => {
    it("returns null for an unrelated URL", () => {
      expect(parseSelectionUrl("https://example.com/album/foo")).toBeNull();
    });

    it("returns null for non-URL text", () => {
      expect(parseSelectionUrl("just some selected words")).toBeNull();
    });

    it("returns null for empty/whitespace selection", () => {
      expect(parseSelectionUrl("   ")).toBeNull();
    });

    it("trims surrounding whitespace before parsing", () => {
      const result = parseSelectionUrl("  https://qobuz.com/  ");
      expect(result?.platform).toBe("qobuz");
      expect(result?.sourceUrl).toBe("https://qobuz.com/");
    });
  });
});
