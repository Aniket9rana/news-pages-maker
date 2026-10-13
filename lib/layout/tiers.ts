import type { HeadlineStyle, Score, Story } from "../types";

export type { HeadlineStyle };

export interface Tier {
  score: Score;
  name: string;
  minCols: number;
  maxCols: number;
  /** headline font px at t=0 / t=1 */
  headline: [number, number];
  headlineStyle: HeadlineStyle;
  maxImages: number;
  /** body font px at t=0 / t=1 */
  body: [number, number];
  /** share of page area this tier is "worth" relative to its natural size */
  areaBoost: number;
  boxed: boolean;
}

/** Headline style and frame for a story: the editor's override, else the tier default. */
export function resolveStyle(story: Story, tiers: Record<Score, Tier> = TIERS): { headline: HeadlineStyle; boxed: boolean } {
  const tier = tiers[story.score];
  const h = story.headlineStyle && story.headlineStyle !== "auto" ? story.headlineStyle : tier.headlineStyle;
  const boxed = story.frame === "boxed" ? true : story.frame === "open" ? false : tier.boxed;
  return { headline: h, boxed };
}

/** Values taken from the sample page (see plan: five importance tiers). */
export const TIERS: Record<Score, Tier> = {
  5: { score: 5, name: "Lead", minCols: 4, maxCols: 6, headline: [48, 66], headlineStyle: "banner", maxImages: 3, body: [12, 14], areaBoost: 1.35, boxed: false },
  4: { score: 4, name: "Strong", minCols: 3, maxCols: 5, headline: [30, 40], headlineStyle: "text", maxImages: 2, body: [11.5, 13.5], areaBoost: 1.15, boxed: false },
  3: { score: 3, name: "Medium", minCols: 2, maxCols: 3, headline: [22, 29], headlineStyle: "text", maxImages: 1, body: [11, 13], areaBoost: 1, boxed: false },
  2: { score: 2, name: "Short", minCols: 2, maxCols: 2, headline: [18, 23], headlineStyle: "text", maxImages: 1, body: [10.5, 12.5], areaBoost: 0.9, boxed: true },
  1: { score: 1, name: "Brief", minCols: 1, maxCols: 2, headline: [15, 19], headlineStyle: "plain", maxImages: 0, body: [10.5, 12], areaBoost: 0.8, boxed: true },
};

/** The paper uses red, black, blue and green; the first four are the house colours, the rest are fallbacks. */
export const PALETTE: Record<string, { name: string; hex: string }> = {
  red: { name: "Red", hex: "#c8102e" },
  navy: { name: "Blue", hex: "#1b3a8a" },
  green: { name: "Green", hex: "#1d6b3b" },
  black: { name: "Black", hex: "#141414" },
  maroon: { name: "Maroon", hex: "#8c1c2f" },
  teal: { name: "Teal", hex: "#0c5c5e" },
  slate: { name: "Slate", hex: "#34495e" },
  brown: { name: "Brown", hex: "#7a4410" },
  olive: { name: "Olive", hex: "#4b5e12" },
  plum: { name: "Plum", hex: "#5a2a7a" },
};

export const COLOR_KEYS = Object.keys(PALETTE);

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
