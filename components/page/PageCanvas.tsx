import type { Layout, PageConfig, Story } from "@/lib/types";
import { StoryBox } from "./StoryBox";
import { HeaderBand, RegistrationMarks } from "./HeaderBand";

interface Props {
  page: PageConfig;
  stories: Story[];
  layout: Layout | null;
  scale?: number;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  marks?: boolean;
}

export function PageCanvas({ page, stories, layout, scale = 1, selectedId, onSelect, marks = true }: Props) {
  const byId = new Map(stories.map((s) => [s.id, s]));
  const placements = layout?.placements ?? [];
  const g = page.gutter;

  return (
    <div className="page-wrap-print" style={{ width: page.width * scale, height: page.height * scale }}>
      <div
        className="page"
        style={{ width: page.width, height: page.height, transform: scale === 1 ? undefined : `scale(${scale})` }}
        onClick={() => onSelect?.(null)}
      >
        <HeaderBand page={page} />
        {marks && <RegistrationMarks page={page} />}

        {/* hairline rules in the gutters, as on the printed page */}
        {placements.map((p) => (
          <div key={`r-${p.storyId}`}>
            {p.x + p.w < page.width - page.margin - 1 && (
              <div className="page-rule" style={{ left: p.x + p.w + g / 2 - 0.25, top: p.y, width: 0.5, height: p.h }} />
            )}
            {p.y + p.h < page.height - page.margin - 1 && (
              <div className="page-rule" style={{ left: p.x, top: p.y + p.h + g / 2 - 0.25, width: p.w, height: 0.5 }} />
            )}
          </div>
        ))}

        {placements.map((p) => {
          const story = byId.get(p.storyId);
          if (!story) return null;
          return (
            <div key={p.storyId} style={{ position: "absolute", left: p.x, top: p.y, width: p.w, height: p.h }}>
              <StoryBox
                story={story}
                cols={p.cols}
                width={p.w}
                height={p.h}
                fit={p.fit}
                colorKey={p.colorKey}
                gutter={g}
                kind={page.kind}
                selected={selectedId === p.storyId}
                onSelect={() => onSelect?.(p.storyId)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
