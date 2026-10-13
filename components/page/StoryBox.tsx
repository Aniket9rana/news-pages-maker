import type { CSSProperties } from "react";
import type { FitParams, PageKind, Story, StoryImage } from "@/lib/types";
import { PALETTE, lerp, resolveStyle } from "@/lib/layout/tiers";
import { profileFor } from "@/lib/layout/profiles";
import { deckBullets, parseHeadline } from "@/lib/headline";
import { CAPTION_H, IMG_GAP } from "@/lib/layout/fit";

interface Props {
  story: Story;
  cols: number;
  width: number;
  /** fixed box height; omit when measuring natural text height */
  height?: number;
  fit: FitParams;
  colorKey: string;
  gutter: number;
  /** page type: decides the tier tweaks (headline style, photo allowance) */
  kind?: PageKind;
  selected?: boolean;
  onSelect?: () => void;
}

function Pic({ img, height }: { img: StoryImage; height: number }) {
  return (
    <div className={`sb-img ${img.cutout ? "sb-img-cut" : ""}`} style={{ height }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img.src} alt={img.caption} style={img.cutout ? undefined : { objectPosition: `${img.focalX * 100}% ${img.focalY * 100}%` }} draggable={false} />
    </div>
  );
}

export function StoryBox({ story, cols, width, height, fit, colorKey, gutter, kind, selected, onSelect }: Props) {
  const profile = profileFor(kind);
  const tier = profile.tiers[story.score];
  const style0 = resolveStyle(story, profile.tiers);
  const color = PALETTE[colorKey]?.hex ?? "#222";
  const bullets = deckBullets(story.subhead);
  const headPx = lerp(tier.headline[0], tier.headline[1], fit.t);
  const bodyPx = lerp(tier.body[0], tier.body[1], fit.t);
  const leading = lerp(1.4, 1.52, Math.min(fit.t, 1)) + fit.lead;
  const images = story.images.slice(0, fit.imgCount);
  const hasCaption = images.some((i) => i.caption.trim());
  const imgAreaH = Math.max(0, fit.imgHeight - IMG_GAP - (hasCaption ? CAPTION_H : 0));
  const mode = images.length ? (fit.mode ?? "row") : "row";
  const overlay = mode === "overlay";
  const inset = mode === "inset";
  const row = images.length > 0 && !overlay && !inset;
  // highlighted words: red on black/blue/green type, black on red type, yellow on a colour block
  const hlColor =
    overlay || style0.headline === "chip" ? "#ffe14d" : style0.headline === "text" && colorKey === "red" ? "#141414" : "#c8102e";

  const style: CSSProperties = { width, height, ["--accent" as string]: color };
  const headStyle: CSSProperties = { fontSize: headPx };
  if (overlay) {
    headStyle.color = "#fff";
  } else if (style0.headline === "chip") {
    headStyle.background = color;
    headStyle.color = "#fff";
  } else if (style0.headline === "text") {
    headStyle.color = color;
  }

  const kicker = story.kicker?.trim() ? (
    <div className="sb-kicker" style={{ background: color, fontSize: lerp(11, 14, Math.min(fit.t, 1)) }}>
      <span>{story.kicker}</span>
    </div>
  ) : null;
  const headline = (
    <h2 className={`sb-head sb-head-${overlay ? "overlay" : style0.headline}`} style={headStyle}>
      {parseHeadline(story.headline).map((part, i) =>
        part.hl ? (
          <span key={i} style={{ color: hlColor }}>
            {part.text}
          </span>
        ) : (
          part.text
        ),
      )}
    </h2>
  );
  const deck = bullets ? (
    <ul className="sb-deck" style={{ fontSize: Math.max(11, bodyPx + 1), ["--bullet" as string]: "#c8102e" }}>
      {bullets.map((b, i) => (
        <li key={i}>{b}</li>
      ))}
    </ul>
  ) : (
    story.subhead.trim() && (
      <p className="sb-sub" style={{ fontSize: Math.max(11, bodyPx + 1) }}>
        {story.subhead}
      </p>
    )
  );

  return (
    <article
      className={`sb ${style0.boxed ? "sb-boxed" : ""} ${selected ? "sb-selected" : ""}`}
      style={style}
      data-story-id={story.id}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      {overlay ? (
        <div className="sb-ov-wrap" style={{ paddingBottom: IMG_GAP }}>
          <div className={`sb-overlay ${images[0].cutout ? "sb-overlay-cut" : ""}`} style={{ minHeight: imgAreaH }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[0].src}
              alt={images[0].caption}
              style={images[0].cutout ? undefined : { objectPosition: `${images[0].focalX * 100}% ${images[0].focalY * 100}%` }}
              draggable={false}
            />
            <div className="sb-ov-text">
              {kicker}
              {headline}
            </div>
          </div>
          {hasCaption && (
            <div className="sb-cap" style={{ height: CAPTION_H }}>
              {images[0].caption}
            </div>
          )}
        </div>
      ) : (
        <>
          {kicker}
          {headline}
        </>
      )}
      {deck}
      {row && (
        <div className="sb-imgs" style={{ height: fit.imgHeight, columnGap: gutter, paddingTop: IMG_GAP }}>
          {images.map((img) => (
            <figure key={img.id} className="sb-fig">
              <Pic img={img} height={imgAreaH} />
              {hasCaption && (
                <figcaption className="sb-cap" style={{ height: CAPTION_H }}>
                  {img.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      )}
      {story.byline.trim() && (
        <div className="sb-byline">
          <span>{story.byline}</span>
        </div>
      )}
      <div
        className="sb-body"
        style={{ fontSize: bodyPx, lineHeight: leading, columnCount: cols, columnGap: gutter }}
      >
        {inset && (
          <figure className="sb-inset" style={{ height: fit.imgHeight }}>
            <Pic img={images[0]} height={imgAreaH} />
            {hasCaption && (
              <figcaption className="sb-cap" style={{ height: CAPTION_H }}>
                {images[0].caption}
              </figcaption>
            )}
          </figure>
        )}
        {story.dateline.trim() && <strong className="sb-dateline">{story.dateline} </strong>}
        {story.body}
      </div>
    </article>
  );
}
