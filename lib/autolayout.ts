import { plainHeadline } from "./headline";
import type { Layout, PageConfig, Placement, Story } from "./types";
import { DomMetrics, ensureFonts } from "./layout/measure";
import { fitStory, fittedHeight, shownImages } from "./layout/fit";
import { contentBottom, contentTop } from "./page";
import { Packer } from "./layout/pack";
import { profileFor } from "./layout/profiles";

/** Pack and fit using real browser text measurement. Tries a few seeds and keeps the least-overflowing result. */
export async function runAutoLayout(page: PageConfig, stories: Story[], seed: number): Promise<Layout> {
  await ensureFonts();
  const metrics = new DomMetrics(page);
  try {
    const packer = new Packer(page, metrics);
    const profile = profileFor(page.kind);
    const byId = new Map(stories.map((st) => [st.id, st]));
    const pageArea = (page.width - 2 * page.margin) * (contentBottom(page) - contentTop(page));
    /** overflow is fatal; after that, photos lost weigh more the more important the story is, and empty space inside boxes costs too */
    const penalty = (l: Layout) =>
      l.placements.reduce((sum, p) => {
        const st = byId.get(p.storyId)!;
        const lost = shownImages(st, profile) - p.fit.imgCount;
        // a box the text and photos cannot fill leaves white space: count it as a share of the page (small gaps are ignored)
        const spare = p.overflow ? 0 : Math.max(0, p.h - fittedHeight(st, p.cols, p.w, p.fit, metrics) - 12);
        return sum + (p.overflow ? 1000 : 0) + lost * st.score * st.score + (400 * p.w * spare) / pageArea;
      }, 0) + l.dropped.length * 500;
    let best: Layout | null = null;
    let bestPenalty = Infinity;
    for (let i = 0; i < 8; i++) {
      const layout = packer.layout(stories, seed + i * 101, 2500);
      const pen = penalty(layout);
      if (pen < bestPenalty) {
        best = layout;
        bestPenalty = pen;
      }
      if (pen < 3) break;
    }
    return best!;
  } finally {
    metrics.destroy();
  }
}

/** Keep the current rectangles but re-fit text/images (after a text edit). */
export async function refit(page: PageConfig, stories: Story[], layout: Layout): Promise<Layout> {
  await ensureFonts();
  const metrics = new DomMetrics(page);
  try {
    const profile = profileFor(page.kind);
    const byId = new Map(stories.map((s) => [s.id, s]));
    const warnings: string[] = [];
    const placements: Placement[] = layout.placements
      .filter((p) => byId.has(p.storyId))
      .map((p) => {
        const story = byId.get(p.storyId)!;
        const { fit, overflow } = fitStory(story, p.cols, p.w, p.h, metrics, profile);
        if (overflow) warnings.push(`"${plainHeadline(story.headline)}" overflows its box`);
        return { ...p, fit, overflow };
      });
    return { ...layout, placements, warnings };
  } finally {
    metrics.destroy();
  }
}
