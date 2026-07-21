# Second Word competition-readiness ledger

Audited against `../01-COMPETITION-BRIEF.md` on 2026-07-20. This is a proof
ledger, not a launch claim: a green item has evidence; a yellow item needs a
specific manual or external step; red means the entry cannot honestly claim it.

## Product outcome

Second Word exists to make a faithful response possible at the point words are
about to be sent. It does not correct grammar or replace a person's voice. It
makes a local, explainable pause; verifies a relevant passage with YouVersion;
asks one relational question; and offers an optional rewrite that preserves the
person's agency. The desired impact is fewer wounds, more repair, harder truth
without contempt, and gratitude in moments of victory.

## Technical proof

| Requirement | Status | Evidence |
| --- | --- | --- |
| Scripture comes from YouVersion, not a model | Green | `YouVersionClient` is the only text source; strict `GlooAnalysisSchema` rejects `verse_text`; `test/contracts.test.ts`. |
| Passage and publisher attribution are verified | Green | `runAnalyze` and `/v1/epigraph` fail closed when Bible metadata is unavailable; `test/analyze.test.ts`; deployed `npm run preflight`. |
| Translation setting is licence-safe | Green | `/v1/bibles` serves only the app's YouVersion entitlement; when collection discovery is unavailable it exposes the independently verified configured version rather than inventing choices. Live endpoint returns NIV (111). |
| Draft/rewrite integrity | Green | Signed analysis token binds the draft and optional received message; tampered rewrite is rejected by `npm run preflight`. |
| Request/privacy boundary | Green | No request-body logging; schema is strict; real byte limit rejects streamed requests without `content-length`; `test/request-boundary.test.ts`. |
| Distributed abuse protection | Yellow | The browser scheduler limits ordinary use and the Worker has an 8 KiB body boundary, but no Cloudflare Rate Limiting/KV/DO namespace is provisioned for a true cross-isolate per-client quota. Add and load-test that binding before any broad public launch. |
| In-context extension artifact | Green, package-level | `npm run preflight:extension` checks the built MV3 artifact, production endpoint, consent copy, and Living Margin bundle. |
| Living Margin safety | Green, automated | CSS Custom Highlights only; it inserts no nodes or text, clears on the next edit, and falls back silently; `test/moment-marker.test.ts` and `test/content-ambient.test.ts`. |
| Safety Scripture is contextual and non-repeating | Green, automated | Four existing safety flags map to curated multi-reference sets; recent reference IDs stay in local extension storage; YouVersion verifies text and attribution; failure renders no substitute Scripture; `test/contracts.test.ts`, `test/analyze.test.ts`, and `test/content-ambient.test.ts`. This is a competition reflection demo, not an emergency service. |
| Sandbox and deployed Worker | Green | `npm run verify:all`, then `npm run preflight` against `https://second-word.nkosithrifts.workers.dev`; the live preflight is the authoritative deployment proof. |
| Impact is broader than correction | Green | Deployed preflight verifies angry, grateful/victorious, and disappointed drafts each receive verified Scripture before its signed rewrite/tamper checks. |
| Gloo adapter protocol | Green, mocked | `test/gloo.test.ts` verifies OAuth client credentials, token caching, documented `/ai/v2/chat/completions`, and a required `select_reviewed_scripture` tool call with strict structured arguments. |

## Competition gates still open

| Requirement | Status | Exact completion evidence needed |
| --- | --- | --- |
| **Live Gloo AI Studio** | **Red: credentials pending** | Set the Gloo secrets and provider configuration; `REQUIRE_GLOO=1 npm run preflight` must pass against production. Do not claim live Gloo until then. The adapter defaults now match current official docs, but a mock cannot prove organisation entitlement or a live model response. |
| YouVersion Highlights data exchange | Yellow | The documented flow requires an authenticated YouVersion user bearer token to create a five-minute, single-use exchange token, then a configured callback receives approval. Implement that user-auth/callback path and create/read a user highlight; film it appearing in the real YouVersion account. This is the strongest durable loop, but must not be mocked. |
| One real extension surface | Yellow | Load `extension/dist` in Chrome, open a real Gmail compose, exercise manual reflection, ambient consent, dismiss/reopen, rewrite, and an unsupported-field fallback. Capture the exact browser/version/date. The DOM harness proves logic, not Gmail's live selectors. |
| Public repo contains current code | Yellow | Push `f301fd2`, `d9080b4`, and `17d0a67` (and later commits) to the public `origin/main`; verify the public commit URL. At audit time `origin/main` still resolved to `7686fb2`. |
| Valid Kaggle submission | Red: external deliverables not created here | Public notebook attachment, <=500-word writeup, cover image, public <=3-minute YouTube video, public project link, and final Kaggle submission. |

## Release commands

```sh
npm run verify:all
npm run preflight
REQUIRE_GLOO=1 npm run preflight  # only after real Gloo configuration
```

## Filmable proof sequence

1. Open a real Gmail reply with automatic noticing off; the draft stays local.
2. Write a consequential sentence. Living Margin marks the exact local phrase,
   then the invitation appears without opening a card or blocking Send.
3. Open the card: show the verified reference, full attribution, relational
   question, and optional rewrite. Show that the original is preserved.
4. Change the draft: the marker and invitation disappear immediately.
5. Show the sandbox's gratitude and apology cases to prove the product is not
   only an anger detector.
6. After Gloo is live, show `/health` and the Gloo preflight, then (if built)
   the person explicitly approving a YouVersion Highlight sync.

The video should make one human story memorable. The code and this ledger then
prove that the story is not a mock-up.
