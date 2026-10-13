export type Score = 1 | 2 | 3 | 4 | 5;

/** banner = big black headline, text = coloured headline, chip = reversed out of a colour block, plain = small black */
export type HeadlineStyle = "banner" | "text" | "chip" | "plain";

/** row = photos side by side under the headline; inset = one photo at the top of the first text column; overlay = headline set over a wide photo */
export type PhotoMode = "row" | "inset" | "overlay";

/** Page templates, after the sections of the sample paper (each has its own header band). */
export type PageKind = "front" | "regional" | "feature" | "opinion" | "business" | "sports" | "world";

export interface StoryImage {
  id: string;
  /** data URL (resized on upload) so projects are self-contained */
  src: string;
  width: number;
  height: number;
  caption: string;
  /** 0..1 focal point used when cropping (faces stay in frame) */
  focalX: number;
  focalY: number;
  /** transparent PNG with the background removed: shown whole, not cropped */
  cutout?: boolean;
}

export interface Story {
  id: string;
  dateline: string;
  headline: string;
  subhead: string;
  body: string;
  byline: string;
  category: string;
  images: StoryImage[];
  score: Score;
  scoreSource: "ai" | "editor" | "default";
  scoreReason: string;
  /** small label above the headline */
  kicker?: string;
  /** "auto" follows the importance tier */
  headlineStyle?: HeadlineStyle | "auto";
  frame?: "auto" | "boxed" | "open";
  /** "auto" follows the page type's profile for this importance tier */
  photoMode?: PhotoMode | "auto";
}

export interface TickerItem {
  label: string;
  value: string;
}

export interface PageConfig {
  kind: PageKind;
  width: number;
  height: number;
  columns: number;
  margin: number;
  gutter: number;
  headerHeight: number;
  header: {
    siteName: string;
    tagline: string;
    url: string;
    sectionName: string;
    /** e.g. "सहारनपुर, गुरुवार, 08 अक्टूबर 2026" */
    dateLine: string;
    pageNo: string;
    /** front page only */
    edition?: string;
    cities?: string;
    rni?: string;
    volume?: string;
    issue?: string;
    price?: string;
    earHeadline?: string;
    /** business page only: four figures shown either side of the section title */
    ticker?: TickerItem[];
  };
}

/** Knobs the fitter turns so a story exactly fills its rectangle. */
export interface FitParams {
  /** 0..1 interpolates headline/body size and leading between tier min and max; up to 1.4 to absorb spare room */
  t: number;
  /** extra line-height added to the body to absorb the last few px of spare room */
  lead: number;
  /** how many of the story's images are shown */
  imgCount: number;
  /** image row height in px (0 when no images) */
  imgHeight: number;
  /** how the photos are laid out; absent on layouts saved before photo modes existed (= "row") */
  mode?: PhotoMode;
}

export interface Placement {
  storyId: string;
  /** first grid column, 0-based */
  colStart: number;
  cols: number;
  x: number;
  y: number;
  w: number;
  h: number;
  fit: FitParams;
  colorKey: string;
  /** true when text could not be made to fit even at the smallest size */
  overflow: boolean;
}

export interface Layout {
  placements: Placement[];
  /** story ids that did not fit on this page */
  dropped: string[];
  warnings: string[];
  seed: number;
}

export interface Project {
  id: string;
  name: string;
  page: PageConfig;
  stories: Story[];
  layout: Layout | null;
}
