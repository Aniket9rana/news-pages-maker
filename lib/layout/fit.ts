import type { FitParams, PhotoMode, Story } from "../types";
import { TIERS, lerp } from "./tiers";
import { modeFor, type Profile } from "./profiles";

export interface Photo {
  mode: PhotoMode;
  /** how many photos are shown */
  n: number;
  /** height of the photo block (photos + gap + captions), px */
  h: number;
}

export interface Metrics {
  /** Text height (headline + byline + body, no photos) in px for a story at `cols` columns. */
  textHeight(story: Story, cols: number, t: number, width: number, lead?: number): number;
  /**
   * Natural height of the whole box with its photos laid out in `photo.mode`. Needed because an inset
   * photo sits inside the text columns and an overlay photo contains the headline, so neither is
   * simply "text height + photo height".
   */
  boxHeight(story: Story, cols: number, t: number, width: number, lead: number, photo: Photo): number;
}

/** Type may grow beyond the tier's nominal maximum, and leading by this much, to fill a box. */
export const T_MAX = 1.4;
export const LEAD_MAX = 0.3;
/** Once type is full size, a photo may grow past its usual maximum by this factor to soak up spare room. */
export const OVERGROW: Record<PhotoMode, number> = { row: 1.3, inset: 1.5, overlay: 1 };

export const CAPTION_H = 28;
export const IMG_GAP = 5;
const COL_GAP = 12;

/** Photos a story shows in `mode`: the tier's allowance, and one at most for inset/overlay. */
export function shownImages(story: Story, profile: Profile, mode: PhotoMode = modeFor(story, profile)): number {
  let cap = profile.tiers[story.score].maxImages;
  // an editor who asks for a photo mode on a story whose tier has no photos gets one
  if (cap === 0 && story.photoMode && story.photoMode !== "auto") cap = 1;
  const n = Math.min(story.images.length, cap);
  return mode === "row" ? n : Math.min(n, 1);
}

/** Min/max height of the photo block for `n` photos in a box of width `W` and `cols` text columns. */
export function imageRange(story: Story, W: number, n: number, mode: PhotoMode, cols: number, profile: Profile): { min: number; max: number } {
  if (n <= 0) return { min: 0, max: 0 };
  const imgs = story.images.slice(0, n);
  const avg = imgs.reduce((a, i) => a + i.height / Math.max(1, i.width), 0) / imgs.length;
  const cap = imgs.some((i) => i.caption.trim()) ? CAPTION_H : 0;
  // minor stories keep their photo modest so it never out-ranks a bigger story's
  const grow = (story.score >= 3 ? 1.4 : 1.0) * profile.photoGrow;
  if (mode === "inset") {
    const colW = (W - (cols - 1) * COL_GAP) / cols;
    const base = colW * Math.min(1.4, Math.max(0.75, avg));
    return { min: Math.round(base * 0.8 + cap + IMG_GAP), max: Math.round(base * Math.min(grow, 1.3) + cap + IMG_GAP) };
  }
  if (mode === "overlay") {
    const base = W * Math.min(0.8, Math.max(0.35, avg * 0.7));
    return { min: Math.round(base * 0.7 + cap + IMG_GAP), max: Math.round(base * grow + cap + IMG_GAP) };
  }
  const ratio = Math.min(profile.maxRatio, Math.max(0.6, avg));
  const base = (W / n) * ratio;
  return { min: Math.round(base * 0.78 + cap + IMG_GAP), max: Math.round(base * grow + cap + IMG_GAP) };
}

/**
 * How much a photo block adds to the box height, for the packer's estimates (the fitter measures exactly).
 * An inset photo takes one column, so it adds about 1/cols of its height; an overlay photo covers the headline.
 */
export function extraHeight(h: number, mode: PhotoMode, cols: number): number {
  if (mode === "inset") return h / cols;
  if (mode === "overlay") return h * 0.6;
  return h;
}

export interface FitResult {
  fit: FitParams;
  overflow: boolean;
}

/**
 * Pick font scale + photo height so the story exactly fills a box of height `h`.
 * Order of concessions: shrink photos to their minimum, drop trailing photos, then
 * shrink type to the tier minimum. A story whose preferred mode (inset/overlay) cannot fit
 * falls back to a plain photo row before giving up its photos. Anything left over is reported as overflow.
 */
export function fitStory(story: Story, cols: number, W: number, h: number, metrics: Metrics, profile: Profile): FitResult {
  const primary = modeFor(story, profile);
  const attempts: Array<{ mode: PhotoMode; n: number }> = [];
  for (let n = shownImages(story, profile, primary); n >= (primary === "row" ? 0 : 1); n--) attempts.push({ mode: primary, n });
  if (primary !== "row") for (let n = shownImages(story, profile, "row"); n >= 0; n--) attempts.push({ mode: "row", n });

  for (const { mode, n } of attempts) {
    const { min, max } = imageRange(story, W, n, mode, cols, profile);
    const text = (t: number, lead = 0) => metrics.textHeight(story, cols, t, W, lead);
    const total = (t: number, lead: number, imgH: number) =>
      n === 0 || mode === "row" ? text(t, lead) + imgH : metrics.boxHeight(story, cols, t, W, lead, { mode, n, h: imgH });
    if (total(0, 0, min) > h) continue;

    // photos first: aim for the middle of their range, then give text what is left
    const targetImg = n > 0 ? min + (max - min) * 0.55 : 0;
    let t = 0;
    if (total(T_MAX, 0, targetImg) <= h) t = T_MAX;
    else if (total(0, 0, targetImg) <= h) {
      let lo = 0;
      let hi = T_MAX;
      for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2;
        if (total(mid, 0, targetImg) <= h) lo = mid;
        else hi = mid;
      }
      t = lo;
    }
    let imgHeight = 0;
    if (n > 0) {
      if (mode === "row") {
        const room = h - text(t);
        imgHeight = Math.round(Math.min(max, Math.max(min, room)));
        // type is full size and the photo at its usual maximum: let the photo take the rest
        if (t >= T_MAX - 0.001 && room > max) imgHeight = Math.round(Math.min(max * OVERGROW.row, room));
      } else {
        // the photo takes whatever room the type left, up to its maximum
        let lo = min;
        let hi = max;
        while (hi - lo > 1) {
          const mid = Math.floor((lo + hi) / 2);
          if (total(t, 0, mid) <= h) lo = mid;
          else hi = mid;
        }
        imgHeight = total(t, 0, hi) <= h ? hi : lo;
        // type is already as big as it goes and the photo is at its usual maximum: let the photo take the rest, up to 1.5x
        if (OVERGROW[mode] > 1 && t >= T_MAX - 0.001 && imgHeight >= max && h - total(t, 0, imgHeight) > 3) {
          let lo2 = imgHeight;
          let hi2 = Math.round(max * OVERGROW[mode]);
          while (hi2 - lo2 > 1) {
            const mid = Math.floor((lo2 + hi2) / 2);
            if (total(t, 0, mid) <= h) lo2 = mid;
            else hi2 = mid;
          }
          imgHeight = total(t, 0, hi2) <= h ? hi2 : lo2;
        }
      }
    }

    // whatever room is still spare goes into leading, so the column ends flush with the box
    let lead = 0;
    if (h - total(t, 0, imgHeight) > 3 && total(t, LEAD_MAX, imgHeight) >= h - 3) {
      let lo = 0;
      let hi = LEAD_MAX;
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        if (total(t, mid, imgHeight) <= h) lo = mid;
        else hi = mid;
      }
      lead = lo;
    } else if (h - total(t, 0, imgHeight) > 3) {
      lead = LEAD_MAX;
    }
    // quantise (the measurement cache is keyed on these) and verify against a real measurement
    t = Math.floor(t * 1000) / 1000;
    lead = Math.floor(lead * 1000) / 1000;
    let guard = 0;
    while (guard++ < 40 && total(t, lead, imgHeight) > h) {
      if (lead > 0) lead = Math.max(0, Math.floor((lead - 0.02) * 1000) / 1000);
      else if (t > 0) t = Math.max(0, Math.floor((t - 0.01) * 1000) / 1000);
      else break;
    }
    if (total(t, lead, imgHeight) > h) continue;
    return { fit: { t, lead, imgCount: n, imgHeight, mode: n > 0 ? mode : "row" }, overflow: false };
  }
  return { fit: { t: 0, lead: 0, imgCount: 0, imgHeight: 0, mode: "row" }, overflow: true };
}

/** Height the story's content actually takes at these fit params (<= the box height; the difference is empty space). */
export function fittedHeight(story: Story, cols: number, W: number, fit: FitParams, metrics: Metrics): number {
  const mode = fit.mode ?? "row";
  if (fit.imgCount === 0 || mode === "row") return metrics.textHeight(story, cols, fit.t, W, fit.lead) + (fit.imgCount ? fit.imgHeight : 0);
  return metrics.boxHeight(story, cols, fit.t, W, fit.lead, { mode, n: fit.imgCount, h: fit.imgHeight });
}

/** Rough analytic estimate used in unit tests and before fonts have loaded. */
export class AnalyticMetrics implements Metrics {
  textHeight(story: Story, cols: number, t: number, width: number, lead = 0): number {
    const tier = TIERS[story.score];
    const bodyPx = lerp(tier.body[0], tier.body[1], t);
    const headPx = lerp(tier.headline[0], tier.headline[1], t);
    const colW = (width - (cols - 1) * 12) / cols;
    const cpl = Math.max(4, colW / (bodyPx * 0.5));
    const lines = Math.ceil(story.body.length / cpl / cols) + 1;
    const body = lines * bodyPx * (1.4 + 0.12 * Math.min(t, 1) + lead);
    const headLines = Math.max(1, Math.ceil((story.headline.length * headPx * 0.58) / Math.max(40, width - 20)));
    const head = headLines * headPx * 1.18 + 16;
    return Math.round(head + body + 28);
  }

  boxHeight(story: Story, cols: number, t: number, width: number, lead: number, photo: Photo): number {
    return this.textHeight(story, cols, t, width, lead) + extraHeight(photo.h, photo.mode, cols);
  }
}
