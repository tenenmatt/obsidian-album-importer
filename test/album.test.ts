import { describe, it, expect } from "vitest";
import { formatResultLine, parseYear } from "../src/album";

describe("formatResultLine", () => {
  it("renders title, artist, and year", () => {
    expect(
      formatResultLine({
        id: "m",
        title: "Origami Harvest",
        artistCredit: "Ambrose Akinmusire",
        year: 2017,
      }),
    ).toBe("Origami Harvest — Ambrose Akinmusire (2017)");
  });

  it("omits the year when unknown", () => {
    expect(formatResultLine({ id: "m", title: "T", artistCredit: "A", year: null })).toBe(
      "T — A",
    );
  });
});

describe("parseYear", () => {
  it("extracts a 4-digit leading year, else null", () => {
    expect(parseYear("2017-10-13")).toBe(2017);
    expect(parseYear("2017")).toBe(2017);
    expect(parseYear("")).toBeNull();
    expect(parseYear(undefined)).toBeNull();
    expect(parseYear(2017)).toBeNull();
  });
});
