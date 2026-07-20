# Second Word

> Scripture where you already are, which is a text box.

> *All the ways of a man are clean in his own eyes, but the LORD weigheth the spirits.*
> Proverbs 16:2

Nobody carries a Bible to work, and nobody stops mid-email to search for a verse. But
most of the working week happens in a text box: Slack, Teams, WhatsApp, email, a prompt
box at one in the morning. Second Word puts Scripture there.

Once a person explicitly enables automatic noticing, it watches for the moments that
will still matter in a year and stays quiet the rest of the time. Until then it only
reads a draft they choose to reflect on. It never posts, never blocks Send, never edits
without a click, and never writes into the box they are typing in.

Built for the [Scripture in New Frontiers](https://www.kaggle.com/competitions/scripture-in-new-frontiers)
challenge, on the YouVersion Platform API and Gloo AI Studio. MIT licensed.

## Live

- **Sandbox**, no install and no login: https://second-word.pages.dev
- **Worker**: https://second-word.nkosithrifts.workers.dev - `/health`, `/health/upstream`

## Three ideas hold this together

**It should not have to wait to be asked—but that is the person's choice.** The moment
you most need a pause is the moment you are least willing to reach for one, and nobody
presses a button to be reminded to give thanks. So, after explicit opt-in, it looks once
typing settles and a mark appears in the corner of the box. Nothing opens. Clicking it is
still your choice. Automatic detection is not automatic interruption.

**It reads the message you are answering.** Proverbs 16:2 as an architectural argument
rather than a decoration: you cannot weigh yourself. A reply to a rejection is calm on its
face, and the whole weight sits in the letter that arrived. Measured on the evaluation
set, four drafts the model called ordinary became a rejection, a false accusation, a
boundary and a loss the moment it could see what provoked them. Nothing in those drafts
changed.

**The model never writes Scripture, and structurally cannot.** Its schema has no field
that could carry a verse. It selects one principle from a reviewed library of seventeen
and ranks references from that principle's own list; anything outside is dropped before
any fetch happens. The words come from YouVersion, or nothing is shown.

## How a message travels

```
you type -> 800ms idle -> local gate            no network call yet
                             |
                   task talk -> stop, silently
                             |
                   POST /v1/analyze   your draft, and the message you are answering
                             |
              nothing at stake -> stop, and nothing renders at all
                             |
              something at stake -> a mark in the corner of the box
                             |
                        you click -> the passage, one line about it, one question
```

Both gates must agree before anything appears. Either one alone is silence.

## The rules this code enforces

These are not stylistic. They are the product.

1. **The model never produces Scripture.** `GlooAnalysisSchema` is strict and has no
   verse-text field, so a model that tries to hand us Scripture fails validation rather
   than being cleaned up afterwards. Verse text can only enter through `YouVersionClient`.
2. **The model may rank, never introduce.** Candidate references outside the reviewed
   library for the selected principle are dropped before any fetch happens.
3. **Fail closed.** If no reviewed candidate resolves against YouVersion, no passage
   renders. There is no fabricated fallback.
4. **Ambient is chosen once, not assumed.** Looking on its own means the draft leaves the
   browser without a press, so it is off until you turn it on, and the switch says plainly
   what it turns on. Until then Second Word only speaks when asked.
5. **The message you are answering is a third party's words.** It is fenced separately
   from your draft, with its own guard, because a stranger can write it and send it to you
   on purpose. Our own fence tags are stripped from anything we did not write.
6. **The rewrite is downstream of the passage.** `/v1/rewrite` requires a signed token
   proving this draft was analysed and this principle was selected for it, bound to the
   incoming message too. A modified draft is refused.
7. **We never touch the host page's DOM.** The badge and the card live in our own shadow
   hosts on `document.body`. Nothing is written into the field you are typing in except on
   an explicit Replace click.
8. **Drafts are not ours to keep.** No body logging, no persistence, no draft cache.

## Layout

```
src/                       the Worker: the decision layer behind everything
  lib/contracts.ts           wire and model schemas (zod), and the 17 principles
  lib/scripture-library.ts   the reviewed principle and reference library
  lib/detector.ts            the local gate, which runs in the browser
  clients/youversion.ts      the only source of verse text in the system
  clients/gloo.ts            the competition provider
  clients/workers-ai.ts      the stand-in, see "On the provider"
  orchestration/             analyze and rewrite
  security/token.ts          binds a rewrite to the analysis it came from
  ui/panel.ts                the passage card, shared by extension and sandbox

extension/                 Chrome MV3, nine surfaces
  src/adapters/              generic, plus Gmail which can read a thread
  src/badge.ts               the mark in the corner
  src/overlay.ts             positions the card without resizing the host page
  src/scheduler.ts           single flight, cache, stale answers dropped

sandbox/                   the public demo, same gate and same backend
notebook/                  the evidence, runs with no credentials
docs/RESEARCH-PRIOR-ART.md why it is built this way, with sources
```

## Running it

```bash
npm install
npm test              # 160 tests, no credentials needed
npm run typecheck     # worker and browser configs
npm run build         # sandbox bundle and extension/dist
npm run verify:refs   # fetches every reviewed reference from YouVersion
npm run preflight     # probes the deployed vertical slice with a safe fixture
```

Local backend, with a `.dev.vars` holding `TOKEN_SIGNING_KEY` and `LLM_PROVIDER`:

```bash
npx wrangler dev
```

**The extension.** `npm run build`, then load `extension/dist` unpacked at
`chrome://extensions` with Developer mode on. It stays quiet until you turn on "Notice on
its own" in the options page. See rule 4.

**The harness.** `extension/dev/harness.html` reproduces Gmail's compose DOM with a
stubbed backend, so the whole client path can be exercised without a Google account. It
proves the logic, not that the selectors still match real Gmail.

## Evidence

`notebook/second_word_evaluation.ipynb` runs from committed fixtures recorded against a
live backend. No credentials required. It checks claims that could be falsified, and says
plainly what it cannot show. From that run, 54 cases:

| | result |
|---|---|
| weighty drafts met | 15/15 |
| task talk given a passage | 0/8, and six never left the browser at all |
| references outside the reviewed library | 0 |
| prompt injections held | 5/5, plus 4 planted in the incoming mail |

## On the provider

Built for Gloo AI Studio and one environment variable away from it. Gloo's free tier
requires payment details and every card tried was declined, so the demo runs on Cloudflare
Workers AI behind the same interface, prompts and allow-lists. Every response names the
provider that actually ran, and the sandbox says so on the page.

## Licence

MIT, see `LICENSE`. The reviewed reference library is our own selection. Verse text is
fetched at runtime from the YouVersion Platform API and remains subject to the publisher's
terms, which the product displays alongside every passage.
