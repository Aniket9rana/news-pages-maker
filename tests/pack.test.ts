import { describe, expect, it } from "vitest";
import { SAMPLE_STORIES } from "@/fixtures/sample-page-2";
import { DEFAULT_PAGE, contentBottom, contentTop } from "@/lib/page";
import { AnalyticMetrics } from "@/lib/layout/fit";
import { Packer } from "@/lib/layout/pack";

const page = DEFAULT_PAGE;
const packer = new Packer(page, new AnalyticMetrics());

describe("Packer", () => {
  const layout = packer.layout(SAMPLE_STORIES, 1, 1500);

  it("places every kept story exactly once", () => {
    const ids = layout.placements.map((p) => p.storyId).sort();
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length + layout.dropped.length).toBe(SAMPLE_STORIES.length);
  });

  it("produces no overlaps and stays inside the page", () => {
    const ps = layout.placements;
    for (const p of ps) {
      expect(p.x).toBeGreaterThanOrEqual(page.margin - 0.5);
      expect(p.x + p.w).toBeLessThanOrEqual(page.width - page.margin + 0.5);
      expect(p.y).toBeGreaterThanOrEqual(contentTop(page) - 0.5);
      expect(p.y + p.h).toBeLessThanOrEqual(contentBottom(page) + 0.5);
    }
    for (let i = 0; i < ps.length; i++)
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], b = ps[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        expect(ox > 1 && oy > 1).toBe(false);
      }
  });

  it("covers (almost) the whole content area", () => {
    const covered = layout.placements.reduce((s, p) => s + p.w * p.h, 0);
    const area = (page.width - 2 * page.margin) * (contentBottom(page) - contentTop(page));
    expect(covered / area).toBeGreaterThan(0.93);
  });

  it("gives the lead the largest area and puts it in the top half", () => {
    const byArea = [...layout.placements].sort((a, b) => b.w * b.h - a.w * a.h);
    expect(byArea[0].storyId).toBe("lead");
    const lead = layout.placements.find((p) => p.storyId === "lead")!;
    expect(lead.y).toBeLessThan((contentTop(page) + contentBottom(page)) / 2);
  });

  it("never gives touching boxes the same colour", () => {
    const ps = layout.placements;
    for (let i = 0; i < ps.length; i++)
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], b = ps[j];
        const g = page.gutter + 2;
        const xo = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const yo = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        const adj =
          ((Math.abs(a.x + a.w - b.x) <= g || Math.abs(b.x + b.w - a.x) <= g) && yo > 0) ||
          ((Math.abs(a.y + a.h - b.y) <= g || Math.abs(b.y + b.h - a.y) <= g) && xo > 0);
        if (adj) expect(a.colorKey).not.toBe(b.colorKey);
      }
  });
});
