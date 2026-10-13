import type { PageConfig } from "@/lib/types";
import { colX, spanWidth } from "@/lib/page";
import { parseHeadline } from "@/lib/headline";
import { DEFAULT_TICKER, STRIP_H, TEMPLATES, TICKER_H } from "@/lib/templates";

/** Page header: full masthead on the front page, a slim band (plus a ticker on business) on inner pages. */
export function HeaderBand({ page }: { page: PageConfig }) {
  return TEMPLATES[page.kind].header === "masthead" ? <Masthead page={page} /> : <StripHeader page={page} />;
}

/** Front page: small info line, big logo (+ promo ear), then a dateline/price strip. */
function Masthead({ page }: { page: PageConfig }) {
  const { header } = page;
  const w = page.width - 2 * page.margin;
  const earW = spanWidth(page, 2);
  const date = [header.dateLine, header.volume, header.issue, header.pageNo && `पृष्ठ: ${header.pageNo.padStart(2, "0")}`, header.price]
    .filter(Boolean)
    .join("  |  ");
  return (
    <div className="mast" style={{ left: page.margin, top: page.margin, width: w, height: page.headerHeight }}>
      <div className="mast-top">
        <div>
          <div>{header.edition}</div>
          <div>{header.rni}</div>
        </div>
        <div className="mast-url">{header.url}</div>
        <div className="mast-cities">{header.cities}</div>
      </div>
      <div className="mast-row">
        <div className="mast-logo" style={{ fontSize: header.earHeadline?.trim() ? 140 : 158 }}>
          <span>{header.siteName}</span>
        </div>
        {header.earHeadline?.trim() && (
          <div className="mast-ear" style={{ width: earW }}>
            {parseHeadline(header.earHeadline).map((p, i) => (
              <span key={i} className={p.hl ? "hl" : undefined}>
                {p.text}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="mast-date">{date}</div>
    </div>
  );
}

/** Inner pages: logo (2 cols) | section banner (4 cols) | date + page number (2 cols), then the business ticker. */
function StripHeader({ page }: { page: PageConfig }) {
  const top = page.margin;
  const { header } = page;
  const left = 2;
  const mid = page.columns - 4;
  const ticker = header.ticker ?? DEFAULT_TICKER;
  return (
    <>
      <div className="hdr hdr-logo" style={{ left: colX(page, 0), top, width: spanWidth(page, left), height: STRIP_H }}>
        <div className="site" style={{ fontSize: 30 }}>{header.siteName}</div>
        <div className="tag">{header.tagline}</div>
      </div>
      <div className="hdr hdr-banner" style={{ left: colX(page, left), top, width: spanWidth(page, mid), height: STRIP_H, fontSize: 40 }}>
        {header.sectionName}
      </div>
      <div className="hdr hdr-date" style={{ left: colX(page, left + mid), top, width: spanWidth(page, 2), height: STRIP_H }}>
        <div className="line">{header.dateLine}</div>
        <div className="no" style={{ fontSize: 46 }}>{header.pageNo}</div>
      </div>
      {page.kind === "business" && (
        <div className="ticker" style={{ left: colX(page, 0), top: top + STRIP_H + page.gutter - 4, width: page.width - 2 * page.margin, height: TICKER_H - 8 }}>
          {[ticker.slice(0, 2), ticker.slice(2, 4)].map((pair, side) => (
            <div key={side} className={`ticker-side ${side ? "ticker-right" : ""}`}>
              {pair.map((t) => (
                <div key={t.label}>
                  <span className="tk-label">{t.label}</span>
                  <span className="tk-value">{t.value}</span>
                </div>
              ))}
            </div>
          ))}
          <div className="ticker-title" style={{ order: 1 }}>व्यापार</div>
        </div>
      )}
    </>
  );
}

const MARKS = ["#00aeef", "#ec008c", "#fff200", "#000"];

export function RegistrationMarks({ page }: { page: PageConfig }) {
  return (
    <>
      {MARKS.map((c, i) => (
        <div key={`l${i}`} className="reg-mark" style={{ left: 3 + i * 10, top: 3, background: c, border: "0.5px solid #888" }} />
      ))}
      {MARKS.map((c, i) => (
        <div
          key={`r${i}`}
          className="reg-mark"
          style={{ left: page.width - 43 + i * 10, top: 3, background: c, border: "0.5px solid #888" }}
        />
      ))}
    </>
  );
}
