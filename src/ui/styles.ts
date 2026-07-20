/**
 * Panel styles, as a string because they are injected into a shadow root.
 *
 * The shadow root is what lets the same component drop into a Reddit page
 * later without inheriting or leaking a single rule.
 *
 * Direction: the typography of a Bible page, not the iconography of a church.
 * Hanging verse markers, hairline rules, a marginal gloss. The panel is dark
 * against a light host page so it reads as a different voice entering the
 * room rather than more application furniture.
 *
 * The one risk: the question is set larger than the passage. The passage is
 * the fixed point, but the question is the product.
 */

export const PANEL_STYLES = `
:host {
  --ink: #16181d;
  --ink-raised: #1e2128;
  --paper: #ece9e2;
  --paper-dim: #9a978f;
  --paper-faint: #6b6862;
  --clay: #c4705a;
  --rule: #2c3038;

  --book: 'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif;
  --ui: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;

  all: initial;
  font-family: var(--ui);
  -webkit-font-smoothing: antialiased;
}

* { box-sizing: border-box; }

/* ---------- chip ---------- */
/* Quiet, secondary, never a badge and never a count. */

.chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 11px 5px 9px;
  border: 1px solid #d8d5ce;
  border-radius: 2px;
  background: #fbfaf7;
  color: #55524c;
  font-family: var(--ui);
  font-size: 12.5px;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition: border-color 140ms ease, color 140ms ease;
}

.chip:hover { border-color: var(--clay); color: #2f2c28; }
.chip:focus-visible { outline: 2px solid var(--clay); outline-offset: 2px; }

.chip__dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--clay);
  flex: none;
}

/* ---------- panel ---------- */

.panel {
  width: min(420px, calc(100vw - 32px));
  background: var(--ink);
  color: var(--paper);
  border-radius: 3px;
  box-shadow: 0 18px 44px -18px rgba(14, 16, 20, 0.55);
  overflow: hidden;
  animation: rise 240ms cubic-bezier(0.2, 0.7, 0.3, 1) both;
}

@keyframes rise {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
}

.panel__body { padding: 20px 22px 18px; }

/* ---------- consent ---------- */
/* Shown before anything is transmitted. This screen is the privacy promise. */

.consent__title {
  margin: 0 0 10px;
  font-family: var(--book);
  font-size: 17px;
  font-weight: 400;
  letter-spacing: 0.005em;
}

.consent__body {
  margin: 0 0 4px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--paper-dim);
}

.consent__body strong { color: var(--paper); font-weight: 500; }

/* ---------- moments ---------- */
/* Named situations, not emotional states. You pick what is happening. */

.moments {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 12px 0 12px;
}

.moment {
  padding: 6px 10px;
  border: 1px solid var(--rule);
  border-radius: 2px;
  background: transparent;
  color: var(--paper-dim);
  font-family: var(--ui);
  font-size: 11.5px;
  line-height: 1.3;
  text-align: left;
  cursor: pointer;
  transition: color 140ms ease, border-color 140ms ease, background 140ms ease;
}

.moment:hover { color: var(--paper); border-color: #454b56; }
.moment:focus-visible { outline: 2px solid var(--clay); outline-offset: 2px; }

.moment--on {
  border-color: var(--clay);
  color: #f0ded8;
  background: rgba(196, 112, 90, 0.16);
}

.context { margin: 0 0 14px; }

.context__input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--rule);
  border-radius: 2px;
  background: var(--ink-raised);
  color: var(--paper);
  font-family: var(--ui);
  font-size: 12.5px;
}

.context__input::placeholder { color: var(--paper-faint); }
.context__input:focus { outline: 2px solid var(--clay); outline-offset: 1px; border-color: transparent; }

/* ---------- passage ---------- */

.eyebrow {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--paper-faint);
}

.eyebrow__translation { color: var(--clay); }

.passage {
  position: relative;
  margin: 13px 0 0;
  padding-left: 24px;
  border-left: 1px solid var(--clay);
  font-family: var(--book);
  font-size: 17px;
  line-height: 1.62;
  color: var(--paper);
}

/* The hanging marker, as a Bible page sets it. Arrives a beat after the text. */
.passage__marker {
  position: absolute;
  left: 8px;
  top: 4px;
  font-family: var(--ui);
  font-size: 9px;
  font-weight: 600;
  color: var(--clay);
  animation: fade 200ms ease 120ms both;
}

@keyframes fade { from { opacity: 0; } to { opacity: 1; } }

/* The marginal gloss. Study-Bible commentary, set apart from Scripture. */
.gloss {
  margin: 12px 0 0;
  padding-left: 16px;
  font-family: var(--book);
  font-size: 13.5px;
  font-style: italic;
  line-height: 1.5;
  color: var(--paper-dim);
}

.rule {
  height: 1px;
  margin: 17px 0 15px;
  background: var(--rule);
  border: 0;
}

/* The question is the product, so it is the largest thing here. */
.question {
  margin: 0;
  font-family: var(--book);
  font-size: 20px;
  line-height: 1.4;
  letter-spacing: -0.005em;
  color: #f4f2ec;
}

/* ---------- actions ---------- */

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
}

.action {
  padding: 7px 13px;
  border: 1px solid var(--rule);
  border-radius: 2px;
  background: transparent;
  color: var(--paper-dim);
  font-family: var(--ui);
  font-size: 12.5px;
  cursor: pointer;
  transition: color 140ms ease, border-color 140ms ease, background 140ms ease;
}

.action:hover { color: var(--paper); border-color: #454b56; }
.action:focus-visible { outline: 2px solid var(--clay); outline-offset: 2px; }

.action--primary {
  border-color: var(--clay);
  color: #f0ded8;
  background: rgba(196, 112, 90, 0.14);
}

.action--primary:hover { background: rgba(196, 112, 90, 0.22); color: #fff; border-color: var(--clay); }

.action[disabled] { opacity: 0.45; cursor: default; }

/* ---------- rewrites ---------- */

.rewrites { margin-top: 16px; display: grid; gap: 9px; }

.rewrite {
  padding: 12px 13px;
  border: 1px solid var(--rule);
  border-radius: 2px;
  background: var(--ink-raised);
}

.rewrite__label {
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  color: var(--paper-faint);
}

.rewrite__text {
  margin: 7px 0 10px;
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--paper);
}

.rewrite__actions { display: flex; gap: 7px; }

.rewrite__button {
  padding: 4px 10px;
  border: 1px solid var(--rule);
  border-radius: 2px;
  background: transparent;
  color: var(--paper-dim);
  font-family: var(--ui);
  font-size: 11.5px;
  cursor: pointer;
}

.rewrite__button:hover { color: var(--paper); border-color: #454b56; }
.rewrite__button:focus-visible { outline: 2px solid var(--clay); outline-offset: 2px; }

/* ---------- states ---------- */

/* Silence gets the same typographic weight as a passage. It is an answer,
   not a failure, and it should not read like an error message. */
.quiet {
  margin: 0;
  font-family: var(--book);
  font-size: 17px;
  line-height: 1.55;
  color: var(--paper-dim);
}

.status {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--paper-dim);
}

.status--working { color: var(--paper-faint); }

.footnote {
  margin: 14px 0 0;
  padding-top: 12px;
  border-top: 1px solid var(--rule);
  font-size: 10px;
  line-height: 1.45;
  color: var(--paper-faint);
  /* The publisher notice arrives as multiple lines and must stay intact. */
  white-space: pre-line;
}

.footnote a { color: var(--paper-faint); text-decoration: underline; }

.undo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

@media (prefers-reduced-motion: reduce) {
  .panel, .passage__marker { animation: none; }
}
`
