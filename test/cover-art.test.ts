import { describe, it, expect, vi, beforeEach } from "vitest";
import { requestUrl } from "obsidian";
import { sanitizeFilename, downloadCoverArt, type VaultFileWriter } from "../src/cover-art";

vi.mock("obsidian");

describe("sanitizeFilename", () => {
  it("composes '{Artist} - {Album}.jpg', preserving spaces and hyphens", () => {
    expect(sanitizeFilename("Ambrose Akinmusire", "Origami Harvest")).toBe(
      "Ambrose Akinmusire - Origami Harvest.jpg",
    );
  });

  it("replaces filesystem-unsafe characters with underscores", () => {
    expect(sanitizeFilename("AC/DC", 'Hell: Yes? "Live"')).toBe(
      "AC_DC - Hell_ Yes_ _Live_.jpg",
    );
  });

  it("trims surrounding whitespace from the result", () => {
    expect(sanitizeFilename("  A  ", "  B  ")).toBe("A - B.jpg");
  });
});

describe("downloadCoverArt", () => {
  let vault: VaultFileWriter & {
    ensureFolder: ReturnType<typeof vi.fn>;
    writeBinary: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.mocked(requestUrl).mockReset();
    vault = {
      ensureFolder: vi.fn().mockResolvedValue(undefined),
      writeBinary: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("downloads from the given URL and saves under the configured folder", async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    vi.mocked(requestUrl).mockResolvedValue({ arrayBuffer: bytes } as never);

    const path = await downloadCoverArt(
      "https://coverartarchive.org/release-group/rg-1/front",
      "Ambrose Akinmusire",
      "Origami Harvest",
      "album-covers",
      vault,
    );

    expect(path).toBe("album-covers/Ambrose Akinmusire - Origami Harvest.jpg");
    const arg = vi.mocked(requestUrl).mock.calls[0][0] as { url: string };
    expect(arg.url).toBe("https://coverartarchive.org/release-group/rg-1/front");
    expect(vault.ensureFolder).toHaveBeenCalledWith("album-covers");
    expect(vault.writeBinary).toHaveBeenCalledWith(
      "album-covers/Ambrose Akinmusire - Origami Harvest.jpg",
      bytes,
    );
  });

  it("returns null without requesting when no cover URL is available", async () => {
    expect(await downloadCoverArt(null, "A", "B", "album-covers", vault)).toBeNull();
    expect(await downloadCoverArt("  ", "A", "B", "album-covers", vault)).toBeNull();
    expect(requestUrl).not.toHaveBeenCalled();
    expect(vault.writeBinary).not.toHaveBeenCalled();
  });

  it("returns null and warns (no write) when the request fails / 404", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(requestUrl).mockRejectedValue(new Error("404"));

    const path = await downloadCoverArt("https://example.com/cover.jpg", "A", "B", "album-covers", vault);

    expect(path).toBeNull();
    expect(vault.writeBinary).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns null and warns when saving to the vault fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(requestUrl).mockResolvedValue({ arrayBuffer: new ArrayBuffer(1) } as never);
    vault.writeBinary.mockRejectedValue(new Error("disk full"));

    const path = await downloadCoverArt("https://example.com/cover.jpg", "A", "B", "album-covers", vault);

    expect(path).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
