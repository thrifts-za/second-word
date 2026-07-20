# Prior art: what we learned and what we took from it

Compiled 2026-07-20 from a full sweep of Grammarly's engineering blog (88 posts,
seven categories, two of which are not in the site nav) plus two source
repositories. Read by parallel agents, verified against the posts themselves.

**This is the source of truth for why Second Word is built the way it is.** When
a decision in the code looks arbitrary, it should be traceable to a row in
section 2. If it is not in here, it was a judgement call and should be labelled
as one rather than dressed up as research.

Grammarly is the incumbent in exactly our surface: an extension that watches a
text box and offers help. We are not copying the product. We are reading what
they published about the mechanics, because they have already paid for the
lessons we would otherwise buy with our remaining days.

---

## 1. How to use this

- **Building something?** Check section 2 first. If the decision is there, follow
  it and cite the row in the code comment.
- **Arguing against a decision?** Section 3 has the underlying numbers, and
  section 4 is the evidence that cuts against us. Both are fair to use.
- **Writing the submission?** Section 6 lists what is safely citable, with
  sources, and flags the one number that is not.

---

## 2. Decision log

Every architectural decision in the ambient redesign, and what drove it.

| # | Decision | Evidence | Source |
|---|---|---|---|
| D1 | Fire automatically. Do not wait to be pressed. | Automatic is Grammarly's default across the entire product. Snippets is "Grammarly's first user-triggered feature, ever." | [snippets](https://www.grammarly.com/blog/engineering/snippets-grammarly-business/) |
| D2 | Automatic detection, not automatic interruption. Badge appears; the card needs a click. | Grammarly never blocks Send, never edits. The badge collapses while typing; the card is opened deliberately. | [input lag](https://www.grammarly.com/blog/engineering/reducing-text-input-lag/) |
| D3 | Keep the manual invitation as a fallback, do not delete it. | They run a hybrid: ambient suggestions plus one deliberate manual action. | [snippets](https://www.grammarly.com/blog/engineering/snippets-grammarly-business/) |
| D4 | The local pass is a loose gate, not the classifier. The server model is the strict one. | "Fast models stored on-device" for cheap work; "a backend call is used only for deeper sentence and paragraph-level analysis." | [android keyboard](https://www.grammarly.com/blog/engineering/how-grammarly-built-a-native-keyboard-for-android/) |
| D5 | Hold precision as a floor; only move recall. Never trade. | They held 80% precision fixed and moved recall 40% -> 62%. | [main points](https://www.grammarly.com/blog/engineering/nlp-ml-identify-main-points/) |
| D6 | Quorum: local gate AND server model must both agree before the badge shows. | `Nmin` quorum in their ensemble. `Nmin = 1` explicitly called "a poor strategy" because one model's opinion is not trustworthy enough to act on. Best results near-unanimous. | [gector](https://www.grammarly.com/blog/engineering/experimenting-with-gector/) |
| D7 | Silence is the architectural default, with a named tunable threshold, not a bolt-on. | Their tagging model applies no edit where confidence falls below a minimum edit probability. Confidence biases added to the most consequential tags to make it more conservative. | [tagging](https://www.grammarly.com/blog/engineering/text-simplification-by-tagging/) |
| D8 | Do not fire on the first ambiguous signal. | On-device keyboard learns a word silently and refuses to surface it until it crosses a frequency threshold. | [personal LM](https://www.grammarly.com/blog/engineering/personal-language-model/) |
| D9 | Keyword matching cannot solve this. Do not add more regex families. | Toxicity detectors "systematically miss" whole categories. Purpose-built classifier is the fix. See D5 for what we do instead within the deadline. | [delicate text](https://www.grammarly.com/blog/engineering/detecting-delicate-text/) |
| D10 | The badge must be able to point at why it appeared. `evidence` is a product requirement, not debug output. | Explainability was a modelling constraint: "if we don't provide a reason why Grammarly suggested something, it could be confusing." | [attention](https://www.grammarly.com/blog/engineering/readers-attention/) |
| D11 | Never work on keypress. Idle-debounce everything. | Moving work off the keypress path produced ~91% input lag reduction. | [input lag](https://www.grammarly.com/blog/engineering/reducing-text-input-lag/) |
| D12 | Single-flight, response cache keyed by text, stale-response discard. | GemType: promise-chain queue never >1 call in flight, `Map` cache, `checkSeq` counter discards stale responses. | [GemType](https://github.com/riponcm/GemType) `extension/src/background.js` |
| D13 | Attach via capture-phase `focusin` on document, not a MutationObserver. | GemType attaches on focus and climbs the contenteditable chain to the topmost ancestor, which is Gmail's nested structure. Dynamically created composers work for free. | [GemType](https://github.com/riponcm/GemType) `extension/src/content/content.js` |
| D14 | Generic adapter first; Gmail is the specialisation that adds thread reading. | Follows from D13: focus-driven attachment is site-agnostic. Makes "wherever you type" real instead of asserted. | derived from D13 |
| D15 | Render into a shadow-DOM custom element with `!important` host styles. | GemType uses one `attachShadow` host on `document.body`. Known trap: sites shipping `:not(:defined){visibility:hidden}` silently hide a naive custom element. | [GemType](https://github.com/riponcm/GemType) `extension/src/content/overlay.js` |
| D16 | Position the badge `position: fixed` from `getBoundingClientRect()`, rAF-**coalesced** on scroll, resize and field-scroll, plus a 1s reconciliation poll. | GemType `overlay.js` does exactly this: a `_rafPending` guard collapses an event burst into one measurement per frame, three capture-phase listeners, and `setInterval(..., 1000)`. | [GemType](https://github.com/riponcm/GemType) `overlay.js:370-435` |
| D28 | Never inject anything into the host text field. Overlay only, appended as the last element of `document.body`. | Grammarly's original approach wrapped text fragments in `<g>` nodes inside the field. It could "corrupt the user's text, crash the website's code, or make an email include underlines when it gets sent," and led ProseMirror, Quill and Draft.js to add ways to **disable Grammarly**. They rebuilt to touch nothing. | [native on every website](https://www.grammarly.com/blog/engineering/making-grammarly-feel-native-on-every-website/) |
| D29 | Never query geometry *unconditionally* at frame rate, and never once per rendered item. Event-driven measurement coalesced to one per frame is fine. | "If you try to call getBoundingClientRect of a text field element 60 times per second on a popular site like Facebook, it can easily consume over 90% of CPU." That figure is for an unconditional 60Hz poll, and their real cost was `Range.getClientRects()` once per underline per update. **Corrected 2026-07-20:** an earlier reading of this row banned rAF entirely, which was wrong and contradicted by shipping code (D16). The rule is unconditional-polling and per-item, not rAF. | same, plus GemType |
| D30 | Track position with targeted capture-phase events plus a ~1s reconciliation poll. MutationObserver sparingly; IntersectionObserver optional. | There is no event for "this element moved". Their full heuristic list: content change, window scroll and resize, scroll of every scrollable ancestor, field scroll, style and class attribute changes, element add/remove anywhere, stylesheet insertion. MutationObserver "if used improperly, has the potential to degrade the performance of the entire page." Polling "every second or so" is the fallback guaranteeing eventual alignment. GemType ships the reduced set (3 listeners + 1s poll) and no IntersectionObserver. | same, plus GemType |
| D32 | Check visibility before measuring anything else, and hide rather than position when the field is disconnected, zero-sized, or outside the viewport. | GemType's `visible()` runs first in `reposition()`. This, not throttling, is what actually keeps the cost near zero: an off-screen field costs one rect and nothing else. | [GemType](https://github.com/riponcm/GemType) `overlay.js:410` |
| D33 | Pin `transform: none` and `filter: none` on the host, `!important`, alongside position and z-index. | A `transform` or `filter` anywhere in the ancestor chain creates a containing block and silently breaks `position: fixed`. GemType sets 12 properties inline with `!important`, including these two, precisely so a host page's stylesheet cannot reach in. z-index 2147483646. | [GemType](https://github.com/riponcm/GemType) `overlay.js:190-213` |
| D34 | The reconciliation poll doubles as the lifecycle check: field no longer connected means tear down. | Their 1s interval checks `!this.field.isConnected` and destroys the controller before repositioning. Hosts remove and rebuild composers constantly and fire no event when they do. | [GemType](https://github.com/riponcm/GemType) `overlay.js:388` |
| D35 | Badge sits at the field's bottom-right, clamped to the viewport, **inset left of the resize grip**. See D38. | `left = rect.right - 34`, `top = min(innerHeight - 34, rect.bottom - 34)`. Matches where Grammarly's badge sits, which is what people already expect. | [GemType](https://github.com/riponcm/GemType) `overlay.js:499` |
| D36 | Only attach to a box big enough to hold a message: width > 301 and height > 38. | Grammarly publishes the exact test: `$0.clientWidth > 301 && $0.clientHeight > 38`. The reason underneath is intent, not pixels. A search field or a username box is never addressed to a person, so nothing written there can be a moment. Zero by zero means "not laid out yet" and must not be read as "too small". | [support doc](https://support.grammarly.com/hc/en-us/articles/115000090392) |
| D37 | Honour `data-gramm="false"`, a competitor's attribute, as an opt-out. | It is what site owners already write to mean "no writing assistant here", and it is the only such convention that exists. HN, 2018: *"As a web developer, `setAttribute('data-gramm', 'false')` is your friend."* The same thread predicts the failure we must avoid: *"This will work fine until the next Grammarly decides that when you put data-gramm you meant to disable Grammarly, and their software is better so it's fine to ignore that unless you add a data-whoever and on and on."* Our own `data-second-word="off"` is the fallback, not the primary. | [HN 16316937](https://news.ycombinator.com/item?id=16316937) |
| D38 | Never sit on the resize grip. Inset the badge ~18px on a resizable textarea. | HN, 2018: *"because of the placement of their hover in the bottom-right its next to impossible to resize a textarea with their plugin installed."* Reported against Grammarly and still true. Costing someone control of their own message box in order to offer them a verse is not a trade this product gets to make. | [HN 16316937](https://news.ycombinator.com/item?id=16316937) |
| D40 | When another writing assistant already holds the corner, move. | Grammarly's badge sits bottom-right of the field, which is where ours wants to be, and most people who would want Second Word already run Grammarly. Grammarly stamps the field it has claimed (`data-gramm_id`, `data-gramm="true"`, `data-gramm_editor`), so "on this page" and "on this box" are distinguishable. Two badges on one pixel is a turf war whose loser is the person trying to write. We were here second, so we move. | DOM dump in [HN 16316937](https://news.ycombinator.com/item?id=16316937) |
| D39 | Text fields inside an iframe are a known blind spot. Do not pretend otherwise. | Grammarly's own troubleshooting has users run `$0.ownerDocument.defaultView.parent !== $0.ownerDocument.defaultView` to discover the extension simply will not work there. We inherit the same limitation and should state it rather than let someone find it. | [support doc](https://support.grammarly.com/hc/en-us/articles/115000090392) |
| D31 | Our positioning problem is strictly easier than theirs, and we should not inherit their cost. | They reposition one rect per underlined fragment, continuously. We have one badge and one card. One `getBoundingClientRect` per reposition, never per word. | derived from D29 |
| D17 | Never build UI from `innerHTML`. `createElement` and `textContent` only. | GemType's rule, and ours matters more: our card renders model output. | [GemType](https://github.com/riponcm/GemType) |
| D18 | Honor an opt-out attribute; skip password, OTP and credit-card fields. | GemType skips these explicitly and honors `data-gramm`. | [GemType](https://github.com/riponcm/GemType) `util.js` |
| D19 | The received message needs a stronger fence than the draft, and our own fence tags must be stripped from it. | Not from prior art. Found by writing an adversarial eval case (`rinj-04`) before the code. Naive interpolation let a stranger's email forge a `<draft>` block. | our own, 2026-07-20 |
| D20 | Hard timeout on the model call; drop to silence rather than hang the compose window. | Their transactional layer: timeouts on external and internal calls, circuit breakers to stop cascading failure, "fast or dropped". | [billing platform](https://www.grammarly.com/blog/engineering/billing-and-payments-platform/) |
| D21 | One Worker route in front of everything. The extension never talks to a model provider directly. Verify once at the edge, pass a signed claim downstream. | Their UserPassport pattern: gateway verifies the user once, populates a signed object, downstream services trust it rather than re-authenticating. Rate limiting and circuit breaking centralised at one layer. | [gateway](https://www.grammarly.com/blog/engineering/grammarly-business-gateway/) |
| D22 | Write down an explicit retention statement: processed in memory, never persisted. Log metadata only, never message bodies. | ISO 27701 posture covers all customer content, not just PII: defined retention, de-identification, sanitization. | [iso 27701](https://www.grammarly.com/blog/engineering/iso-27701/) |
| D23 | State that the only component seeing raw message text is the Worker. | "All components that process user data operate inside our private network," reached through a minimal public surface. | [security ops](https://www.grammarly.com/blog/engineering/security-infrastructure-aws/) |
| D24 | Report precision and recall at multiple operating points, never a single pass/fail number. | Their delicate-text table does exactly this across nine methods. | [delicate text](https://www.grammarly.com/blog/engineering/detecting-delicate-text/) |
| D25 | Tune on accept / dismiss / ignore in real use, not on benchmark score alone. | They beta-test candidate models with different precision/recall tradeoffs and decide on "which suggestions do users accept, ignore, or dismiss?" | [innovating the basics](https://www.grammarly.com/blog/engineering/innovating-the-basics/) |
| D26 | Preserving the user's voice is a named, separately tested requirement. | One of three stated model requirements, alongside quality and latency. Their tokenizer choice turned on it: T5 silently normalised 10+ Unicode space characters, Llama preserved them. | [on-device](https://www.grammarly.com/blog/engineering/efficient-on-device-writing-assistance/) |
| D27 | Set a numeric latency budget before optimising, and report against it. | 50 tokens/sec floor set in advance, ~210 achieved. Separately, a stated sub-100ms bar for real-time suggestions. | [on-device](https://www.grammarly.com/blog/engineering/efficient-on-device-writing-assistance/), [at scale](https://www.grammarly.com/blog/engineering/on-device-models-scale/) |

---

## 3. Findings by theme

### 3.1 Silence, precision, and why our detector caught nothing

The single most useful table in the corpus, from
[Detecting Delicate Text](https://www.grammarly.com/blog/engineering/detecting-delicate-text/).
"Delicate" text is emotionally risky but not toxic. That is our category, defined
and benchmarked by someone else.

| Method | Precision | Recall |
|---|---|---|
| Their RoBERTa baseline | 81.4% | 78.3% |
| HateBERT / HatEval | 95.2% | 6.0% |
| Same, threshold recalibrated | 41.1% | 86.0% |
| Perspective API | 77.2% | 29.2% |
| OpenAI moderation | 91.3% | 18.7% |

Dataset: 40,000 labelled training samples, 1,023-paragraph benchmark, two-step
annotation by expert linguists with majority vote.

Our original `detect()` was the HateBERT row: near-perfect precision, ~zero
recall, silent on 15/15 weighty drafts. The row beneath it is what naive
loosening buys, and it is the Snippets failure by another route.

Related: their dataset post names **"dead angles"** as a failure mode, data types
you filtered out and then meet in production. Their example is teams stripping
toxic language from training corpora and shipping into a world full of it. Our 15
weighty drafts were a dead angle.
([doing data right](https://www.grammarly.com/blog/engineering/high-quality-nlp-datasets/))

Also from that post: for subjective categories, collect multiple gold labels per
item rather than forcing one true answer, and high inter-annotator agreement only
proves annotators agree with each other, not that the labels are right.
([annotation](https://www.grammarly.com/blog/engineering/annotation-best-practices/))

### 3.2 Scheduling and staying out of the way

From [reducing text input lag](https://www.grammarly.com/blog/engineering/reducing-text-input-lag/):

- **~91% reduction** in text input lag overall.
- Underline geometry optimisation alone: **up to 50%**.
- **9% decrease in users disabling the extension** after the less intrusive UX
  shipped. This is the measured evidence that getting out of the way retains
  people.
- The expensive per-keystroke work was `caretRangeFromPoint` for button overlap,
  suggestion reprocessing, and underline geometry.
- Fixes: defer the overlap check until typing stops; time-slice underline updates
  with a fixed frame budget and continue via `requestAnimationFrame`, tracking
  pending items in a `Set`; buffer text revisions and reprocess on pause.
- WebWorkers were considered and **rejected**: no DOM access, and the expensive
  part is DOM geometry reads.
- They never mutate host HTML. They build their own text representation from the
  host editor's computed styles.
- Measurement, lab: Playwright harness runs identical scripts with and without
  the extension and subtracts the mean, giving the extension's own overhead.
  Grafana dashboards, used as a pre-merge regression gate.
- Measurement, field: session-level sampling at a configurable 1-10%, capped at
  10 events per session, selected by Reservoir Sampling (Algorithm R) so a
  prolific typer cannot skew the set. Now also tracking INP.

### 3.3 The counter-evidence

See section 4. It deserves its own heading.

### 3.4 On-device, and what is actually feasible

Numbers worth having when someone asks whether local inference is realistic:

- ~1B parameter Llama, 4-bit quantised (70% memory cut), **~210 tokens/sec on an
  M2**, against a stated floor of 50.
  ([on-device](https://www.grammarly.com/blog/engineering/efficient-on-device-writing-assistance/))
- Cloud model ~4GB compressed to **under 300MB**; T5 encoder taken from 70 to
  **297 tokens/sec**; stated bar of **sub-100ms** for real-time feel. Shipped to
  Mac, Windows and **Chrome extension** via one Rust core.
  ([at scale](https://www.grammarly.com/blog/engineering/on-device-models-scale/))
- iOS keyboard: 7.5M-parameter LSTM inside a **60 MiB** total extension budget,
  **~17ms** per touchpoint at 60Hz sampling.
  ([swipe typing](https://www.grammarly.com/blog/engineering/deep-learning-swipe-typing/))
- CoEdIT: a specialised model up to **60x smaller** than GPT-3-Edit (175B) was
  preferred by human evaluators **64% to 10%**.
  ([coedit](https://www.grammarly.com/blog/engineering/coedit-text-editing/))

**Gap worth knowing:** none of these personalise on-device. Grammarly has not
published a solution for local adaptation. If we ever claim it, we are ahead of
them, not following.

### 3.5 Surfacing without blocking

- Android keyboard: backend suggestions appear as dismissible **alert cards**
  next to the logo on the suggestion strip, stacking when there are several, with
  a revision view on demand. After a multi-second pause the strip switches
  content rather than nagging. ~20ms budget per keystroke; keyboard activated 70+
  times a day.
  ([android](https://www.grammarly.com/blog/engineering/how-grammarly-built-a-native-keyboard-for-android/))
- Swipe typing: top candidate auto-applied, up to 3 alternates in a non-modal
  strip.
- Their CEO frames the tone detector as relief for the anxiety of *"wondering how
  it would be received"* after sending an important email. Closest existing
  framing to ours, and it is about the moment before send rather than
  correctness. ([pm lessons](https://www.grammarly.com/blog/engineering/top-pm-lessons/))

### 3.6 Proving it works

- **Causal design**: a *silent placebo* build (installed, suggestions suppressed)
  as the control, plus a natural experiment removing access from a live team.
  450+ workers. CSAT dropped 20% when access was removed.
  ([causal effects](https://www.grammarly.com/blog/engineering/effects-of-ai-at-work/))
- **Go-dark holdout** with Bayesian structural time-series to build a synthetic
  counterfactual, when per-user instrumentation is impossible.
  ([cookie-less](https://www.grammarly.com/blog/engineering/measuring-marketing-effectiveness-in-a-cookie-less-world/))
- **Effective Communication Score**: five subscores, each "suggestions remaining
  per 1,000 words", converted to a percentile against peers, averaged, then shown
  to users as a grade rather than a number. Honest caveat: it has no independent
  outcome validation. It is a proxy.
  ([ECS](https://www.grammarly.com/blog/engineering/effective-communication-score/))

We have 10 days and no users. We should name the silent-placebo design as the
thing that would prove Second Word works, and say plainly that we have not run it.

### 3.7 Trust and security posture

- Minimal public surface; everything touching user text sits behind it.
  ([security ops](https://www.grammarly.com/blog/engineering/security-infrastructure-aws/))
- Resiliency toolkit for a call that must be fast or dropped: timeouts, circuit
  breakers, idempotent retries, dead-letter queue.
  ([billing](https://www.grammarly.com/blog/engineering/billing-and-payments-platform/))
- Verify once at the edge, pass a signed claim downstream, centralise rate
  limiting and circuit breaking in one layer.
  ([gateway](https://www.grammarly.com/blog/engineering/grammarly-business-gateway/))
- Defined retention, de-identification and sanitization applied to **all customer
  content**, not just PII. Processor vs controller stated explicitly.
  ([iso 27701](https://www.grammarly.com/blog/engineering/iso-27701/))
- Privacy-preserving history without storing text: SimHash plus Hamming distance
  to spot repeated phrasing, never retaining plaintext. Deliberately scoped away
  from long documents where it produced too many false candidates.
  ([snippet suggestions](https://www.grammarly.com/blog/engineering/personalized-snippet-suggestions/))
- Hard-coded rules as a backstop under the model, explicitly to prevent harms the
  model alone cannot be trusted to avoid.
  ([gender-neutral they](https://www.grammarly.com/blog/engineering/gender-neutral-they-nlp/))

---

## 4. Evidence against what we are doing

Kept separate so it cannot be quietly skipped.

**Grammarly auto-triggered an interruptive feature and killed it.** From
[snippets](https://www.grammarly.com/blog/engineering/snippets-grammarly-business/):

> "One option was to leverage work by our ML and NLP team to automatically
> suggest snippets as the user was typing... nearly every word that was typed
> would automatically trigger a suggested reply. This experience wasn't aligned
> with our design principles of being non-intrusive and delightful. To provide
> more control, we decided that snippets should be triggered by an explicit user
> action."

Same post:

> "Snippets represent Grammarly's first user-triggered feature, ever. In all
> other cases, Grammarly provides automatic suggestions, with no user action
> needed."

**Reading.** Automatic is the default; the exception was killed by noise, not by
principle. Their classifier fired on nearly every word. Ours must not. This is
the strongest argument for D5, D6, D7 and D8, and the reason the precision floor
is a gate on shipping rather than a nice-to-have.

**Second piece of counter-evidence.** Their delicate-text work says plainly that
keyword and toxicity approaches structurally fail on this category (D9). Our gate
is currently regex. We are shipping the thing their data says does not work, and
mitigating it by making the model the actual classifier. That mitigation is the
whole bet. If the model's silence rate degrades, we have no fallback.

**Third, and the one to read before writing any DOM code.** Developers on the
receiving end of Grammarly's extension, [HN 16316937](https://news.ycombinator.com/item?id=16316937),
2018. This is what D28 looks like from outside:

> "the plugin just blindly detect contentEditable inputs and start screwing with
> their content. This very much breaks modern WYSIWYG web editors, which
> typically expect to have control over the editable content. Which more or less
> comes down to 'move over page scripts, I'm a browser plugin, this is _my_
> webpage now'."

> "Turns out Grammarly was injecting HTML into the editor, which in turn was
> being included in the email body!"

> "It was also breaking sites built on JS frameworks like Angular and Ember
> where the framework expects to be controlling the DOM."

A rich-text editor team emailed Grammarly to have it disabled for their domains
and preferred that to adding the attribute themselves, for "maintenance,
cleanliness". That is what a badly behaved extension costs: the people building
the web actively working to keep it out.

Every one of these is a thing we are structurally prevented from doing. We never
write into the field except on an explicit Replace click, and our UI lives in our
own shadow host on `document.body`. That is not an accident of style. It is the
single most important constraint in the extension, and this thread is why.

---

## 5. Repositories

**[grammarly/omniconf](https://github.com/grammarly/omniconf)** - Clojure config
library for JVM services. Dormant since April 2024. Cannot run in a Workers
isolate. **Not usable.**

**[riponcm/GemType](https://github.com/riponcm/GemType)** - open-source Grammarly
clone. MV3, shipped to Chrome, Edge and Firefox, actively maintained. Solves
almost exactly our mechanical problem. Sources D12, D13, D15, D16, D17, D18.

Files worth reading before writing our own:
- `extension/src/content/util.js` - `findEditable`, `measureNativeRanges`, `replaceRange`
- `extension/src/content/overlay.js` - shadow-DOM host, `!important` trick, fixed positioning
- `extension/src/background.js` - single-flight queue, cache, `checkSeq`

Also uses `Intl.Segmenter` to re-check only the surrounding sentence after an
accepted fix rather than the whole message.

**Gap:** GemType never reads outside the focused field. No prior art for pulling
the received message. That part is ours.

**Licence.** Apache 2.0 with a trademark carve-out; our repo is MIT and the
competition requires winning code be open source. Apache code may live in an MIT
project but must keep its licence header and attribution. **Decision: read it,
learn the technique, write our own. Do not paste.**

---

## 6. Citable in the submission

Safe, with sources:

- 88% of the workweek is spent communicating across channels. ([causal effects](https://www.grammarly.com/blog/engineering/effects-of-ai-at-work/))
- Delicate-text detection scores: Perspective 42.3% F1, OpenAI moderation 31.1%, their fine-tuned model 79.3% on 40,000 samples. Full precision/recall table in section 3.1. ([delicate text](https://www.grammarly.com/blog/engineering/detecting-delicate-text/))
- 9% fewer users disabled the extension after a less intrusive UX. ([input lag](https://www.grammarly.com/blog/engineering/reducing-text-input-lag/))
- ~91% input lag reduction from moving work off the keypress path. (same)
- 20% reduction in writing errors, RCT, 450+ workers. ([causal effects](https://www.grammarly.com/blog/engineering/effects-of-ai-at-work/))
- CSAT fell 20% when Grammarly access was removed from a live support team. (same)

**Do not ship:** "people spend 99% of their time in a text box." No source
exists. Use the 88% figure above, which makes the same point and survives a
judge checking it.

---

## 7. Not yet mined

- [How We Built It: Accepting Multiple Suggestions at Once](https://www.grammarly.com/blog/engineering/accepting-multiple-suggestions/) (2021).
- [Under the Hood, Part Two: How Suggestions Work](https://www.grammarly.com/blog/engineering/how-suggestions-work-grammarly-editor/) (2022), editor-side.

Corpus was swept exhaustively: 88 posts across NLP/ML (28), Product (18),
Infrastructure (19), Team (11), Data (6), Mobile (3), Web (3), plus one post
orphaned from every archive
([SOC 2 / ISO](https://www.grammarly.com/blog/engineering/our-journey-to-soc2-and-iso-certifications/)).
Team and Web are not in the site navigation.
