# Kaggle writeup draft — do not publish until live-Gloo proof is green

**Second Word**

*Scripture in the space between reaction and response.*

Most consequential writing happens in a text box: a reply to being blamed at
work, an apology to a friend, a hard boundary, a public argument, or a moment
of joy that deserves more than a quick reaction. Those are often the exact
moments when people do not stop to seek wisdom. Second Word brings a verified
word into that space without taking over it.

Second Word is a Chrome extension and public sandbox. When a person explicitly
enables automatic noticing, it waits until typing settles. A local gate keeps
ordinary logistics in the browser. For a consequential draft, **Living Margin**
softly marks the exact local phrase that prompted a pause—without changing the
editor or sending text merely to draw the mark. The person chooses whether to
open it. The card then offers a verified passage, publisher attribution, one
specific relational question, and optional alternatives; it never posts,
blocks Send, or replaces the original without a click.

This is deliberately not a Bible app painted onto email. Scripture changes the
decision already being made. The same experience serves anger and contempt, but
also grief, false accusation, apology, gratitude, and good news. Silence is a
valid outcome for ordinary correspondence.

Gloo provides structured discernment: it identifies the human moment, selects
one reviewed principle, and ranks only allowed reference IDs. It cannot return
Scripture text. YouVersion is the sole Scripture source: the Worker resolves
the selected passage at runtime and displays its translation and required
publisher attribution, or fails closed. A signed token binds any optional
rewrite to the exact analysed draft and incoming context, so a stale or altered
message cannot receive a suggestion intended for something else.

The technical posture is intentionally restrained: no draft persistence or body
logging, strict request schemas, an 8 KiB request boundary, separately fenced
third-party reply context, shadow-DOM overlays that do not alter host editors,
and a built extension artifact gate. The public evaluation covers 54 cases:
15/15 weighty drafts met; 0/8 ordinary task messages received a passage; 0
outside-library references rendered; and injected instructions were held.

Our hope is not that millions write more polished messages. It is that, before
words become a wound or a regret, more people regain the freedom to speak truth
with grace, make repair, and give thanks.

<!-- Before publishing: verify `REQUIRE_GLOO=1 npm run preflight`, replace this
comment with a one-sentence live-Gloo proof, and add the public demo/video links. -->
