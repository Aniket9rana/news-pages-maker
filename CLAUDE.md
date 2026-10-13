# CLAUDE.md

AI-assisted layout tool for a Hindi daily newspaper page (Saroha Bulletin, Bijnor edition). The editor adds stories (text + photos), an LLM scores each 1–5 for importance, and a layout engine fills an 8-column page edge to edge, giving important stories more space, bigger headlines and photos.

## Repo
Public GitHub repo: https://github.com/Aniket9rana/news-pages-maker (branch `main`). It is public, so never commit `.env.local` or keys. `public/sample/` holds real photos and `fixtures/` holds verbatim news text from the newspaper's emails.

## Commands
- `npm run dev` — dev server on **port 3100**
- `npm test` — Vitest packer tests (`tests/pack.test.ts`)
- `npx tsc --noEmit` — typecheck (run before finishing any change)
- `npx next build` — production build
- `node scripts/cutout.mjs <out.png> [page type] [story id]` — dev server running. Generates a transparent PNG, uploads it through the real Inspector input, makes it the story's first photo and screenshots (defaults: feature page, lead story, so the overlay + cut-out path). Prints whether the cut-out flag/overlay classes are set.
- `node scripts/shot.mjs <out.png> [front|regional|business|…]` — needs the dev server running. Loads the sample page (the 12 Oct 2026 front page) in headless Chrome (`/Applications/Google Chrome.app`, via `puppeteer-core`), saves a screenshot, prints per-story photo count / slack px and which boxes overflow. Use it to verify any layout change visually.

## Stack
Next.js 16 (App Router), React 19, TypeScript strict, Tailwind 4, Vitest, `idb-keyval` (autosave), `zod`. Mirrors the sibling `kuku-director` app. Path alias `@/*` → project root. The npm install blocks lifecycle scripts by default (`allowScripts` warnings are expected).

## Architecture
```
app/page.tsx              editor UI (single page): story list, page canvas, inspector, toolbar
app/api/analyze/route.ts  POST {stories[]} → importance scores (3 concurrent), server-only
lib/llm.ts                LiteLLM client: prompt, JSON schema, retries, error unwrapping
lib/types.ts              Story, Placement, Layout, PageConfig, FitParams
lib/page.ts               DEFAULT_PAGE geometry + column helpers (colX, spanWidth, contentTop…)
lib/layout/tiers.ts       the 5 importance tiers (cols, headline px/style, photos, body px), resolveStyle (editor override > tier), colour PALETTE (red/blue/green/black house colours)
lib/layout/profiles.ts    per-page-type layout profile: tier tweaks, default photo mode per tier, photo growth; modeFor() = editor override > profile
lib/headline.ts           *star* highlight markup in headlines, ■ bullet decks
lib/templates.ts          page types (front, regional, feature, opinion, business, sports, world): header band kind + height, section names
lib/layout/pack.ts        Packer: guillotine-tree search (random restarts + subtree mutation), then `tuneCuts` (nudges every horizontal cut by 64..4px, keeps moves that lower the tree cost, so space moves from boxes with spare room to their neighbours), + assignColors
lib/layout/fit.ts         fitStory: fills a box exactly; Metrics interface; AnalyticMetrics (tests only)
lib/layout/measure.ts     DomMetrics: measures real rendered text in the browser; ensureFonts
lib/autolayout.ts         runAutoLayout (pack + fit, several seeds) and refit (keep boxes, re-fit text)
components/page/*         StoryBox (the ONE renderer used for both measuring and display), HeaderBand (front masthead / slim strip / business ticker), PageCanvas
components/editor/*       Inspector (story, right panel), PageSettings (right panel when no story is selected)
fixtures/sample-front-page.ts the "Load sample page" content: Bijnor front page of 12 Oct 2026, 7 stories from Rajdeep Debnath's emails, text verbatim, real photos in public/sample/saroha-2026-10-12 (inlined to data URLs on load by inlineImages in lib/image.ts); header config in SAMPLE_FRONT_PAGE
fixtures/sample-page-2.ts the old sample ("Old sample" button, packer tests): headlines transcribed from the paper, placeholder SVG photos
```

## Rules that matter
- **Measure with the DOM, never estimate.** Devanagari shaping only comes out right in the browser. `DomMetrics` renders the real `StoryBox`, so `StoryBox` is the single source of truth for markup/CSS. Any change to its markup or to `.sb*` CSS in `app/globals.css` changes measured heights; re-run `shot.mjs` and confirm `overflowing: none`.
- **Photo modes** (`FitParams.mode`): `row` (photos under the headline), `inset` (one photo at the top of the first text column, inside the multicol flow) and `overlay` (headline set over a wide photo; a transparent-PNG cut-out gets a colour block behind it instead). Only `row` is "text height + photo height"; for the others `fitStory` measures the whole box via `Metrics.boxHeight`, so any change to the inset/overlay markup or `.sb-inset`/`.sb-overlay*` CSS changes measured heights. If the preferred mode cannot fit, `fitStory` falls back to a plain row and then to no photo. The packer only estimates photo height (`extraHeight`: inset = photo/cols, overlay = 0.6 x photo); the fitter is exact. Once type is at full size a photo may grow past its usual max by `OVERGROW[mode]` in `fit.ts` (row 1.3, inset 1.5, overlay 1) to soak up spare room; `Packer.photoExtra` reads the same table, so change it only there.
- **Fit order is deliberate** (`fitStory`): photo height → type size (`t`, up to `T_MAX` 1.4) → body leading (`lead`, up to `LEAD_MAX`), and photos are dropped before type goes below the tier minimum. Fit params are quantised to 3 decimals and the measurement cache key uses `toFixed(5)`; do not round the cache key coarser, because a coarse key made a box overflow by 17px.
- **Pack cost lives in `Packer.leafCost` / `treeCost`.** Tier-5 story must open the page (hard top penalty), lower-score stories never get more area than higher ones, and when over-full, minor stories shrink first (the `exps` weights in `prepare`). Check the tests and a screenshot after changing any weight. The "lower score never gets more area" pairwise term (weight 12) must stay strong: `tuneCuts` optimises the cost exactly, and with the old weight (2) it traded the lead's area to a tier-4 story.
- `AnalyticMetrics` is an approximation used only by Vitest; real layout always uses `DomMetrics`.
- **Layout seed choice counts empty space** (`runAutoLayout` in `lib/autolayout.ts`): the penalty is overflow, lost photos and white space inside boxes (`fittedHeight` in `fit.ts` vs box height). It used to stop at the first seed with no overflow, which left 1000px-tall empty boxes when a page had little copy. Keep slack in the penalty when changing it.
- **News text is never edited** when building pages from emails: only split into dateline/byline/deck/caption fields. Too many stories for a page means leaving some out (or a second page), not trimming copy.
- Editor scores win: AI scoring skips stories where `scoreSource === 'editor'`.
- Hindi must be Unicode. The source PDF uses a legacy Kruti-Dev-style font, so its text layer cannot be copied.
- Page size is the press size, **32.9 × 52.0 cm = 1243 × 1965 CSS px at 96 dpi** (ratio 0.633, 8 columns; `PAGE_CM` in `lib/page.ts`). It was 1200×1696 (measured from a render of the sample page) before; `normalizePage` moves old saved projects to the new size and the editor re-packs them. Type sizes in `tiers.ts` are tuned at 1 px = 1/96 in, so a size change should keep that scale. Change geometry only in `DEFAULT_PAGE`; print `@page` and the canvas both read `page.width/height`.

- **Page type changes the header height**, so `contentTop` and the packed area change: switching type re-packs (`changeKind` in `app/page.tsx`). Projects saved before templates existed are filled in by `normalizePage`; new `Story` fields (`kicker`, `headlineStyle`, `frame`) are optional for the same reason, and the measurement cache key includes them.
- Headline style defaults come from the tier (5 = black banner, 4/3/2 = coloured text, 1 = plain); solid colour blocks (`chip`) are an editor override only, because the sample paper rarely uses them.

## LLM / LiteLLM (copied from `nodes/kuku-jarvis`; see its `docs/architecture/llm-and-prompts.md`)
- Env in `.env.local` (git-ignored, never print or commit the key): `LITELLM_API_KEY`, `LITELLM_BASE_URL` (default `https://aiadda.kukufm.com/api/litellm/v1`), `LLM_MODEL` (default `anthropic/claude-sonnet-5`).
- Do NOT use a bare `litellm.kukufm.com` host; it is unreachable.
- Claude Sonnet 5 requests send `thinking: {type: "disabled"}`, otherwise the proxy sends no bytes while it thinks. Sonnet/Opus 5.5 reject `disabled`, so change `lib/llm.ts` first if the model moves.
- Structured output uses `output_format` + `anthropic-beta: structured-outputs-2025-11-13`, not `response_format` (emulated and unreliable on this proxy). The schema must have `additionalProperties: false`. The output is still validated with zod and retried.
- Needs the company network/VPN. There is no LLM failover; manual scoring always works.

## Status / not built yet
Photo that spans the middle of a multi-column story with text either side (page 1 style), furniture (briefs column, pull-quote, notice and imprint boxes), per-template tier tweaks, multi-page editions, drag/resize of boxes on the page, a server-side PDF export route (currently browser print dialog, RGB only), CMYK conversion, saving several pages/editions. Known gaps: fetching the emails and photos is manual (Gmail connector has no attachment download; photos were saved from Gmail in Chrome and copied into public/sample); the sample's issue/volume numbers are blank because they are not known; after `tuneCuts` every page type's boxes are within about 35px of full except opinion on the 7-story sample, where one short story still has about 170px spare (needs a pull-quote or other filler, i.e. furniture); opinion tier 3/2 stories carry a small columnist-portrait inset to soak up space; cut-out + overlay was checked in the browser with `scripts/cutout.mjs` (generated PNG: colour block behind, figure bottom-right, headline in the left 62%), a real photo cut-out is still worth one look; the editor's selection outline (3px inset) is drawn over the first letters of a selected box; Chrome has no Hindi hyphenation, so narrow justified columns can have loose lines.
