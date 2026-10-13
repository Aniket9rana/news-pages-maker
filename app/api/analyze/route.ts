import { NextResponse } from "next/server";
import { analyzeStory, type StoryInput } from "@/lib/llm";

export const maxDuration = 300;

export async function POST(req: Request) {
  const { stories } = (await req.json()) as { stories: StoryInput[] };
  if (!Array.isArray(stories) || stories.length === 0) {
    return NextResponse.json({ error: "no stories" }, { status: 400 });
  }

  const results: Array<{ id: string; ok: boolean; error?: string; score?: number; category?: string; reason?: string; focal?: Array<{ x: number; y: number }> }> = [];
  // small concurrency so the proxy is not saturated
  const queue = [...stories];
  await Promise.all(
    Array.from({ length: Math.min(3, queue.length) }, async () => {
      for (let s = queue.shift(); s; s = queue.shift()) {
        try {
          const a = await analyzeStory(s);
          results.push({ id: s.id, ok: true, ...a });
        } catch (e) {
          results.push({ id: s.id, ok: false, error: e instanceof Error ? e.message : String(e) });
        }
      }
    }),
  );
  return NextResponse.json({ results });
}
