import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { StoryBox } from "@/components/page/StoryBox";
import type { PageConfig, Story } from "../types";
import type { Metrics, Photo } from "./fit";

/**
 * Measures real rendered text height in the browser (Chromium shapes Devanagari
 * correctly, so this is the source of truth — canvas estimates are not).
 */
export class DomMetrics implements Metrics {
  private host: HTMLDivElement;
  private root: Root;
  private cache = new Map<string, number>();

  constructor(private page: PageConfig) {
    this.host = document.createElement("div");
    this.host.className = "page-root";
    this.host.style.cssText = "position:absolute;left:-100000px;top:0;visibility:hidden;pointer-events:none;";
    document.body.appendChild(this.host);
    this.root = createRoot(this.host);
  }

  destroy() {
    this.root.unmount();
    this.host.remove();
  }

  textHeight(story: Story, cols: number, t: number, width: number, lead = 0): number {
    return this.measure(story, cols, t, width, lead, null);
  }

  boxHeight(story: Story, cols: number, t: number, width: number, lead: number, photo: Photo): number {
    return this.measure(story, cols, t, width, lead, photo);
  }

  private measure(story: Story, cols: number, t: number, width: number, lead: number, photo: Photo | null): number {
    const key = [
      story.id,
      story.score,
      story.headline,
      story.subhead,
      story.kicker ?? "",
      story.headlineStyle ?? "auto",
      story.frame ?? "auto",
      story.byline,
      story.dateline,
      story.body.length,
      story.body.slice(0, 24),
      cols,
      t.toFixed(5),
      lead.toFixed(5),
      // photos change the height through their count, block height, mode, whether they have captions and whether the first is a cut-out
      photo ? `${photo.mode}:${photo.n}:${photo.h}:${story.images.slice(0, photo.n).map((i) => (i.caption.trim() ? "c" : "-") + (i.cutout ? "k" : "")).join("")}` : "",
    ].join("|");
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit;

    flushSync(() => {
      this.root.render(
        createElement(StoryBox, {
          story,
          cols,
          width,
          fit: { t, lead, imgCount: photo?.n ?? 0, imgHeight: photo?.h ?? 0, mode: photo?.mode ?? "row" },
          colorKey: "navy",
          gutter: this.page.gutter,
          kind: this.page.kind,
        }),
      );
    });
    const h = Math.ceil((this.host.firstElementChild as HTMLElement).getBoundingClientRect().height);
    this.cache.set(key, h);
    return h;
  }
}

export async function ensureFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all([
    document.fonts.load('800 24px "Noto Sans Devanagari"', "बिजनौर क्षत्रज्ञ"),
    document.fonts.load('400 14px "Mukta"', "बिजनौर क्षत्रज्ञ"),
    document.fonts.load('700 14px "Mukta"', "बिजनौर क्षत्रज्ञ"),
  ]).catch(() => undefined);
  await document.fonts.ready;
}
