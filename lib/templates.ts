import type { PageConfig, PageKind, TickerItem } from "./types";

export interface PageTemplate {
  kind: PageKind;
  label: string;
  /** masthead = full front-page head; strip = slim inner-page band with the section name */
  header: "masthead" | "strip";
  headerHeight: number;
  /** section banner text for strip pages */
  sectionName: string;
}

/** Height of the slim inner-page band, and of the business ticker that sits under it. */
export const STRIP_H = 64;
export const TICKER_H = 62;

export const TEMPLATES: Record<PageKind, PageTemplate> = {
  front: { kind: "front", label: "Front page", header: "masthead", headerHeight: 262, sectionName: "" },
  regional: { kind: "regional", label: "Regional (बुलेटिन)", header: "strip", headerHeight: STRIP_H, sectionName: "बिजनौर बुलेटिन" },
  feature: { kind: "feature", label: "Feature", header: "strip", headerHeight: STRIP_H, sectionName: "फीचर बुलेटिन" },
  opinion: { kind: "opinion", label: "Opinion", header: "strip", headerHeight: STRIP_H, sectionName: "विचार बुलेटिन" },
  business: { kind: "business", label: "Business", header: "strip", headerHeight: STRIP_H + TICKER_H, sectionName: "व्यापार बुलेटिन" },
  sports: { kind: "sports", label: "Sports", header: "strip", headerHeight: STRIP_H, sectionName: "खेल बुलेटिन" },
  world: { kind: "world", label: "World", header: "strip", headerHeight: STRIP_H, sectionName: "विदेश बुलेटिन" },
};

export const DEFAULT_TICKER: TickerItem[] = [
  { label: "सेंसेक्स", value: "72,638.70 पर बंद" },
  { label: "निफ्टी", value: "22,603.05 पर बंद" },
  { label: "सोना", value: "1,51,745.00" },
  { label: "चांदी", value: "2,26,800" },
];

/** Switch a page to another template: new header band and, if the section name was the old default, the new one. */
export function applyTemplate(page: PageConfig, kind: PageKind): PageConfig {
  const old = TEMPLATES[page.kind];
  const next = TEMPLATES[kind];
  const keepName = page.header.sectionName && page.header.sectionName !== old.sectionName;
  return {
    ...page,
    kind,
    headerHeight: next.headerHeight,
    header: {
      ...page.header,
      sectionName: keepName ? page.header.sectionName : next.sectionName,
      ticker: kind === "business" ? (page.header.ticker ?? DEFAULT_TICKER) : page.header.ticker,
    },
  };
}
