import type { PageConfig } from "./types";

/** Press size of a full-page ad / page in this paper: 32.9 cm x 52.0 cm. */
export const PAGE_CM = { width: 32.9, height: 52.0 };
const cmToPx = (cm: number) => Math.round((cm / 2.54) * 96);

/** The size pages had before the press size was set (measured from a render of the sample page, 1:1.41). */
const LEGACY_SIZE = { width: 1200, height: 1696 };

/**
 * Page geometry in CSS px at 96dpi: 32.9 x 52.0 cm = 1243 x 1965 px (ratio 0.633, taller than the
 * sample render's 0.707). Type sizes in tiers.ts are tuned at this scale (1 px = 1/96 in).
 * The default is an inner regional page (slim header band).
 */
export const DEFAULT_PAGE: PageConfig = {
  kind: "regional",
  width: cmToPx(PAGE_CM.width),
  height: cmToPx(PAGE_CM.height),
  columns: 8,
  margin: 16,
  gutter: 12,
  headerHeight: 64,
  header: {
    siteName: "सरोहा बुलेटिन",
    tagline: "हिन्दी दैनिक",
    url: "www.sarohabulletin.in",
    sectionName: "बिजनौर बुलेटिन",
    dateLine: "सहारनपुर, गुरुवार, 08 अक्टूबर 2026",
    pageNo: "2",
    edition: "सहारनपुर संस्करण",
    cities: "सहारनपुर, मुरादाबाद, बिजनौर, देहरादून, यमुनानगर से प्रकाशित हिन्दी दैनिक",
    rni: "RNI:UPHIN/2006/20179",
    volume: "वर्ष: 20",
    issue: "अंक: 265",
    price: "मूल्य: 02 रूपया",
    earHeadline: "टीवी को 'डस्टबिन मीडियम' कहने पर *रोहित रॉय* ने दी सफाई",
  },
};

/** Fill in fields that projects saved before page templates existed do not have. */
export function normalizePage(p: Partial<PageConfig> | undefined): PageConfig {
  const out = { ...DEFAULT_PAGE, ...p, header: { ...DEFAULT_PAGE.header, ...p?.header } };
  // projects saved at the old size move to the press size
  if (out.width === LEGACY_SIZE.width && out.height === LEGACY_SIZE.height) {
    out.width = DEFAULT_PAGE.width;
    out.height = DEFAULT_PAGE.height;
  }
  return out;
}

export function colWidth(p: PageConfig): number {
  return (p.width - 2 * p.margin - (p.columns - 1) * p.gutter) / p.columns;
}

/** x offset of grid column `i` (0-based) */
export function colX(p: PageConfig, i: number): number {
  return p.margin + i * (colWidth(p) + p.gutter);
}

/** width of a box spanning `n` columns */
export function spanWidth(p: PageConfig, n: number): number {
  return n * colWidth(p) + (n - 1) * p.gutter;
}

export function contentTop(p: PageConfig): number {
  return p.margin + p.headerHeight + p.gutter;
}

export function contentBottom(p: PageConfig): number {
  return p.height - p.margin;
}
