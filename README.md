# News Pages Maker

AI-assisted layout for a Hindi daily newspaper page (8-column grid, matched to the Saroha Bulletin sample).

Add stories (headline, dateline, byline, body, photos) → each story is scored 1–5 for importance by an LLM
(through the LiteLLM proxy used by kuku-jarvis) → the layout engine gives important stories more space,
bigger headlines and photos, and fills the page edge to edge → edit, re-flow, and print / save as PDF.

## Run
    npm install
    npm run dev        # http://localhost:3100
    npm test           # packer unit tests

`.env.local` (git-ignored) needs `LITELLM_API_KEY`; optional `LITELLM_BASE_URL`, `LLM_MODEL`.

## How it works
- `lib/layout/tiers.ts`  – the five importance tiers (columns, headline size/style, photos, body size)
- `lib/layout/pack.ts`   – guillotine-tree packer: random restarts + subtree-mutation search over a cost function
- `lib/layout/fit.ts`    – fills each box exactly: photo size → type size → leading; drops photos before shrinking type
- `lib/layout/measure.ts`– measures real rendered Devanagari text in the browser (DOM is the source of truth)
- `lib/llm.ts`, `app/api/analyze/route.ts` – importance scoring via LiteLLM (server only)
- `scripts/shot.mjs`     – dev helper: screenshots the sample page with headless Chrome and reports overflow/slack
