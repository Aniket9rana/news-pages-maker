"use client";

import { useRef } from "react";
import type { Score, Story } from "@/lib/types";
import { fileToStoryImage } from "@/lib/image";
import { TIERS } from "@/lib/layout/tiers";

interface Props {
  story: Story;
  onChange: (patch: Partial<Story>, relayout?: boolean) => void;
  onDelete: () => void;
  onAnalyze: () => void;
  analyzing: boolean;
}

const field = "w-full rounded border border-[var(--ui-border)] bg-white px-2 py-1.5 text-sm outline-none focus:border-[var(--ui-accent)]";
const label = "mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--ui-muted)]";

export function Inspector({ story, onChange, onDelete, onAnalyze, analyzing }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  async function addImages(files: FileList | null) {
    if (!files?.length) return;
    const added = await Promise.all(Array.from(files).map(fileToStoryImage));
    onChange({ images: [...story.images, ...added] }, true);
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">Story</h3>
        <button onClick={onDelete} className="text-xs text-red-700 hover:underline">
          Delete
        </button>
      </div>

      <div>
        <span className={label}>Importance</span>
        <div className="flex gap-1">
          {([5, 4, 3, 2, 1] as Score[]).map((n) => (
            <button
              key={n}
              onClick={() => onChange({ score: n, scoreSource: "editor" }, true)}
              title={TIERS[n].name}
              className={`flex-1 rounded border px-1 py-1.5 text-xs font-semibold ${
                story.score === n ? "border-[var(--ui-accent)] bg-[var(--ui-accent)] text-white" : "border-[var(--ui-border)] bg-white"
              }`}
            >
              {n}
              <span className="block text-[10px] font-normal opacity-80">{TIERS[n].name}</span>
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-[var(--ui-muted)]">
          {story.scoreSource === "ai" ? "AI score" : story.scoreSource === "editor" ? "Set by editor" : "Default"}
          {story.scoreReason ? ` — ${story.scoreReason}` : ""}
        </p>
        <button
          onClick={onAnalyze}
          disabled={analyzing}
          className="mt-1 rounded border border-[var(--ui-border)] bg-white px-2 py-1 text-xs hover:bg-[var(--ui-bg)] disabled:opacity-50"
        >
          {analyzing ? "Analysing…" : "Score this story with AI"}
        </button>
      </div>

      <div>
        <label className={label}>Kicker (optional)</label>
        <input className={field} value={story.kicker ?? ""} onChange={(e) => onChange({ kicker: e.target.value })} />
      </div>
      <div>
        <label className={label}>Headline — wrap words in *stars* to colour them</label>
        <textarea className={field} rows={2} value={story.headline} onChange={(e) => onChange({ headline: e.target.value })} />
      </div>
      <div>
        <label className={label}>Sub-headline (one line per ■ bullet)</label>
        <textarea className={field} rows={2} value={story.subhead} onChange={(e) => onChange({ subhead: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={label}>Headline style</label>
          <select className={field} value={story.headlineStyle ?? "auto"} onChange={(e) => onChange({ headlineStyle: e.target.value as Story["headlineStyle"] }, true)}>
            <option value="auto">Auto (by importance)</option>
            <option value="banner">Banner (black)</option>
            <option value="text">Coloured text</option>
            <option value="chip">Colour block</option>
            <option value="plain">Plain</option>
          </select>
        </div>
        <div>
          <label className={label}>Frame</label>
          <select className={field} value={story.frame ?? "auto"} onChange={(e) => onChange({ frame: e.target.value as Story["frame"] }, true)}>
            <option value="auto">Auto</option>
            <option value="boxed">Boxed</option>
            <option value="open">No box</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={label}>Dateline</label>
          <input className={field} value={story.dateline} onChange={(e) => onChange({ dateline: e.target.value })} />
        </div>
        <div>
          <label className={label}>Byline</label>
          <input className={field} value={story.byline} onChange={(e) => onChange({ byline: e.target.value })} />
        </div>
      </div>
      <div>
        <label className={label}>Body ({story.body.length} chars)</label>
        <textarea className={`${field} font-[family-name:var(--font-body)]`} rows={10} value={story.body} onChange={(e) => onChange({ body: e.target.value })} />
      </div>

      <div>
        <span className={label}>Photos ({story.images.length})</span>
        <select className={`${field} mb-2`} value={story.photoMode ?? "auto"} onChange={(e) => onChange({ photoMode: e.target.value as Story["photoMode"] }, true)}>
          <option value="auto">Layout: auto (by page type)</option>
          <option value="row">Photos in a row under the headline</option>
          <option value="inset">One photo inside the text</option>
          <option value="overlay">Headline over the photo</option>
        </select>
        <div className="space-y-2">
          {story.images.map((img, i) => (
            <div key={img.id} className="flex gap-2 rounded border border-[var(--ui-border)] bg-white p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt="" className="h-14 w-20 rounded object-cover" />
              <div className="min-w-0 flex-1">
                <input
                  className={field}
                  placeholder="Caption"
                  value={img.caption}
                  onChange={(e) => onChange({ images: story.images.map((x) => (x.id === img.id ? { ...x, caption: e.target.value } : x)) })}
                />
                <label className="mt-1 flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={!!img.cutout}
                    onChange={(e) => onChange({ images: story.images.map((x) => (x.id === img.id ? { ...x, cutout: e.target.checked } : x)) }, true)}
                  />
                  Cut-out (transparent PNG, not cropped)
                </label>
                <div className="mt-1 flex gap-2 text-xs">
                  <button
                    disabled={i === 0}
                    onClick={() => {
                      const next = [...story.images];
                      [next[i - 1], next[i]] = [next[i], next[i - 1]];
                      onChange({ images: next }, true);
                    }}
                    className="disabled:opacity-30"
                  >
                    ↑ first
                  </button>
                  <button onClick={() => onChange({ images: story.images.filter((x) => x.id !== img.id) }, true)} className="text-red-700">
                    remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addImages(e.target.files)} />
        <button
          onClick={() => fileRef.current?.click()}
          className="mt-2 w-full rounded border border-dashed border-[var(--ui-border)] bg-white py-2 text-xs hover:bg-[var(--ui-bg)]"
        >
          + Add photos
        </button>
      </div>
    </div>
  );
}
