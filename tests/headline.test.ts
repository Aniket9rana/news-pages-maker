import { describe, expect, it } from "vitest";
import { deckBullets, parseHeadline, plainHeadline } from "@/lib/headline";
import { DEFAULT_PAGE, normalizePage } from "@/lib/page";
import { TEMPLATES, applyTemplate } from "@/lib/templates";

describe("headline markup", () => {
  it("splits *highlighted* words", () => {
    expect(parseHeadline("अब कर्ज *महंगा* हुआ")).toEqual([
      { text: "अब कर्ज ", hl: false },
      { text: "महंगा", hl: true },
      { text: " हुआ", hl: false },
    ]);
    expect(plainHeadline("*नहीं* हुआ खत्म")).toBe("नहीं हुआ खत्म");
  });
  it("keeps an unmatched star as text", () => {
    expect(plainHeadline("a * b")).toBe("a * b");
  });
  it("only bullets multi-line or ■-prefixed decks", () => {
    expect(deckBullets("एक पंक्ति")).toBeNull();
    expect(deckBullets("एक\nदो")).toEqual(["एक", "दो"]);
    expect(deckBullets("■ एक")).toEqual(["एक"]);
  });
});

describe("page size", () => {
  it("is the 32.9 x 52.0 cm press size at 96 dpi", () => {
    expect(DEFAULT_PAGE.width).toBe(1243);
    expect(DEFAULT_PAGE.height).toBe(1965);
    expect(DEFAULT_PAGE.width / DEFAULT_PAGE.height).toBeCloseTo(32.9 / 52.0, 3);
  });
});

describe("page templates", () => {
  it("switching type sets the header height and the default section name", () => {
    const p = applyTemplate(DEFAULT_PAGE, "front");
    expect(p.headerHeight).toBe(TEMPLATES.front.headerHeight);
    const sports = applyTemplate(DEFAULT_PAGE, "sports");
    expect(sports.header.sectionName).toBe("खेल बुलेटिन");
    expect(applyTemplate(sports, "business").header.ticker).toHaveLength(4);
  });
  it("keeps a section name the editor typed", () => {
    const custom = { ...DEFAULT_PAGE, header: { ...DEFAULT_PAGE.header, sectionName: "मेरा पन्ना" } };
    expect(applyTemplate(custom, "sports").header.sectionName).toBe("मेरा पन्ना");
  });
  it("fills in a project saved before templates existed", () => {
    const old = { width: 1200, height: 1696, columns: 8, margin: 16, gutter: 12, headerHeight: 118, header: { siteName: "x", tagline: "", url: "", sectionName: "", dateLine: "", pageNo: "" } };
    const p = normalizePage(old as never);
    expect(p.kind).toBe("regional");
    expect(p.header.cities).toBeTruthy();
    // and moves a page saved at the old size to the press size
    expect(p.width).toBe(DEFAULT_PAGE.width);
    expect(p.height).toBe(DEFAULT_PAGE.height);
  });
});
