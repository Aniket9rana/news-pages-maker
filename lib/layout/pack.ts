import { plainHeadline } from "../headline";
import type { Layout, PageConfig, Placement, Story } from "../types";
import { colX, contentBottom, contentTop, spanWidth } from "../page";
import { LEAD_MAX, OVERGROW, T_MAX, extraHeight, fitStory, imageRange, shownImages, type Metrics } from "./fit";
import { modeFor, profileFor, type Profile } from "./profiles";
import { COLOR_KEYS, type Tier } from "./tiers";

const MIN_H = 70;
/** the first colours are the house colours; the rest are only used when a box has too many neighbours */
const BASE_COLORS = 4;
const SNAP = 4;

interface Item {
  story: Story;
  tier: Tier;
  /** target area in px² (importance-weighted, normalised to fill the page) */
  desired: number;
}

interface Rect {
  col: number;
  cols: number;
  y: number;
  h: number;
}

type Node =
  | { kind: "leaf"; item: Item; rect: Rect }
  | { kind: "split"; dir: "v" | "h"; a: Node; b: Node; rect: Rect; items: Item[] };

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const snap = (v: number) => Math.round(v / SNAP) * SNAP;

function leaves(n: Node, out: Extract<Node, { kind: "leaf" }>[] = []) {
  if (n.kind === "leaf") out.push(n);
  else {
    leaves(n.a, out);
    leaves(n.b, out);
  }
  return out;
}

function internals(n: Node, out: Extract<Node, { kind: "split" }>[] = []) {
  if (n.kind === "split") {
    out.push(n);
    internals(n.a, out);
    internals(n.b, out);
  }
  return out;
}

function replace(root: Node, target: Node, repl: Node): Node {
  if (root === target) return repl;
  if (root.kind === "leaf") return root;
  return { ...root, a: replace(root.a, target, repl), b: replace(root.b, target, repl) };
}

/** Re-fit a subtree into a new vertical extent, keeping its column splits and scaling its horizontal cuts proportionally. */
function resizeV(n: Node, y: number, h: number, gutter: number): Node {
  const rect = { ...n.rect, y, h };
  if (n.kind === "leaf") return { ...n, rect };
  if (n.dir === "v") return { ...n, rect, a: resizeV(n.a, y, h, gutter), b: resizeV(n.b, y, h, gutter) };
  const avail = h - gutter;
  const hA = Math.min(avail - MIN_H, Math.max(MIN_H, snap((avail * n.a.rect.h) / (n.a.rect.h + n.b.rect.h))));
  return { ...n, rect, a: resizeV(n.a, y, hA, gutter), b: resizeV(n.b, y + hA + gutter, avail - hA, gutter) };
}

export class Packer {
  private profile: Profile;

  constructor(
    private page: PageConfig,
    private metrics: Metrics,
  ) {
    this.profile = profileFor(page.kind);
  }

  /** Photo block range for a story in `c` columns, as height added to the box (what the cost function compares). */
  private photoExtra(story: Story, W: number, c: number) {
    const mode = modeFor(story, this.profile);
    const n = shownImages(story, this.profile, mode);
    const r = imageRange(story, W, n, mode, c, this.profile);
    // the fitter lets an inset photo grow to 1.5x its usual maximum once the type is full size
    return { n, min: extraHeight(r.min, mode, c), max: extraHeight(r.max * OVERGROW[mode], mode, c) };
  }

  private rectPx(r: Rect) {
    return { x: colX(this.page, r.col), y: r.y, w: spanWidth(this.page, r.cols), h: r.h };
  }

  private generate(items: Item[], rect: Rect, rng: () => number, noise = 1.6): Node {
    if (items.length === 1) return { kind: "leaf", item: items[0], rect };

    const keyed = items
      .map((it) => ({ it, k: it.story.score + (rng() - 0.5) * noise }))
      .sort((a, b) => b.k - a.k)
      .map((x) => x.it);
    const total = keyed.reduce((s, i) => s + i.desired, 0);

    // pick a cut near a random area fraction
    const target = 0.25 + rng() * 0.5;
    let acc = 0;
    const weights: number[] = [];
    for (let i = 0; i < keyed.length - 1; i++) {
      acc += keyed[i].desired;
      weights.push(Math.exp(-Math.pow((acc / total - target) / 0.18, 2)) + 0.001);
    }
    let pick = rng() * weights.reduce((a, b) => a + b, 0);
    let cut = 1;
    for (let i = 0; i < weights.length; i++) {
      pick -= weights[i];
      if (pick <= 0) {
        cut = i + 1;
        break;
      }
    }
    const A = keyed.slice(0, cut);
    const B = keyed.slice(cut);
    const share = A.reduce((s, i) => s + i.desired, 0) / total;

    const wpx = spanWidth(this.page, rect.cols);
    const gutter = this.page.gutter;
    const canV = rect.cols >= 2;
    const canH = rect.h >= 2 * MIN_H + gutter;
    let dir: "v" | "h";
    if (canV && canH) dir = rng() < Math.pow(wpx, 1.4) / (Math.pow(wpx, 1.4) + Math.pow(rect.h, 1.4)) ? "v" : "h";
    else if (canV) dir = "v";
    else dir = "h";

    const needA = Math.max(...A.map((i) => i.tier.minCols));
    const needB = Math.max(...B.map((i) => i.tier.minCols));
    if (dir === "v" && needA + needB > rect.cols) dir = canH ? "h" : "v";

    if (dir === "v") {
      const lo = Math.min(needA, rect.cols - 1);
      const hi = Math.max(lo, Math.min(rect.cols - needB, rect.cols - 1));
      const colsA = Math.min(hi, Math.max(lo, Math.round(rect.cols * share)));
      return {
        kind: "split",
        dir,
        rect,
        items,
        a: this.generate(A, { ...rect, cols: colsA }, rng, noise),
        b: this.generate(B, { ...rect, col: rect.col + colsA, cols: rect.cols - colsA }, rng, noise),
      };
    }
    const hA = Math.min(rect.h - MIN_H - gutter, Math.max(MIN_H, snap(rect.h * share)));
    return {
      kind: "split",
      dir,
      rect,
      items,
      a: this.generate(A, { ...rect, h: hA }, rng, noise),
      b: this.generate(B, { ...rect, y: rect.y + hA + gutter, h: rect.h - hA - gutter }, rng, noise),
    };
  }

  private leafCost(it: Item, rect: Rect): number {
    const { tier: T, story } = it;
    const c = rect.cols;
    const W = spanWidth(this.page, c);
    const h = rect.h;
    let cost = 0;
    if (c < T.minCols) cost += 5 * (T.minCols - c);
    if (c > T.maxCols) cost += 3 * (c - T.maxCols);

    const { n, ...img } = this.photoExtra(story, W, c);
    const t0 = this.metrics.textHeight(story, c, 0, W);
    const t1 = this.metrics.textHeight(story, c, T_MAX, W, LEAD_MAX);
    if (h < t0) cost += 30 + (60 * (t0 - h)) / t0;
    // losing the photos of an important story is far worse than losing a brief's
    else if (n > 0 && h < t0 + img.min) cost += (story.score >= 3 ? 2.2 : 0.5) * story.score * story.score + (6 * (t0 + img.min - h)) / h;
    else if (h > t1 + img.max) cost += (10 * (h - (t1 + img.max))) / h;

    const r = (W * h) / it.desired;
    cost += 2 * Math.pow(Math.log(r), 2);
    return cost;
  }

  private treeCost(root: Node): number {
    const ls = leaves(root);
    const top = contentTop(this.page);
    const span = contentBottom(this.page) - top;
    let cost = 0;
    const areas = ls.map((l) => spanWidth(this.page, l.rect.cols) * l.rect.h);
    ls.forEach((l, i) => {
      cost += this.leafCost(l.item, l.rect);
      // important stories belong near the top of the page
      const topEdge = (l.rect.y - top) / span;
      cost += Math.pow((l.item.story.score - 1) / 4, 2) * topEdge * 16;
      // the lead story always opens the page
      if (l.item.story.score === 5) cost += 60 * Math.max(0, topEdge - 0.08);
    });
    for (let i = 0; i < ls.length; i++) {
      for (let j = 0; j < ls.length; j++) {
        const gap = ls[i].item.story.score - ls[j].item.story.score;
        if (gap >= 1 && areas[i] < areas[j]) cost += 12 * gap * (1 - areas[i] / areas[j]);
      }
    }
    return cost;
  }

  /** Build items: drop what cannot fit, then derive importance-weighted target areas. */
  private prepare(stories: Story[]): { items: Item[]; dropped: string[] } {
    const area = (this.page.width - 2 * this.page.margin) * (contentBottom(this.page) - contentTop(this.page));
    const minArea = (s: Story) => {
      const T = this.profile.tiers[s.score];
      let best = Infinity;
      for (let c = T.minCols; c <= T.maxCols; c++) {
        const W = spanWidth(this.page, c);
        best = Math.min(best, this.metrics.textHeight(s, c, 0, W) * W);
      }
      return best;
    };
    const order = [...stories].sort((a, b) => b.score - a.score);
    const kept = [...order];
    const dropped: string[] = [];
    while (kept.length > 1 && kept.reduce((sum, s) => sum + minArea(s), 0) > area * 0.93) {
      dropped.push(kept.pop()!.id);
    }

    const raw = kept.map((s) => {
      const T = this.profile.tiers[s.score];
      const c = Math.round((T.minCols + T.maxCols) / 2);
      const W = spanWidth(this.page, c);
      const img = this.photoExtra(s, W, c);
      const natural = (this.metrics.textHeight(s, c, 0.5, W) + (img.min + img.max) / 2) * W;
      return { story: s, tier: T, desired: natural * T.areaBoost };
    });
    // Scale all targets to fill the page, but not equally: when the page is over-full, minor
    // stories shrink first and the lead keeps its natural size (and its photos); when there is
    // room to spare, the important stories grow first.
    const exps: Record<number, number> = { 5: 0.45, 4: 0.7, 3: 1, 2: 1.4, 1: 1.8 };
    const total = (lam: number) =>
      raw.reduce((a, i) => a + i.desired * Math.pow(lam, lam < 1 ? exps[i.story.score] : 2 - exps[i.story.score]), 0);
    let lo = 0.05;
    let hi = 20;
    for (let k = 0; k < 40; k++) {
      const mid = Math.sqrt(lo * hi);
      if (total(mid) < area) lo = mid;
      else hi = mid;
    }
    const lam = Math.sqrt(lo * hi);
    return {
      items: raw.map((i) => ({
        ...i,
        desired: i.desired * Math.pow(lam, lam < 1 ? exps[i.story.score] : 2 - exps[i.story.score]),
      })),
      dropped,
    };
  }

  /**
   * The tree search only moves cuts in coarse steps, so boxes end up a little taller than their text and
   * photos can fill. Nudge each horizontal cut by small amounts and keep any move that lowers the cost:
   * space moves from a box with spare room to its neighbour.
   */
  private tuneCuts(root: Node): Node {
    const g = this.page.gutter;
    let best = root;
    let bestCost = this.treeCost(best);
    const steps = [64, 32, 16, 8, 4];
    for (let pass = 0; pass < 6; pass++) {
      let improved = false;
      // the tree keeps its shape while tuning, so a cut keeps its index in the pre-order list
      const count = internals(best).filter((x) => x.dir === "h").length;
      for (let idx = 0; idx < count; idx++) {
        for (const step of steps) {
          for (const sign of [-1, 1]) {
            const cur = internals(best).filter((x) => x.dir === "h")[idx];
            const hA = cur.a.rect.h + sign * step;
            const hB = cur.rect.h - g - hA;
            if (hA < MIN_H || hB < MIN_H) continue;
            const moved: Node = {
              ...cur,
              a: resizeV(cur.a, cur.rect.y, hA, g),
              b: resizeV(cur.b, cur.rect.y + hA + g, hB, g),
            };
            const cand = replace(best, cur, moved);
            const c = this.treeCost(cand);
            if (c < bestCost - 1e-6) {
              best = cand;
              bestCost = c;
              improved = true;
              break;
            }
          }
        }
      }
      if (!improved) break;
    }
    return best;
  }

  layout(stories: Story[], seed = 1, iterations = 5000): Layout {
    const warnings: string[] = [];
    if (stories.length === 0) return { placements: [], dropped: [], warnings, seed };

    const { items, dropped } = this.prepare(stories);
    if (dropped.length) warnings.push(`${dropped.length} lowest-priority stor${dropped.length > 1 ? "ies" : "y"} did not fit on this page`);

    const root: Rect = {
      col: 0,
      cols: this.page.columns,
      y: contentTop(this.page),
      h: contentBottom(this.page) - contentTop(this.page),
    };
    const rng = mulberry32(seed * 7919 + 13);

    // random restarts, then subtree-mutation hill climbing
    let best: Node = this.generate(items, root, rng);
    let bestCost = this.treeCost(best);
    const restarts = Math.floor(iterations / 5);
    for (let i = 0; i < restarts; i++) {
      const cand = this.generate(items, root, rng);
      const c = this.treeCost(cand);
      if (c < bestCost) {
        best = cand;
        bestCost = c;
      }
    }
    for (let i = 0; i < iterations; i++) {
      const nodes = internals(best);
      if (nodes.length === 0) break;
      const target = nodes[Math.floor(rng() * nodes.length)];
      const regen = this.generate(target.items, target.rect, rng, 1 + rng() * 1.5);
      const cand = replace(best, target, regen);
      const c = this.treeCost(cand);
      if (c < bestCost) {
        best = cand;
        bestCost = c;
      }
    }

    best = this.tuneCuts(best);

    const placements: Placement[] = leaves(best).map((l) => {
      const px = this.rectPx(l.rect);
      const { fit, overflow } = fitStory(l.item.story, l.rect.cols, px.w, px.h, this.metrics, this.profile);
      if (overflow) warnings.push(`"${plainHeadline(l.item.story.headline)}" overflows its box`);
      return {
        storyId: l.item.story.id,
        colStart: l.rect.col,
        cols: l.rect.cols,
        ...px,
        fit,
        colorKey: "navy",
        overflow,
      };
    });
    assignColors(placements, this.page.gutter);
    return { placements, dropped, warnings, seed };
  }
}

/** Greedy graph colouring so touching boxes never share a headline colour. */
export function assignColors(placements: Placement[], gutter: number) {
  const touch = (a: Placement, b: Placement) => {
    const g = gutter + 2;
    const xo = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const yo = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    const hAdj = Math.abs(a.x + a.w - b.x) <= g || Math.abs(b.x + b.w - a.x) <= g;
    const vAdj = Math.abs(a.y + a.h - b.y) <= g || Math.abs(b.y + b.h - a.y) <= g;
    return (hAdj && yo > 0) || (vAdj && xo > 0);
  };
  const order = [...placements].sort((a, b) => b.w * b.h - a.w * a.h);
  const used = new Map<string, number>();
  order.forEach((p, idx) => {
    const taken = new Set(placements.filter((q) => q !== p && q.colorKey && used.has(q.storyId) && touch(p, q)).map((q) => q.colorKey));
    const choices = COLOR_KEYS.filter((k) => !taken.has(k));
    const pool = choices.length ? choices : COLOR_KEYS;
    p.colorKey = pool[idx % Math.min(pool.length, BASE_COLORS)];
    used.set(p.storyId, 1);
  });
}
