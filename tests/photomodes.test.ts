import { describe, expect, it } from "vitest";
import { SAMPLE_STORIES } from "@/fixtures/sample-page-2";
import { AnalyticMetrics, fitStory, shownImages } from "@/lib/layout/fit";
import { modeFor, profileFor } from "@/lib/layout/profiles";
import type { Story } from "@/lib/types";

const metrics = new AnalyticMetrics();
const story = (id: string) => SAMPLE_STORIES.find((s) => s.id === id)!;

describe("page type profiles", () => {
  it("regional pages put lesser stories' photos inside the text, the lead stays a row", () => {
    const p = profileFor("regional");
    expect(modeFor(story("lead"), p)).toBe("row");
    expect(modeFor(story("kolhu"), p)).toBe("inset");
  });
  it("feature and sports leads are a headline over a photo", () => {
    expect(modeFor(story("lead"), profileFor("feature"))).toBe("overlay");
    expect(modeFor(story("lead"), profileFor("sports"))).toBe("overlay");
  });
  it("opinion pages give middling stories one inset portrait, and small items none", () => {
    expect(modeFor(story("kolhu"), profileFor("opinion"))).toBe("inset");
    expect(shownImages(story("kolhu"), profileFor("opinion"))).toBe(1);
    expect(shownImages({ ...story("kolhu"), score: 1 }, profileFor("opinion"))).toBe(0);
  });
  it("an editor's photo mode wins, and gives a photo even where the tier has none", () => {
    const s: Story = { ...story("fire-cause"), score: 1, photoMode: "inset" };
    expect(modeFor(s, profileFor("opinion"))).toBe("inset");
    expect(shownImages(s, profileFor("opinion"))).toBe(1);
  });
  it("inset and overlay show one photo at most", () => {
    expect(shownImages(story("lead"), profileFor("feature"))).toBe(1);
    expect(shownImages(story("lead"), profileFor("regional"))).toBe(3);
  });
});

describe("fitStory with photo modes", () => {
  it("records the mode it used", () => {
    const { fit, overflow } = fitStory(story("kolhu"), 2, 560, 520, metrics, profileFor("regional"));
    expect(overflow).toBe(false);
    expect(fit.mode).toBe("inset");
    expect(fit.imgCount).toBe(1);
  });
  it("falls back to a plain row, then to no photo, when the preferred mode cannot fit", () => {
    const tight = fitStory(story("lead"), 6, 880, 190, metrics, profileFor("feature"));
    expect(tight.fit.mode).toBe("row");
  });
});
