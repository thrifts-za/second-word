---
version: 1.0
name: Second Word
description: >-
  A warm editorial product system for Scripture inside everyday writing
  surfaces. Paper, ink, clay, and restrained gold frame a large live
  cross-application simulator. The visual language should feel like a Bible
  page entering modern software: literary but not antique, sacred but not
  ornamental, technically credible but never generic AI SaaS.
design_thesis: The Word, where words happen.
primary_experience: A live extension simulation inside the hero.
---

# Second Word design system

## 1. Visual theme and atmosphere

Second Word is **warm editorial restraint around a living product surface**.

The page should feel as considered as a good book and as immediate as the software people use all day. The brand does not borrow church iconography, stained glass, glowing crosses, generic prayer photography, or AI gradients. Scripture is made distinct through typography, spacing, provenance, and the dark reading card—not religious decoration.

The governing image is a **margin note appearing at the exact place a sentence is being formed**.

### Emotional qualities

- Quiet confidence
- Human warmth
- Moral seriousness without judgement
- Technical truthfulness
- Spacious, not empty
- Surprising, not theatrical
- Sacred restraint, not sacred ornament

### Page rhythm

Use alternating surface modes to create narrative pace:

1. **Warm paper** — positioning, editorial copy, trust.
2. **Soft paper stage** — live application simulator.
3. **Ink band** — technical proof or the extension appearing across surfaces.
4. **Warm paper** — human moments and product principles.
5. **Ink footer** — evidence, source, and final statement.

The live simulator carries the most visual weight. Prefer real product chrome and real interaction over abstract illustrations.

### Signature contrast

- The marketing page is warm and light.
- The Second Word Scripture card is dark ink.
- Guard uses muted clay.
- Guide uses restrained gold.
- Host application colours remain inside their simulated chrome and never become Second Word brand colours.

---

## 2. Color palette and roles

### Core brand tokens

| Token | Value | Role |
|---|---:|---|
| `--sw-canvas` | `#f4f3f0` | Primary page background; warm neutral paper |
| `--sw-canvas-raised` | `#fbfaf7` | Elevated light controls and quiet cards |
| `--sw-surface` | `#ffffff` | Application frames and clean content surfaces |
| `--sw-paper` | `#ece9e2` | Light text on ink and soft section bands |
| `--sw-paper-dim` | `#9a978f` | Secondary text on ink |
| `--sw-paper-faint` | `#6b6862` | Tertiary text on ink; publisher notes |
| `--sw-ink` | `#16181d` | Scripture card and darkest brand surface |
| `--sw-ink-raised` | `#1e2128` | Cards and fields inside ink surfaces |
| `--sw-page-ink` | `#1b1d21` | Primary marketing-page text |
| `--sw-body` | `#5c5f66` | Running copy and secondary labels |
| `--sw-faint` | `#8d9096` | Captions and low-priority metadata |
| `--sw-line` | `#e2e0db` | Hairlines on light surfaces |
| `--sw-line-strong` | `#d8d5ce` | Input and control borders |
| `--sw-rule-dark` | `#2c3038` | Rules inside the Scripture card |
| `--sw-clay` | `#c4705a` | Guard, primary action, Scripture rule, focus |
| `--sw-clay-active` | `#a95c49` | Pressed or strongly hovered clay action |
| `--sw-clay-soft` | `rgba(196,112,90,.14)` | Selected Guard control background |
| `--sw-guide` | `#9a6a17` | Guide only: gratitude, joy, generosity |
| `--sw-guide-soft` | `rgba(154,106,23,.12)` | Selected Guide background |
| `--sw-error` | `#b44c43` | Technical errors and invalid input only |
| `--sw-success` | `#477b58` | Live/verified service state only |

### Color rules

- Warm paper is the floor. Do not use pure white as the full-page background.
- Ink is reserved for the Scripture card, proof bands, and footer. Do not turn every section dark.
- Clay is the brand voltage. Use it for the primary demo action, Guard, Scripture rules, and focus—not every link or heading.
- Gold belongs only to Guide. Never use gold as generic luxury decoration.
- Red is not a reflection colour. A person is not an error.
- Application-specific colour may identify the selected simulation, but must stop at the application frame boundary.

### Simulated application accents

These are contextual cues, not brand tokens:

| Surface | Accent | Treatment |
|---|---:|---|
| Gmail | `#0b57d0` | Send control and small identity cue |
| Slack | `#4a154b` | Narrow workspace rail or header cue |
| Microsoft Teams | `#5b5fc7` | Header and active-channel cue |
| WhatsApp | `#128c7e` | Message-status and composer cue |
| X | `#0f1419` | Monochrome post chrome |
| LinkedIn | `#0a66c2` | Primary post control and identity cue |

Do not reproduce entire third-party design systems. Use only enough visual grammar to make the context immediately legible.

---

## 3. Typography rules

Second Word uses a literary serif for Scripture, reflection, and major brand statements; a system sans for interfaces, evidence, and host application chrome.

### Font stacks

```css
--sw-book: 'Iowan Old Style', 'Palatino Linotype', Palatino,
  'Book Antiqua', Georgia, serif;
--sw-ui: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
--sw-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
```

Do not introduce a web font merely to make the page look more designed. The existing stacks are fast, credible, and consistent with the extension.

### Marketing hierarchy

| Token | Desktop | Mobile | Weight | Line height | Use |
|---|---:|---:|---:|---:|---|
| `display-hero` | `72px` | `44px` | `400` | `1.02` | Hero statement; book serif |
| `display-section` | `48px` | `34px` | `400` | `1.10` | Major section headings; book serif |
| `display-card` | `30px` | `26px` | `400` | `1.18` | Human-moment cards; book serif |
| `lead` | `20px` | `18px` | `400` | `1.55` | Hero support and section introductions |
| `body-lg` | `17px` | `16px` | `400` | `1.65` | Main marketing copy |
| `body-md` | `15px` | `15px` | `400` | `1.60` | Supporting copy |
| `body-sm` | `13px` | `13px` | `400` | `1.55` | Evidence and captions |
| `eyebrow` | `11px` | `11px` | `600` | `1.4` | Uppercase labels, `.12em` tracking |
| `button` | `14px` | `14px` | `500` | `1` | Primary and secondary controls |
| `metric` | `28px` | `24px` | `400` | `1.1` | Evidence values; book serif |

### Product hierarchy

The shared extension components are authoritative:

- Scripture passage: book serif, `15.5px/1.5` inside the extension card.
- Reflection question: book serif, `16.5px/1.35`; largest item inside Guard.
- Marginal gloss: book serif italic, `12.5px/1.45`.
- Reference eyebrow: UI sans, `10.5px`, uppercase, `.14em` tracking.
- Panel name: book serif, `13px`.
- Buttons: UI sans, `12.5px`.

### Typography principles

- Major serif headings use weight `400`, never bold.
- Use negative tracking only on large display text: `-.02em` at hero, `-.01em` at section heads.
- Running copy should remain sans serif. Long serif paragraphs make the page feel historical rather than current.
- Scripture must never look like body copy. Preserve the hanging verse marker and clay rule.
- Interface labels are sentence case except compact reference and evidence eyebrows.
- Do not use monospace as a generic “technical” decoration. Reserve it for endpoints, code, and measurable proof.

---

## 4. Spacing, grid, and layout principles

### Spacing scale

Use a 4px base with an 8px primary rhythm.

| Token | Value |
|---|---:|
| `--space-1` | `4px` |
| `--space-2` | `8px` |
| `--space-3` | `12px` |
| `--space-4` | `16px` |
| `--space-5` | `24px` |
| `--space-6` | `32px` |
| `--space-7` | `48px` |
| `--space-8` | `64px` |
| `--space-9` | `96px` |
| `--space-10` | `128px` |

### Containers

- Marketing max width: `1240px`.
- Editorial reading max width: `680px`.
- Hero grid: 12 columns; copy uses 4–5, simulator uses 7–8.
- Desktop gutters: `32px` minimum.
- Tablet gutters: `24px`.
- Mobile gutters: `16px`.
- Major section separation: `96px`; hero may use `112–128px` vertically.

### Hero composition

The live simulator must be visible above the fold at `1280×800`.

- Left: eyebrow, thesis, one concise paragraph, proof line, three-step guide.
- Right: large live simulator, approximately `720–800px` wide.
- Simulator is not an image. It is the real functional experience.
- The first/default story is Gmail under financial pressure.
- Primary action is **Try this moment**, not **Install** or **Sign up**.

### Whitespace philosophy

- Let one strong statement own each section.
- Use whitespace to create care, not emptiness.
- Do not place more than three marketing claims beside the live demo.
- Feature grids should never compete with the simulator in density.
- The dark Scripture card may be visually dense; the page around it must breathe.

---

## 5. Depth, elevation, and shape

### Elevation

| Level | Treatment | Use |
|---|---|---|
| `flat` | No shadow; surface or hairline only | Page sections, trust cards |
| `quiet` | `0 1px 3px rgba(38,22,16,.12)` | Small controls and Presence badge |
| `frame` | `0 18px 60px -28px rgba(20,14,10,.30)` | Application simulator frame |
| `overlay` | `0 10px 34px rgba(20,14,10,.30)` | Second Word card overlay |
| `scripture` | `0 18px 44px -18px rgba(14,16,20,.55)` | Dark reading card |

Depth is created primarily through surface contrast and overlap. Shadows remain warm-neutral and diffuse.

### Radius scale

| Token | Value | Use |
|---|---:|---|
| `radius-xs` | `2px` | Extension buttons, moment chips, internal card geometry |
| `radius-sm` | `3px` | Existing Scripture card and sandbox fields |
| `radius-md` | `8px` | Product-page buttons, application controls |
| `radius-lg` | `12px` | Evidence and human-moment cards |
| `radius-xl` | `18px` | Live simulator outer stage |
| `radius-round` | `9999px` | Badge, status, application switcher icons only |

Do not soften the extension into a pill-heavy SaaS UI. Its near-square geometry is deliberate and should remain consistent inside every simulated host.

---

## 6. Page architecture

### A. Minimal navigation

Height `64px`, warm paper background, no heavy border.

- Left: Second Word mark and wordmark.
- Right: **Live experience**, **How it works**, **Evidence**, **Source**.
- One compact status chip may say **Live • no login**.
- No pricing, account, sign-in, or fake download navigation.

### B. Hero with live simulator

Required copy hierarchy:

1. **Meet Second Word** — eyebrow.
2. **The Word, where words happen.** — hero display.
3. One paragraph explaining contextual, verified Scripture in the text box.
4. **Live experience. No login. Nothing is sent for you.** — proof line.
5. Three-step guide: **Use the reply → watch the mark → open the word.**

### C. Cross-surface moment band

Heading: **The interface changes. The human moment does not.**

Use the real surface switcher and moment pairs, not static feature cards. Selecting a pair returns focus to the simulator and loads that surface.

### D. How it works

One restrained linear sequence:

`You stop typing → Second Word weighs the moment → YouVersion verifies the passage → the mark waits for you`

Keep diagrams editorial: hairlines, labels, small evidence markers. No node-cloud or neural-network imagery.

### E. Trust and agency

Four cards maximum:

- Verified, never invented.
- Quiet by design.
- Your words remain yours.
- No private history.

### F. Technical proof band

Use an ink background. Show actual evidence:

- Live provider, named truthfully.
- YouVersion as the only Scripture-text source.
- Current passing test total.
- Evaluation results.
- Public notebook and repository links.

Do not display unverified vanity metrics or fake user counts.

### G. Closing statement

Book-serif statement on paper:

> The hope is not that millions write more polished messages. It is that, in the moment their words matter, they remember they are not writing alone.

Actions: **Try another moment**, **View the evidence**, **Explore the source**.

### H. Footer

Ink background. Compact, factual, and transparent.

- Product and competition name.
- YouVersion provenance.
- Actual current model provider.
- Gloo access disclosure until the live preflight passes.
- MIT source link.

---

## 7. Core component styling

### Primary button

- Clay background, light paper text.
- `40–44px` height, `8px` radius, `14px/500` UI type.
- Padding `0 18px`.
- Hover darkens to clay-active; no glow or vertical jump.
- Focus ring: `2px solid clay`, `2px` offset.

### Secondary button

- Transparent or canvas-raised background.
- Page-ink text, `1px` line-strong border.
- Same height, type, and radius as primary.

### Text action

- No container.
- Page-ink or body colour; underline with `2px` offset.
- Clay only on hover/focus.

### Application switcher

- Semantic tablist.
- Each item includes a small surface glyph and text label.
- Inactive: transparent, body text, hairline border.
- Active: page-ink background, paper text.
- Radius `8px`, never oversized pills.
- On mobile: horizontal scroll with the active item always visible.

### Live simulator stage

- Outer background: paper or slightly darker warm neutral.
- `18px` radius, `24–32px` padding desktop, `8–12px` mobile.
- Application frame: white or surface-appropriate canvas, `10–12px` radius, `1px` hairline, frame shadow.
- Keep host chrome minimal: sender/context, content, composer, send control.
- The extension badge and panel sit above host chrome through the existing shared components.

### Composer

- Must be a real editable field.
- Minimum desktop height `112px`; surface-specific height may vary.
- Host-appropriate typography while Second Word remains visually consistent.
- Maintain clear room for the floating badge and other assistants.
- Never disable the host Send control while Second Word reads.

### Presence badge

- `30×30px` warm-white circle.
- `1px #e0d9cc` border.
- Quiet shadow.
- Opens Verse of the Day.
- It is not a notification count and never uses red.

### Reading badge

- `34×34px`, white, line-strong border.
- Centre pulse `9px` clay.
- Breathes at `1.15s ease-in-out`.
- Not clickable while unresolved.

### Guard badge

- Clay background, paper text.
- `34px` height; expands to show **A word for this** when there is room.
- Compact mode becomes a `14px` dot in crowded composers and reveals context on focus/hover.

### Guide badge

- Gold background.
- Copy: **A word for this good moment**.
- Never uses clay merely to appear consistent; the distinct state is the meaning.

### Scripture panel

Preserve the real component exactly unless a separately tested product change is approved.

- Ink background, `3px` radius.
- Header `38px` minimum with book-serif Second Word label.
- Reference in uppercase sans; translation in clay or Guide gold.
- Passage in book serif with hanging verse number and 1px vertical rule.
- Reviewed gloss in italic book serif.
- Guard question is larger than passage body.
- Guide has no reflective question or rewrite controls.
- References disclosure is collapsed by default.
- Actions remain visible when vertical room is limited.

### Evidence cards

- Flat canvas-raised or surface-white cards.
- `1px` hairline, `12px` radius, no shadow.
- One metric, one label, one sentence maximum.
- Metric in book serif; explanation in UI sans.

---

## 8. Cross-surface simulation rules

### Shared rules

- Every scenario must reveal a different human dimension, not repeat anger in different skins.
- Use fictional people, organisations, amounts, avatars, and messages.
- Reproduce interaction grammar, not entire proprietary interfaces.
- Keep the Second Word mark and card identical across surfaces.
- A sample action may fill a draft but may never hardcode a result.
- The live Worker classifies; YouVersion supplies Scripture.
- Switching surfaces cancels stale work and resets the composer safely.

### Required flagship set

| Surface | Human moment | Product state |
|---|---|---|
| Gmail | Financial pressure and provision | Guard/accompaniment; Matthew 6:25–26 first |
| Slack | Freely carrying a colleague | Gold Guide; no rewrite |
| X | Public provocation with a truthful point and a sting | Living Margin + Guard |
| WhatsApp | Writing into grief without explaining it | Guard with care |
| Microsoft Teams | Courage or a boundary with authority | Guard; preserves conviction |
| LinkedIn | Real gratitude or professional good news | Gold Guide |
| Professional logistics | Routine confirmation | Intentional Silence |

### Capability honesty

Supported for product claims: Gmail, Slack, Microsoft Teams, WhatsApp Web, X, LinkedIn, Reddit, ChatGPT, and Claude.

Do not simulate Outlook or Microsoft Word as live support until adapters, permissions, and real-surface tests exist.

---

## 9. Product state model

Every implementation must account for these states:

1. **Presence** — Verse of the Day mark; no draft analysis required.
2. **Writing** — host composer remains primary; no interruption.
3. **Reading** — breathing mark after the idle threshold.
4. **Guard resolved** — clay invitation; passage waits for a click.
5. **Guide resolved** — gold invitation; positive moment, no correction.
6. **Silence resolved** — return to Presence; no passage card.
7. **Card open** — verified Scripture and reviewed direct-to-person copy.
8. **Alternatives open** — only with a valid signed rewrite credential.
9. **Draft changed** — clear stale mark, marker, card, and offer.
10. **Unavailable** — never substitute model-generated or local Scripture.

Do not show a toast simply to prove Silence. A small explanation outside the simulated host may explain the design during the dedicated Silence scenario.

---

## 10. Motion and interaction

### Motion tokens

| Token | Value | Use |
|---|---:|---|
| `motion-fast` | `120ms ease` | Badge hover, small controls |
| `motion-ui` | `140ms ease` | Borders, colour, selection |
| `motion-card` | `240ms cubic-bezier(.2,.7,.3,1)` | Scripture card arrival |
| `motion-surface` | `280ms cubic-bezier(.2,.7,.2,1)` | Application transition |
| `motion-breathe` | `1150ms ease-in-out infinite` | Reading pulse only |

### Rules

- The panel rises no more than `4px` while fading in.
- Surface changes crossfade with a restrained `8–12px` horizontal movement.
- Never animate Scripture word by word.
- Never use confetti for Guide.
- Hover may clarify, not entertain.
- Honour `prefers-reduced-motion`; remove transforms and pulse scaling while retaining status clarity.

---

## 11. Responsive behavior

### Desktop: `≥ 1100px`

- 12-column hero.
- Copy left, live simulator right.
- Simulator visible above fold at `1280×800`.
- Application switcher may be vertical if it improves simulator width.

### Tablet: `768–1099px`

- Stack hero copy above simulator.
- Keep simulator at full container width.
- Switcher becomes horizontal.
- Reduce section spacing from `96px` to `72px`.

### Mobile: `< 768px`

- Single column.
- Hero display `44px` maximum.
- Switcher horizontally scrolls with 44px minimum touch targets.
- Simplify host application chrome before shrinking text.
- Card appears as a contained overlay or bottom sheet with a visible dismiss action.
- No horizontal page overflow at `320px`.
- Keep the composer editable and the badge reachable.
- Reduce page section spacing to `56px`.

Do not hide the live demo on mobile. It is the product, not a desktop decoration.

---

## 12. Accessibility

- Meet WCAG AA contrast for text and controls.
- Use a semantic tablist for the application switcher.
- Support keyboard flow through sample loading, composer, badge, card, actions, References, reset, and surface selection.
- Use visible clay focus rings; never suppress browser focus without replacement.
- Announce **Second Word is reading**, **A word is ready**, and resolved Silence succinctly.
- Do not make application identity depend on colour alone.
- Minimum interactive target: `44×44px` on touch layouts.
- Preserve reading order when the card visually overlays the host application.
- References uses native `details/summary` semantics.
- Reduced motion retains a static reading-state indicator.

---

## 13. Content and voice

### Voice

Direct, humane, specific, and restrained.

- Speak to the person: **you**, **your**.
- Name what the words are doing, not an emotion or motive the system cannot know.
- Use a short sentence where a paragraph would dilute the moment.
- Keep spiritual language grounded in the verified passage.
- Be transparent about technology and provider state.

### Preferred language

- human moment
- presence
- notice
- weigh
- guide
- guard
- verified Scripture
- your words remain yours
- quiet by design

### Avoid

- “the user is feeling…”
- “AI-powered Bible assistant”
- “fix your message”
- “spiritually optimise”
- “always knows what you need”
- “perfect response”
- generic claims that millions already use the product

### Primary copy

- Thesis: **The Word, where words happen.**
- Positioning: **Other writing tools ask whether your sentence is correct. Second Word asks what kind of human moment this is.**
- Proof: **Live experience. No login. Nothing is sent for you.**
- Cross-surface: **The interface changes. The human moment does not.**
- Final statement: **In the moment your words matter, remember you are not writing alone.**

---

## 14. Imagery, iconography, and third-party identity

- Prefer live interface simulation to photography or illustration.
- Second Word's mark is the only persistent brand glyph.
- Use simple line icons at `16–20px`, with `1.5px` strokes.
- Application glyphs identify a surface but remain secondary to text labels.
- Do not use stock prayer imagery, floating Bibles, halos, doves, stained glass, or glowing hands.
- Do not use neural meshes, chat bubbles, gradient orbs, circuit brains, or sparkles as AI shorthand.
- Do not reproduce private accounts, real inboxes, real messages, or real financial details.
- Simulated third-party surfaces must be clearly framed as interactive representations, not screenshots or affiliated products.

---

## 15. Do and don't

### Do

- Put the working simulator in the hero.
- Open with the Gmail provision story.
- Show different human moments across different applications.
- Use real shared extension components.
- Keep the warm-paper and dark-card contrast.
- Let Scripture remain the visual centre of a resolved moment.
- Preserve Guide, Guard, Presence, and Silence as distinct states.
- Display real YouVersion provenance and the actual current model provider.
- Use thin rules, editorial spacing, and restrained motion.
- Make every important interaction work without login or installation.

### Don't

- Do not build a generic landing page above a buried sandbox.
- Do not make every scenario conflict or negativity.
- Do not auto-open the Scripture card.
- Do not make the manual reflection link the primary experience.
- Do not paint Guard red or frame the writer as a problem.
- Do not add a reflective question to Guide.
- Do not hardcode demo results or verse text.
- Do not imply Gloo processed live responses until the Gloo preflight passes.
- Do not claim Outlook or Word support before implementation.
- Do not copy full Gmail, Slack, X, WhatsApp, Teams, or LinkedIn interfaces.
- Do not add fake testimonials, fake adoption numbers, pricing, sign-in, or account UI.
- Do not use purple gradients, glassmorphism, excessive pills, or oversized rounded cards.
- Do not modify the host composer except after an explicit Replace action.

---

## 16. Implementation directives

- Treat `src/ui/panel.ts`, `src/ui/styles.ts`, `extension/src/badge.ts`, and `extension/src/overlay.ts` as the source of truth for product UI.
- Build host simulations as data-driven surface components around one shared analysis controller.
- Preserve Shadow DOM isolation for the extension badge and panel.
- Use CSS custom properties for page-level tokens.
- Do not duplicate the Scripture card in page-specific markup.
- Samples may populate fields; they may not bypass the live Worker.
- Cancel or ignore stale responses when switching surface or changing draft.
- Never log draft or received-message bodies.
- Keep the public URL stable, logged-out, and usable without cookies or accounts.
- Every filmable scenario must be rehearsed against production and pinned to an expected principle, while allowing verified reference rotation.
- Provider and API status copy must be generated from truthful current state, not marketing constants.

---

## 17. Agent prompt guide

When asking a design or coding agent to work on Second Word, use:

> Build the Second Word public product experience using `DESIGN.md` as binding design direction. Use a warm paper canvas, literary serif display typography, restrained clay and Guide gold, and a large real cross-surface simulator in the hero. Preserve the existing shared badge, overlay, and Scripture panel. Do not use generic AI gradients, chatbot imagery, religious ornament, hardcoded Scripture, fake results, or unsupported surface claims. The interface must make Presence, Reading, Guard, Guide, and Silence distinct while keeping the person's composer and Send action primary.

### Quick token reference

```text
canvas       #f4f3f0
surface      #ffffff
ink          #16181d
page ink     #1b1d21
paper        #ece9e2
body         #5c5f66
line         #e2e0db
clay/Guard   #c4705a
gold/Guide   #9a6a17
book         Iowan Old Style / Palatino / Georgia
ui           system-ui / Segoe UI / Roboto
container    1240px
section      96px
card radius  12px marketing / 3px Scripture panel
```

### Acceptance test

The output is on-design only when a first-time visitor can see the live experience above the fold, understand the product in ten seconds, complete the Gmail provision story without a manual trigger, move between at least three truthful surfaces, distinguish Guide from Guard, and verify that Scripture came from YouVersion without surrendering control of the message.
