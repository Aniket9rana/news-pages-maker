"use client";

import type { PageConfig, PageKind, TickerItem } from "@/lib/types";
import { DEFAULT_TICKER, TEMPLATES } from "@/lib/templates";

interface Props {
  page: PageConfig;
  onKind: (kind: PageKind) => void;
  onHeader: (patch: Partial<PageConfig["header"]>) => void;
}

const field = "w-full rounded border border-[var(--ui-border)] bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--ui-accent)]";
const label = "mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--ui-muted)]";

export function PageSettings({ page, onKind, onHeader }: Props) {
  const h = page.header;
  const ticker: TickerItem[] = h.ticker ?? DEFAULT_TICKER;
  const text = (k: keyof PageConfig["header"], title: string) => (
    <div>
      <label className={label}>{title}</label>
      <input className={field} value={(h[k] as string | undefined) ?? ""} onChange={(e) => onHeader({ [k]: e.target.value })} />
    </div>
  );
  return (
    <div className="space-y-3 p-4">
      <h3 className="text-sm font-bold">Page</h3>
      <div>
        <label className={label}>Page type</label>
        <select className={field} value={page.kind} onChange={(e) => onKind(e.target.value as PageKind)}>
          {Object.values(TEMPLATES).map((t) => (
            <option key={t.kind} value={t.kind}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      {TEMPLATES[page.kind].header === "strip" && text("sectionName", "Section name")}
      {text("dateLine", "Date line")}
      <div className="grid grid-cols-2 gap-2">
        {text("pageNo", "Page no.")}
        {text("price", "Price")}
      </div>
      {page.kind === "front" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {text("volume", "Volume")}
            {text("issue", "Issue")}
          </div>
          {text("edition", "Edition")}
          {text("rni", "RNI")}
          {text("cities", "Published from")}
          <div>
            <label className={label}>Promo box (top right) — wrap words in *stars* to colour them</label>
            <textarea className={field} rows={3} value={h.earHeadline ?? ""} onChange={(e) => onHeader({ earHeadline: e.target.value })} />
          </div>
        </>
      )}
      {page.kind === "business" && (
        <div>
          <span className={label}>Ticker</span>
          <div className="space-y-1">
            {ticker.map((t, i) => (
              <div key={i} className="grid grid-cols-[5rem_1fr] gap-1">
                <input className={field} value={t.label} onChange={(e) => onHeader({ ticker: ticker.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                <input className={field} value={t.value} onChange={(e) => onHeader({ ticker: ticker.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-[var(--ui-muted)]">Select a story on the page to edit it.</p>
    </div>
  );
}
