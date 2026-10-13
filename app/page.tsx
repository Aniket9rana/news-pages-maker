"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageCanvas } from "@/components/page/PageCanvas";
import { Inspector } from "@/components/editor/Inspector";
import { PageSettings } from "@/components/editor/PageSettings";
import { SAMPLE_STORIES } from "@/fixtures/sample-page-2";
import { SAMPLE_FRONT_PAGE, SAMPLE_FRONT_STORIES } from "@/fixtures/sample-front-page";
import { runAutoLayout, refit } from "@/lib/autolayout";
import { inlineImages, thumbnail } from "@/lib/image";
import { DEFAULT_PAGE, normalizePage } from "@/lib/page";
import { plainHeadline } from "@/lib/headline";
import { applyTemplate } from "@/lib/templates";
import { loadProject, saveProject } from "@/lib/storage";
import type { Layout, PageConfig, PageKind, Project, Score, Story } from "@/lib/types";

const blankStory = (): Story => ({
  id: crypto.randomUUID(),
  dateline: "",
  headline: "नई खबर का शीर्षक",
  subhead: "",
  body: "",
  byline: "",
  category: "",
  images: [],
  score: 3,
  scoreSource: "default",
  scoreReason: "",
});

export default function Editor() {
  const [page, setPage] = useState<PageConfig>(DEFAULT_PAGE);
  const [stories, setStories] = useState<Story[]>([]);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seed, setSeed] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [showMarks, setShowMarks] = useState(true);
  const [viewW, setViewW] = useState(900);
  const viewRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const relayoutRef = useRef<(next: Story[], nextSeed: number, label?: string, pageOverride?: PageConfig) => Promise<void>>(undefined);

  // restore the last session
  useEffect(() => {
    loadProject().then((p) => {
      if (p) {
        const np = normalizePage(p.page);
        setPage(np);
        setStories(p.stories);
        // a layout packed for another page size no longer fits: pack again
        if (p.layout && p.page && (p.page.width !== np.width || p.page.height !== np.height) && p.stories.length) {
          setLayout(null);
          relayoutRef.current?.(p.stories, 1, "Fitting saved page to the new size…", np);
        } else setLayout(p.layout);
      }
      setReady(true);
    });
  }, []);

  // autosave
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => saveProject({ id: "current", name: "Untitled page", page, stories, layout }), 600);
    return () => clearTimeout(t);
  }, [ready, page, stories, layout]);

  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    setViewW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const scale = zoom === "fit" ? Math.min(1, (viewW - 48) / page.width) : zoom;
  const selected = useMemo(() => stories.find((s) => s.id === selectedId) ?? null, [stories, selectedId]);

  const relayout = useCallback(
    async (next: Story[], nextSeed: number, label = "Laying out page…", pageOverride?: PageConfig) => {
      setBusy(label);
      try {
        const l = await runAutoLayout(pageOverride ?? page, next, nextSeed);
        setLayout(l);
        setNotice(l.warnings.length ? l.warnings.join(" · ") : null);
      } finally {
        setBusy(null);
      }
    },
    [page],
  );

  relayoutRef.current = relayout;

  /** Edit a story. Text edits re-fit inside the current boxes; score/photo changes re-pack the page. */
  function updateStory(id: string, patch: Partial<Story>, repack = false) {
    const next = stories.map((s) => (s.id === id ? { ...s, ...patch } : s));
    setStories(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (repack || !layout) await relayout(next, seed);
      else setLayout(await refit(page, next, layout));
    }, 450);
  }

  /** Header edits are cosmetic (no re-pack); changing the page type changes the header height, so it re-packs. */
  function updateHeader(patch: Partial<PageConfig["header"]>) {
    setPage((p) => ({ ...p, header: { ...p.header, ...patch } }));
  }

  async function changeKind(kind: PageKind) {
    const next = applyTemplate(page, kind);
    setPage(next);
    if (stories.length) await relayout(stories, seed, "Laying out page…", next);
  }

  function addStory() {
    const s = blankStory();
    const next = [...stories, s];
    setStories(next);
    setSelectedId(s.id);
  }

  function deleteStory(id: string) {
    const next = stories.filter((s) => s.id !== id);
    setStories(next);
    setSelectedId(null);
    if (next.length) relayout(next, seed);
    else setLayout(null);
  }

  /** The bundled sample: the Bijnor front page of 12 Oct 2026, built from the emailed stories and photos. */
  async function loadSample() {
    setBusy("Loading sample page…");
    const p = applyTemplate(normalizePage({ ...DEFAULT_PAGE, header: { ...DEFAULT_PAGE.header, ...SAMPLE_FRONT_PAGE.header } }), SAMPLE_FRONT_PAGE.kind);
    const next = await inlineImages(SAMPLE_FRONT_STORIES);
    setPage(p);
    setStories(next);
    setSelectedId(null);
    await relayout(next, seed, "Laying out page…", p);
  }

  /** The original sample (inner page transcribed from the paper, placeholder photos); also what the packer tests use. */
  async function loadOldSample() {
    setStories(SAMPLE_STORIES);
    setSelectedId(null);
    await relayout(SAMPLE_STORIES, seed);
  }

  async function reflow() {
    const s = seed + 1;
    setSeed(s);
    await relayout(stories, s, "Trying another arrangement…");
  }

  async function analyze(only?: string) {
    const targets = stories.filter((s) => (only ? s.id === only : true) && s.body.trim());
    if (!targets.length) return setNotice("Add story text first.");
    setBusy(only ? "Scoring story…" : `Scoring ${targets.length} stories with AI…`);
    try {
      const payload = await Promise.all(
        targets.map(async (s) => ({
          id: s.id,
          headline: s.headline,
          dateline: s.dateline,
          body: s.body,
          images: await Promise.all(s.images.slice(0, 3).map((i) => thumbnail(i.src))),
        })),
      );
      const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stories: payload }) });
      if (!res.ok) throw new Error(`analyze failed (${res.status})`);
      const { results } = (await res.json()) as {
        results: Array<{ id: string; ok: boolean; error?: string; score?: number; category?: string; reason?: string; focal?: Array<{ x: number; y: number }> }>;
      };
      const errors = results.filter((r) => !r.ok);
      const next = stories.map((s) => {
        const r = results.find((x) => x.id === s.id && x.ok);
        if (!r || s.scoreSource === "editor") return s; // never overwrite an editor's decision
        return {
          ...s,
          score: r.score as Score,
          scoreSource: "ai" as const,
          scoreReason: r.reason ?? "",
          category: r.category ?? "",
          images: s.images.map((img, i) => (r.focal?.[i] ? { ...img, focalX: r.focal[i].x, focalY: r.focal[i].y } : img)),
        };
      });
      setStories(next);
      await relayout(next, seed, "Laying out page…");
      if (errors.length) setNotice(`AI could not score ${errors.length} stor${errors.length > 1 ? "ies" : "y"}: ${errors[0].error}`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ id: "current", name: "page", page, stories, layout } satisfies Project)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "news-page.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importJson(file?: File) {
    if (!file) return;
    const p = JSON.parse(await file.text()) as Project;
    const np = normalizePage(p.page);
    setPage(np);
    setStories(p.stories);
    if (p.layout && (p.page.width !== np.width || p.page.height !== np.height) && p.stories.length) {
      setLayout(null);
      await relayout(p.stories, seed, "Fitting imported page to the new size…", np);
    } else setLayout(p.layout);
  }

  const btn = "rounded border border-[var(--ui-border)] bg-white px-3 py-1.5 text-sm hover:bg-[var(--ui-bg)] disabled:opacity-50";
  const primary = "rounded bg-[var(--ui-accent)] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50";

  return (
    <div className="flex h-screen flex-col">
      <style>{`@media print { @page { size: ${page.width}px ${page.height}px; margin: 0 } }`}</style>

      <header className="no-print flex flex-wrap items-center gap-2 border-b border-[var(--ui-border)] bg-[var(--ui-panel)] px-4 py-2">
        <h1 className="mr-3 text-base font-bold">News Pages Maker</h1>
        <button className={btn} onClick={loadSample}>Load sample page</button>
        <button className={btn} onClick={loadOldSample}>Old sample</button>
        <button className={btn} onClick={addStory}>+ Story</button>
        <button className={primary} disabled={!!busy || !stories.length} onClick={() => analyze()}>Score with AI &amp; lay out</button>
        <button className={btn} disabled={!!busy || !stories.length} onClick={() => relayout(stories, seed)}>Auto layout</button>
        <button className={btn} disabled={!!busy || !stories.length} onClick={reflow}>Re-flow</button>
        <span className="mx-1 h-5 w-px bg-[var(--ui-border)]" />
        <button className={btn} onClick={() => window.print()} disabled={!layout}>Print / Save PDF</button>
        <button className={btn} onClick={exportJson}>Export</button>
        <button className={btn} onClick={() => importRef.current?.click()}>Import</button>
        <input ref={importRef} type="file" accept="application/json" hidden onChange={(e) => importJson(e.target.files?.[0])} />
        <div className="ml-auto flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={showMarks} onChange={(e) => setShowMarks(e.target.checked)} /> marks
          </label>
          <select className="rounded border border-[var(--ui-border)] bg-white px-1 py-1" value={String(zoom)} onChange={(e) => setZoom(e.target.value === "fit" ? "fit" : Number(e.target.value))}>
            <option value="fit">Fit</option>
            <option value="0.5">50%</option>
            <option value="0.75">75%</option>
            <option value="1">100%</option>
          </select>
        </div>
      </header>

      {(busy || notice) && (
        <div className="no-print border-b border-[var(--ui-border)] bg-amber-50 px-4 py-1.5 text-sm">
          {busy ? <span>⏳ {busy}</span> : <span>⚠ {notice}</span>}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="no-print w-72 shrink-0 overflow-y-auto border-r border-[var(--ui-border)] bg-[var(--ui-panel)]">
          <div className="border-b border-[var(--ui-border)] p-3 text-xs font-semibold uppercase tracking-wide text-[var(--ui-muted)]">
            Stories ({stories.length}){layout?.dropped.length ? ` · ${layout.dropped.length} not placed` : ""}
          </div>
          {stories.length === 0 && <p className="p-4 text-sm text-[var(--ui-muted)]">No stories yet. Add one, or load the sample page.</p>}
          {[...stories]
            .sort((a, b) => b.score - a.score)
            .map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`flex w-full items-start gap-2 border-b border-[var(--ui-border)] px-3 py-2 text-left text-sm hover:bg-[var(--ui-bg)] ${selectedId === s.id ? "bg-[var(--ui-bg)]" : ""}`}
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[var(--ui-accent)] text-xs font-bold text-white">{s.score}</span>
                <span className="min-w-0">
                  <span className="line-clamp-2 font-[family-name:var(--font-body)] font-semibold">{plainHeadline(s.headline)}</span>
                  <span className="text-xs text-[var(--ui-muted)]">
                    {s.images.length} photo{s.images.length === 1 ? "" : "s"} · {s.body.length} chars{layout?.dropped.includes(s.id) ? " · not placed" : ""}
                  </span>
                </span>
              </button>
            ))}
        </aside>

        <main ref={viewRef} className="min-w-0 flex-1 overflow-auto p-6" onClick={() => setSelectedId(null)}>
          {layout ? (
            <PageCanvas page={page} stories={stories} layout={layout} scale={scale} selectedId={selectedId} onSelect={setSelectedId} marks={showMarks} />
          ) : (
            <div className="mx-auto mt-24 max-w-md text-center text-[var(--ui-muted)]">
              <p className="text-lg font-semibold text-[var(--ui-ink)]">Your page will appear here</p>
              <p className="mt-1 text-sm">Add stories with photos, then press “Score with AI &amp; lay out”. Or load the sample page to see how it works.</p>
            </div>
          )}
        </main>

        <aside className="no-print w-96 shrink-0 overflow-y-auto border-l border-[var(--ui-border)] bg-[var(--ui-panel)]">
          {selected ? (
            <Inspector
              key={selected.id}
              story={selected}
              onChange={(patch, repack) => updateStory(selected.id, patch, repack)}
              onDelete={() => deleteStory(selected.id)}
              onAnalyze={() => analyze(selected.id)}
              analyzing={!!busy}
            />
          ) : (
            <PageSettings page={page} onKind={changeKind} onHeader={updateHeader} />
          )}
        </aside>
      </div>
    </div>
  );
}
