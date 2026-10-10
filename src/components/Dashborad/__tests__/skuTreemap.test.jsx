import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { fitLabel, treemapPalette } from "../helpers";
import { SkuTile } from "../SkuTreemap";

// WCAG relative luminance and contrast ratio of two #rrggbb colours
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("SKU revenue map: tile ink", () => {
  it("every tile's text reads on its fill, in both themes (WCAG AA, 4.5:1)", () => {
    for (const theme of ["light", "dark"]) {
      for (const tile of treemapPalette(theme)) {
        expect(contrast(tile.solid, tile.text), `${theme} ${tile.fill}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("light tiles take dark text (white on #d6d3d1 was the unreadable one)", () => {
    const light = treemapPalette("light").find((t) => t.fill === "#d6d3d1");
    expect(light.text).toBe("#171717");
    const night = treemapPalette("dark").find((t) => t.fill === "var(--chart-1)");
    expect(night.text).toBe("#171717");
  });
});

describe("SKU revenue map: fitLabel", () => {
  it("keeps a name that fits on one line, whole", () => {
    expect(fitLabel("Pure Ghee", 200)).toEqual(["Pure Ghee"]);
  });

  it("wraps on word boundaries instead of running past the tile", () => {
    // 12px text: 7.2px a glyph, so 130px holds 18 characters
    expect(fitLabel("Black Tea CTC - 400g x 24 Pack", 130, { maxLines: 3 })).toEqual(["Black Tea CTC -", "400g x 24 Pack"]);
  });

  it("ends the last line with an ellipsis when words are left over, and never exceeds the line count", () => {
    const lines = fitLabel("White Long Grain Basmati Rice - 5kg Bag", 110, { maxLines: 2 });
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith("…")).toBe(true);
    expect(lines.every((l) => l.length <= Math.floor(110 / 7.2))).toBe(true);
  });

  it("shortens a single word wider than the tile rather than overflowing", () => {
    const [line] = fitLabel("Supercalifragilisticexpialidocious", 100, { maxLines: 1 });
    expect(line.endsWith("…")).toBe(true);
    expect(line.length).toBeLessThanOrEqual(Math.floor(100 / 7.2));
  });

  it("says nothing for a tile too narrow to hold a word", () => {
    expect(fitLabel("Sunflower Oil", 30)).toEqual([]);
    expect(fitLabel("", 300)).toEqual([]);
    expect(fitLabel(undefined, 300)).toEqual([]);
  });
});

describe("SKU revenue map: tile", () => {
  const tile = (props) => {
    const { container } = render(
      <svg>
        <SkuTile x={0} y={0} width={220} height={120} depth={1} name="Sunflower Oil - 1.5L x 6 Carton" size={12500} share={0.31} fill="var(--chart-1)" textColour="#fafafa" {...props} />
      </svg>
    );
    return container;
  };

  it("draws the name and the amount on a tile with room", () => {
    const c = tile();
    const texts = [...c.querySelectorAll("text")].map((t) => t.textContent);
    expect(texts.slice(0, -1).join(" ")).toContain("Sunflower Oil");
    expect(texts.at(-1)).toMatch(/13k$/);
  });

  it("draws nothing for the root node, which has no fill and used to show as black corners", () => {
    const c = tile({ depth: 0, fill: undefined });
    expect(c.querySelector("rect")).toBeNull();
  });

  it("never strokes its text (the halo round every letter) and is clipped to its tile", () => {
    const c = tile();
    const group = c.querySelector("g g");
    expect(group.getAttribute("stroke")).toBe("none");
    expect(group.getAttribute("clip-path")).toMatch(/^url\(#sku\w+\)$/);
    expect(group.getAttribute("fill")).toBe("#fafafa");
  });

  it("keeps the tile but drops the label when it is too small to read, so hover still works", () => {
    const c = tile({ width: 22, height: 18 });
    expect(c.querySelector("rect[fill]")).not.toBeNull();
    expect(c.querySelectorAll("text")).toHaveLength(0);
  });

  it("is named for a screen reader with the amount and share", () => {
    const c = tile();
    expect(c.querySelector("g[role='img']").getAttribute("aria-label")).toMatch(/Sunflower Oil - 1\.5L x 6 Carton: .*12,500\.00.*31\.0%/);
  });
});
