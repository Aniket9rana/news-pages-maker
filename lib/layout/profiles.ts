import type { PageKind, PhotoMode, Score, Story } from "../types";
import { TIERS, type Tier } from "./tiers";

/**
 * What a page type changes about layout: tier tweaks (photo counts, headline style), the default
 * photo mode per importance tier, and how big photos may grow. The header band is in templates.ts.
 */
export interface Profile {
  tiers: Record<Score, Tier>;
  modes: Record<Score, PhotoMode>;
  /** multiplies how tall photos may grow */
  photoGrow: number;
  /** tallest allowed photo height/width ratio in a row (portrait photos in feature pages) */
  maxRatio: number;
}

const ROW: Record<Score, PhotoMode> = { 5: "row", 4: "row", 3: "row", 2: "row", 1: "row" };

function tweak(patch: Partial<Record<Score, Partial<Tier>>>): Record<Score, Tier> {
  const out = { ...TIERS };
  for (const k of Object.keys(patch)) {
    const s = Number(k) as Score;
    out[s] = { ...TIERS[s], ...patch[s] };
  }
  return out;
}

const REGIONAL: Profile = {
  tiers: TIERS,
  // lesser stories carry a small head-shot inside the text, as on the sample's inner pages
  modes: { ...ROW, 3: "inset", 2: "inset" },
  photoGrow: 1,
  maxRatio: 1.15,
};

export const PROFILES: Record<PageKind, Profile> = {
  front: { ...REGIONAL },
  regional: REGIONAL,
  // photo-led: more and bigger photos, portrait crops allowed, the lead is a headline over a wide photo
  feature: {
    tiers: tweak({
      5: { maxImages: 3, headline: [46, 64] },
      4: { maxImages: 3 },
      3: { maxImages: 2 },
    }),
    modes: { 5: "overlay", 4: "row", 3: "row", 2: "inset", 1: "row" },
    photoGrow: 1.7,
    maxRatio: 1.5,
  },
  // text-led: at most one photo; the smaller pieces carry the columnist's portrait inset in the text (which also soaks up spare room)
  opinion: {
    tiers: tweak({
      5: { maxImages: 1 },
      4: { maxImages: 1 },
      3: { maxImages: 1 },
      2: { maxImages: 1 },
    }),
    modes: { ...ROW, 3: "inset", 2: "inset" },
    photoGrow: 0.8,
    maxRatio: 1.15,
  },
  business: {
    tiers: tweak({ 5: { maxImages: 2 }, 4: { maxImages: 1 } }),
    modes: { ...ROW, 3: "inset", 2: "inset" },
    photoGrow: 1,
    maxRatio: 1.15,
  },
  // big action photo under a headline set over it; colour-block headlines for the secondary stories
  sports: {
    tiers: tweak({ 5: { maxImages: 2 }, 4: { maxImages: 2, headlineStyle: "chip" } }),
    modes: { 5: "overlay", 4: "row", 3: "inset", 2: "inset", 1: "row" },
    photoGrow: 1.4,
    maxRatio: 1.3,
  },
  world: {
    tiers: tweak({ 5: { maxImages: 2 } }),
    modes: { 5: "overlay", 4: "row", 3: "row", 2: "inset", 1: "row" },
    photoGrow: 1.3,
    maxRatio: 1.2,
  },
};

export function profileFor(kind: PageKind | undefined): Profile {
  return PROFILES[kind ?? "regional"];
}

/** The editor's per-story photo mode, else the page type's default for this tier. */
export function modeFor(story: Story, profile: Profile): PhotoMode {
  return story.photoMode && story.photoMode !== "auto" ? story.photoMode : profile.modes[story.score];
}
