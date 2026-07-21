# Kaggle writeup draft — do not publish until live-Gloo proof is green

**Second Word**

*Scripture in the space between reaction and response.*

**Other writing tools ask whether your sentence is correct. Second Word asks
what kind of human moment this is.**

Most consequential writing happens in a text box: a reply to being blamed at
work, an apology to a friend, a hard boundary, a public argument, or a moment
of joy that deserves more than a quick reaction. Those are often the exact
moments when people do not stop to seek wisdom. Second Word brings a verified
word into that space without taking over it.

The problem is common and relational, not merely grammatical: a YouGov omnibus
survey found that 57% of U.S. social-media users had posted or texted something
they later regretted. [Source](IMPACT-EVIDENCE.md)

Second Word is a Chrome extension and public sandbox. Optional Presence adds a
quiet composer mark that opens YouVersion's real Verse of the Day on click
without reading the draft. Automatic noticing waits until
typing settles, while a local gate keeps
ordinary logistics in the browser. For a consequential draft, **Living Margin**
softly marks the exact local phrase that prompted a pause—without changing the
editor or sending text merely to draw the mark. The person chooses whether to
open it. The card then offers a verified passage, collapsible publisher attribution, and
one specific relational question. Guard can offer optional alternatives. A
gold Guide affirms gratitude, good news, or freely offered help without
questioning the person's motive, correcting them, or offering a rewrite. It never posts, blocks Send, or
replaces the original without a click.

This is deliberately not a Bible app painted onto email. Scripture changes the
decision already being made. Its discernment can guard anger, guide pain,
affirm generosity and joy, or stay silent. Silence is a valid outcome for
ordinary correspondence.

Gloo provides structured discernment: it identifies the human moment, selects
one reviewed principle, and ranks only allowed reference IDs. It cannot return
Scripture text. YouVersion is the sole Scripture source: the Worker resolves
the selected passage at runtime and displays its translation and required
publisher attribution, or fails closed. A signed token binds any optional
rewrite to the exact analysed draft and incoming context, so a stale or altered
message cannot receive a suggestion intended for something else.

The technical posture is restrained: no draft persistence or body logging,
strict schemas, an 8 KiB boundary, fenced reply context, shadow-DOM overlays,
and a built-artifact gate. The public evaluation covers 54 cases:
15/15 weighty drafts met; 0/8 ordinary task messages received a passage; 0
outside-library references rendered; and injected instructions were held.

Our hope is not that millions write more polished messages. It is that, before
words become a wound or a regret, more people regain the freedom to speak truth
with grace, make repair, and give thanks.

<!-- Before publishing: verify `REQUIRE_GLOO=1 npm run preflight`, replace this
comment with a one-sentence live-Gloo proof, and add the public demo/video links. -->
