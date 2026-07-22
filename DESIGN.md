# DESIGN.md — Second Word

A design system document for AI agents and designers building Second Word
surfaces. Every value here is extracted from shipped code, not invented:
`src/ui/styles.ts`, `extension/src/badge.ts`, `extension/src/mark.ts`,
`sandbox/index.html`. If you change a value here, change it there.

Product in one line: **Scripture in the space between reaction and response.**
It does not make you sound better. It gives you back the two seconds you needed.

---

## 1. Visual theme and atmosphere

The typography of a Bible page, not the iconography of a church.

Hanging verse markers, hairline rules, a marginal gloss, generous reading
rhythm. The page is warm paper; the passage card is dark ink. That inversion is
deliberate: when Scripture arrives it should read as **a different voice
entering the room**, not as more application furniture in the same colour as
the app around it.

Three feelings, in order of importance:

1. **Quiet.** The product's central claim is that it stays silent. Nothing
   pulses, glows, badges a count, or asks for attention it has not earned.
2. **Warm.** Paper white, never clinical white. Clay, never red.
3. **Considered.** Fine rules and small caps over borders and boxes. It should
   feel set rather than laid out.

Never: purple AI gradients, glowing orbs, chat bubbles, neural imagery,
sparkles, stock photography of people praying at laptops, or red error styling.
The person using this is not a mistake being corrected.

---

## 2. Colour palette and roles

### Page and host surfaces (light)

| Token | Hex | Role |
|---|---|---|
| `--page` | `#f4f3f0` | Page background. Warm, never `#fff` |
| `--card` | `#ffffff` | Host application surfaces, composers |
| `--ink` | `#1b1d21` | Body text on paper |
| `--ink-soft` | `#5c5f66` | Secondary text, quiet links |
| `--ink-faint` | `#8d9096` | Metadata, captions |
| `--line` | `#e2e0db` | Hairline dividers and field borders |

### The passage card (dark)

| Token | Hex | Role |
|---|---|---|
| `--ink` | `#16181d` | Card background |
| `--ink-raised` | `#1e2128` | Inputs and hover fills inside the card |
| `--paper` | `#ece9e2` | Scripture and primary text on the card |
| `--paper-dim` | `#9a978f` | The gloss, secondary copy |
| `--paper-faint` | `#6b6862` | Reference eyebrow, footnotes |
| `--rule` | `#2c3038` | Hairlines and button borders on the card |

### Accents, which carry meaning

| Token | Hex | Role |
|---|---|---|
| **Clay** | `#c4705a` | **Guard.** Something in this moment needs care. Also the rule beside Scripture and every focus ring |
| **Gold** | `#9a6a17` | **Guide.** Gratitude, good news, freely offered help. Reserved, and never used for decoration |
| Paper mark | `#fffdf9` | Presence badge fill, and the mark drawn on filled clay or gold |
| Mark border | `#e0d9cc` | Presence badge border |

**Rules.**
Clay is not a warning colour and must never be swapped for red. Gold is not a
brand accent; if gold appears on more than one thing per screen it has stopped
meaning "this is good news". Guard, Guide and Presence must be distinguishable
without colour, because colour alone fails accessibility and fails on camera.

---

## 3. Typography

| Family | Stack | Used for |
|---|---|---|
| Book | `'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif` | Scripture, questions, the gloss, headlines |
| UI | `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` | Controls, labels, metadata |

Scripture is always set in the book face. A verse in a UI sans is the single
fastest way to make this look like a productivity tool.

### Scale, as shipped on the card

| Element | Size / line-height | Notes |
|---|---|---|
| Passage | `15.5px / 1.5` book | Left rule in clay, 22px indent, hanging verse marker |
| Question | `16.5px / 1.35` book | Slightly larger than the passage: the passage is the fixed point, the question is the product |
| Gloss | `12.5px / 1.45` book italic | The margin note. 14px indent |
| Reference eyebrow | `10.5px` UI, `600`, `0.14em` tracking, uppercase | Translation abbreviation in clay beside it |
| Verse marker | `9px` UI `600` clay | Superscript, hanging in the margin |
| Actions | `12.5px` UI | |
| Footnote / attribution | `10px` UI | |

Card body padding `16px 18px 14px`. These sizes were tuned down from a larger
set because the card is a panel over someone's inbox, not a page. Do not
enlarge them without re-checking that the whole card fits above a composer at
1280px.

---

## 4. Components

### The mark

One drawing, everywhere: **two quotation marks, the first faded to 38% opacity,
the second solid and set lower.** The product's name as a picture. Not the
first word, the second. Source of truth is `extension/src/mark.ts`, viewBox
`0 0 18 16`, drawn as SVG rather than typed so it cannot inherit a host page's
font.

It appears identically on the badge in all three states, the extension icons at
16/32/48/128, and the favicon. Never redraw it, never substitute a glyph, and
never reintroduce the four-pointed sparkle it replaced — that is the mark every
generative AI product flies, and this one never writes.

### Badge (the mark in a composer)

| State | Fill | Mark | Shape |
|---|---|---|---|
| Presence, resting | `#fffdf9`, border `#e0d9cc` | clay | 30px circle |
| Guard | clay `#c4705a` | paper | 34px pill, label "A word for this" |
| Guide | gold `#9a6a17` | paper | 34px pill, label "A word for this good moment" |
| Reading | white, border `#d8d5ce` | 9px clay dot, breathing | 34px circle, not clickable |
| Collapsed | as above, unlabelled | hidden | 14px dot |

Position: inside the field, bottom right, above the resize grip. It moves to
the lower left when another assistant already owns that corner.

**Collapse is not an edge case.** The badge becomes the 14px dot whenever the
composer is shorter than 64px or holds more text than it can show, and the
label returns on hover or keyboard focus. Every social composer is short, so on
those surfaces the dot is the default appearance. Design it first, not last.

### Passage card

Dark panel, `3px` radius, `box-shadow: 0 18px 44px -18px rgba(14,16,20,0.55)`.
A header bar with the product name and a dismiss control, then the body.

Order is the argument and must not be rearranged:
reference eyebrow → passage → gloss → hairline → question → actions →
collapsed References.

Actions are a sticky row at the foot of the card so they can never be scrolled
out of sight. Guide shows only "Return to my message" — no reflective question,
no rewrite. Guard shows "Show alternatives" **only when the server licensed
one**; without that credential it shows "Return to my message" too.

### Buttons and links

| Kind | Style |
|---|---|
| Card action | `7px 13px`, `2px` radius, `1px` border `--rule`, transparent fill, `--paper-dim` text |
| Card action, primary | Same, clay border and text, `rgba(196,112,90,0.14)` fill |
| Quiet link | Underlined, `2px` underline offset, `--ink-soft`, with a 5px clay dot before it |

Radii are `2px` for controls and `3px` for panels. Nothing in this system is
pill-shaped except the badge.

---

## 5. Layout

- Reading measure: the card is `min(420px, 100vw - 32px)`. Scripture wants a
  narrow column.
- Spacing scale in use: `4, 6, 8, 10, 12, 14, 18, 22`. Prefer the smaller end;
  the rhythm comes from line-height and hairlines, not from padding.
- Hairlines over boxes. A `1px` rule in `--line` or `--rule` does the work a
  border and a background would do elsewhere.
- The card is positioned against the composer it belongs to, above it by
  preference and below when there is no headroom, and **never overlapping it**.
  Scripture rendered inside a text field reads as text somebody typed.

---

## 6. Depth and elevation

Four levels, and no more.

| Level | Shadow | Used for |
|---|---|---|
| Flat | none | Page, host surfaces |
| Resting mark | `0 1px 3px rgba(38,22,16,0.18)` | Presence badge |
| Raised mark | `0 1px 4px rgba(38,22,16,0.28)` | Guard and Guide badges |
| Panel | `0 18px 44px -18px rgba(14,16,20,0.55)` | The passage card |

Shadows are warm-tinted, never neutral grey. Depth signals "this arrived" and
nothing else; it never signals importance or urgency.

---

## 7. Do's and don'ts

**Do**

- Let silence be visible. The resting mark returning after a reading is the
  only evidence that a decision was made, and it must be legible at 1280px.
- Keep the mark identical across every surface. That consistency is the whole
  argument that one thing travels with the person.
- Show the passage as the visual centre of a resolved moment.
- State the provider and the YouVersion attribution wherever a passage appears.
- Design the failure states. A failed reading is silence and a mark at rest,
  never an error in someone's compose window.

**Don't**

- Don't render Scripture inside the field being written in.
- Don't put a count, a score, a streak, or a severity level anywhere.
- Don't use red, or any warning language, for Guard.
- Don't put gold on anything that is not Guide.
- Don't animate the reading state with a spinner. It breathes; it does not spin.
- Don't block, cover, or visually compete with the host application's Send.
- Don't write copy that diagnoses the person. "You are feeling angry" is
  outside what this product can know. Describe what the words are doing.
- Don't let a card imply a draft needs fixing when the server declined to
  license a rewrite.

---

## 8. Responsive behaviour

| Breakpoint | Behaviour |
|---|---|
| ≥1280px | Primary judging and filming frame. Card at full 420px, positioned above the composer |
| 768–1279px | Card width tracks the composer, minimum 300px |
| <768px | Card becomes a bottom sheet or contained overlay; it must never leave the page |
| 320px | Must work with no horizontal page overflow |

Touch targets are 44px minimum. The collapsed 14px dot needs a padded hit area
to satisfy that without growing visually.

Motion respects `prefers-reduced-motion`. The card's entrance is
`rise 240ms cubic-bezier(0.2, 0.7, 0.3, 1)`, a 4px lift with a fade. The verse
marker fades in 200ms on a 120ms delay, a beat after the text. The reading dot
breathes on `1.15s ease-in-out infinite` between 30% and 100% opacity.
Transitions on controls are `140ms ease`.

---

## 9. Agent prompt guide

Paste with any UI task in this repo.

> Build using DESIGN.md. Warm paper page (`#f4f3f0`), dark passage card
> (`#16181d`) so Scripture reads as a different voice entering the room. Book
> serif (Iowan Old Style / Palatino / Georgia) for Scripture, questions and the
> gloss; system sans for controls. Clay `#c4705a` means Guard and carries every
> focus ring; gold `#9a6a17` means Guide and appears once per screen at most.
> Hairlines over borders, `2px` radius on controls and `3px` on panels, warm
> shadows only. The mark is two quotation marks, the first faded, drawn as SVG,
> identical in every state and never a sparkle. Nothing pulses, counts or
> warns. Silence is a designed state, not an empty one.

**For a composer surface:** the badge sits inside the field at the bottom
right, above the resize grip, and collapses to a 14px dot when the field is
under 64px tall or scrolling. The card anchors above the field, flips below
when there is no room, and never overlaps it.

**For a marketing section:** reuse the real components. Do not redraw the badge
or the card in a design tool for a marketing block; a screenshot of the real
thing is more persuasive and cannot drift from the product.

**Checklist before shipping any screen**

- [ ] Guard, Guide and Presence distinguishable without colour
- [ ] Scripture in the book face, with its reference and translation
- [ ] Publisher attribution reachable
- [ ] Card never covers the composer or the host's Send
- [ ] Actions visible without scrolling the card
- [ ] Silence has something visible to show
- [ ] No sparkle, no red, no counts, no spinners
