import { describe, it, expect } from "vitest";
import {
  mergeFrontmatter,
  setCoverEmbed,
  FrontmatterParseError,
} from "../src/frontmatter";

describe("mergeFrontmatter", () => {
  it("overwrites an existing managed scalar and leaves other keys untouched", () => {
    const input = ["---", 'album: "Old Title"', "rating: 5", "---", "Body text."].join("\n");
    const result = mergeFrontmatter(input, { album: "Origami Harvest" });
    expect(result).toBe(
      ["---", 'album: "Origami Harvest"', "rating: 5", "---", "Body text."].join("\n"),
    );
  });

  it("preserves comments and blank lines within the frontmatter", () => {
    const input = [
      "---",
      "# my notes",
      'album: "Old"',
      "",
      "rating: 5",
      "---",
      "Body.",
    ].join("\n");
    const result = mergeFrontmatter(input, { album: "New" });
    expect(result).toBe(
      ["---", "# my notes", 'album: "New"', "", "rating: 5", "---", "Body."].join("\n"),
    );
  });

  it("appends a managed key that does not already exist", () => {
    const input = ["---", "rating: 5", "---", "Body."].join("\n");
    const result = mergeFrontmatter(input, { album: "New", year: 2017 });
    expect(result).toBe(
      ["---", "rating: 5", 'album: "New"', "year: 2017", "---", "Body."].join("\n"),
    );
  });

  it("writes a string array as a YAML block list", () => {
    const input = ["---", "rating: 5", "---", "Body."].join("\n");
    const result = mergeFrontmatter(input, { artist: ["Ambrose Akinmusire"] });
    expect(result).toBe(
      ["---", "rating: 5", "artist:", "  - Ambrose Akinmusire", "---", "Body."].join("\n"),
    );
  });

  it("replaces an existing multi-line list value entirely", () => {
    const input = [
      "---",
      "artist:",
      "  - Old One",
      "  - Old Two",
      "year: 1999",
      "---",
      "Body.",
    ].join("\n");
    const result = mergeFrontmatter(input, { artist: ["New Artist"] });
    expect(result).toBe(
      ["---", "artist:", "  - New Artist", "year: 1999", "---", "Body."].join("\n"),
    );
  });

  it("writes numbers bare and strings quoted", () => {
    const input = ["---", "---", ""].join("\n");
    const result = mergeFrontmatter(input, {
      year: 2017,
      label: "Blue Note Records",
    });
    expect(result).toBe(
      ["---", "year: 2017", 'label: "Blue Note Records"', "---", ""].join("\n"),
    );
  });

  it("quotes list items only when needed", () => {
    const input = ["---", "---", ""].join("\n");
    const result = mergeFrontmatter(input, {
      artist: ["Ambrose Akinmusire", "Group: The Band"],
    });
    expect(result).toBe(
      [
        "---",
        "artist:",
        "  - Ambrose Akinmusire",
        '  - "Group: The Band"',
        "---",
        "",
      ].join("\n"),
    );
  });

  it("escapes embedded quotes and backslashes in scalars", () => {
    const input = ["---", "---", ""].join("\n");
    const result = mergeFrontmatter(input, { album: 'He said "hi" \\ bye' });
    expect(result).toBe(["---", 'album: "He said \\"hi\\" \\\\ bye"', "---", ""].join("\n"));
  });

  it("preserves the note body exactly, including trailing content", () => {
    const body = "First line.\n\n## Heading\n\nMore text.\n";
    const input = `---\nalbum: "Old"\n---\n${body}`;
    const result = mergeFrontmatter(input, { album: "New" });
    expect(result).toBe(`---\nalbum: "New"\n---\n${body}`);
  });

  it("creates a frontmatter block when the note has none", () => {
    const input = "Just body text, no frontmatter.\n";
    const result = mergeFrontmatter(input, { album: "New", year: 2017 });
    expect(result).toBe(
      ["---", 'album: "New"', "year: 2017", "---", "Just body text, no frontmatter.\n"].join(
        "\n",
      ),
    );
  });

  it("creates a frontmatter block for empty content", () => {
    const result = mergeFrontmatter("", { album: "New" });
    expect(result).toBe(["---", 'album: "New"', "---", ""].join("\n"));
  });

  it("throws FrontmatterParseError when the block is unterminated", () => {
    const input = "---\nalbum: Old\nno closing delimiter\n";
    expect(() => mergeFrontmatter(input, { album: "New" })).toThrow(FrontmatterParseError);
  });
});

describe("setCoverEmbed", () => {
  it("prepends an embed immediately after the frontmatter", () => {
    const input = ["---", 'album: "X"', "---", "Body text."].join("\n");
    const result = setCoverEmbed(input, "album-covers/X.jpg");
    expect(result).toBe(
      ["---", 'album: "X"', "---", "![[album-covers/X.jpg]]", "", "Body text."].join("\n"),
    );
  });

  it("replaces an existing leading embed rather than duplicating", () => {
    const input = [
      "---",
      'album: "X"',
      "---",
      "![[album-covers/old.jpg]]",
      "",
      "Body text.",
    ].join("\n");
    const result = setCoverEmbed(input, "album-covers/new.jpg");
    expect(result).toBe(
      ["---", 'album: "X"', "---", "![[album-covers/new.jpg]]", "", "Body text."].join("\n"),
    );
  });

  it("replaces an existing embed even when preceded by blank lines", () => {
    const input = ["---", 'album: "X"', "---", "", "![[old.jpg]]", "rest"].join("\n");
    const result = setCoverEmbed(input, "new.jpg");
    expect(result).toBe(["---", 'album: "X"', "---", "", "![[new.jpg]]", "rest"].join("\n"));
  });

  it("prepends when the body is empty", () => {
    const input = ["---", 'album: "X"', "---", ""].join("\n");
    const result = setCoverEmbed(input, "cover.jpg");
    expect(result).toBe(["---", 'album: "X"', "---", "![[cover.jpg]]", "", ""].join("\n"));
  });

  it("prepends at the top when there is no frontmatter", () => {
    const input = "Body only.";
    const result = setCoverEmbed(input, "cover.jpg");
    expect(result).toBe(["![[cover.jpg]]", "", "Body only."].join("\n"));
  });
});
