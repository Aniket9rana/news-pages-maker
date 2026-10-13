import { z } from "zod";

const DEFAULT_BASE = "https://aiadda.kukufm.com/api/litellm/v1";

export const AnalysisSchema = z.object({
  score: z.number().int().min(1).max(5),
  category: z.string(),
  reason: z.string(),
  focal: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

const JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["score", "category", "reason", "focal"],
  properties: {
    score: { type: "integer", description: "Importance 1 (brief) to 5 (page lead)" },
    category: { type: "string", description: "crime | politics | accident | civic | education | community | other" },
    reason: { type: "string", description: "One short sentence in Hindi explaining the score" },
    focal: {
      type: "array",
      description: "For each photo, in order: the normalised (0-1) point of main interest (faces) used when cropping",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["x", "y"],
        properties: { x: { type: "number" }, y: { type: "number" } },
      },
    },
  },
};

export const SYSTEM_PROMPT = `You are the news editor of a Hindi daily newspaper (district edition, Bijnor, Uttar Pradesh).
Given one story (headline, dateline, body text and its photos), decide how prominently it should be displayed on the page.

Score 1-5:
5 = page lead. Murder or suspicious death, major violent crime, large disaster, a major political event or protest of state/national significance, strong dramatic photos.
4 = strong story. Notable arrests or loot/robbery busts, big fire or accident with heavy loss, important official or political events with local impact.
3 = medium story. Notable local events, civic problems, awareness drives, community meetings with a decent photo.
2 = short story. Routine local news, memoranda, small incidents, small crime reports.
1 = brief. Statements, notices, small updates with little public impact.

Weigh: severity and human cost, public impact and number of people affected, novelty, local relevance, whether it involves public officials or politics, and photo strength.
Do not inflate scores: a normal page has only one 5 and a couple of 4s. Reply with JSON only. The "reason" must be one short sentence in Hindi (Devanagari).`;

export interface StoryInput {
  id: string;
  headline: string;
  dateline: string;
  body: string;
  /** small JPEG data URLs */
  images: string[];
}

class LlmError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new LlmError("model did not return JSON");
  return JSON.parse(text.slice(start, end + 1));
}

async function callOnce(input: StoryInput, native: boolean, signal: AbortSignal): Promise<Analysis> {
  const key = process.env.LITELLM_API_KEY;
  if (!key) throw new LlmError("LITELLM_API_KEY is not set in .env.local", 401);
  const base = (process.env.LITELLM_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
  const model = process.env.LLM_MODEL || "anthropic/claude-sonnet-5";

  const userContent: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: `Headline: ${input.headline}\nDateline: ${input.dateline}\nPhotos attached: ${input.images.length}\n\nStory:\n${input.body.slice(0, 4000)}`,
    },
    ...input.images.slice(0, 4).map((url) => ({ type: "image_url", image_url: { url } })),
  ];

  const body: Record<string, unknown> = {
    model,
    max_tokens: 600,
    temperature: 0,
    stream: false,
    // Claude Sonnet 5 thinks silently by default; the proxy then sends no headers for minutes.
    thinking: { type: "disabled" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
  };
  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
  if (native) {
    body.output_format = { type: "json_schema", schema: JSON_SCHEMA };
    headers["anthropic-beta"] = "structured-outputs-2025-11-13";
  }

  const res = await fetch(`${base}/chat/completions`, { method: "POST", headers, body: JSON.stringify(body), signal });
  const raw = await res.text();
  if (!res.ok) throw new LlmError(`LiteLLM ${res.status}: ${unwrapError(raw)}`, res.status);
  const data = JSON.parse(raw);
  const content = data?.choices?.[0]?.message?.content;
  const text = Array.isArray(content) ? content.map((c: { text?: string }) => c.text ?? "").join("") : String(content ?? "");
  const parsed = AnalysisSchema.safeParse(extractJson(text));
  if (!parsed.success) throw new LlmError(`unexpected model output: ${parsed.error.issues[0]?.message}`);
  return parsed.data;
}

/** LiteLLM wraps upstream errors in escaped JSON; surface just the useful sentence. */
function unwrapError(raw: string): string {
  try {
    let v: unknown = JSON.parse(raw);
    for (let i = 0; i < 4; i++) {
      const o = v as { error?: unknown; message?: unknown; detail?: unknown };
      const next = o?.error ?? o?.detail ?? o?.message;
      if (next === undefined) break;
      if (typeof next === "string") {
        try {
          v = JSON.parse(next);
          continue;
        } catch {
          return next.split("Traceback")[0].slice(0, 300);
        }
      }
      v = next;
    }
  } catch {
    /* fall through */
  }
  return raw.slice(0, 300);
}

export async function analyzeStory(input: StoryInput): Promise<Analysis> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90_000);
    try {
      return await callOnce(input, attempt === 1 || attempt === 2, ctrl.signal);
    } catch (e) {
      lastErr = e;
      const status = e instanceof LlmError ? e.status : undefined;
      if (status && [400, 401, 403, 422].includes(status) && attempt >= 2) break;
      if (status === 401 || status === 403) break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
