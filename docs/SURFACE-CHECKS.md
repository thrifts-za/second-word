# Surface checks

Every selector in `extension/src/adapters/conversation.ts` is a guess until it
has been run against the real product. This is not pessimism, it is the record:
on 2026-07-21 the Gmail adapter had been green in tests for weeks and mounted
nothing at all on a real inbox, because the fixture had been written from the
same assumption as the selector and the two agreed with each other.

So: one console paste per surface, logged in, with the composer open.

## The probe

Open the site, click into the box you would type a reply into, and paste this
into the browser console.

```js
const RULES = {
  'slack.com':        { message: '[data-qa="message-text"], .c-message_kit__blocks .p-rich_text_section', mine: '.c-message--is-by-me, [data-qa-is-by-me="true"]' },
  'teams.microsoft.com': { message: '[data-tid="messageBodyContent"]', mine: '[data-tid="message-own"], .ui-chat__item--mine' },
  'web.whatsapp.com': { message: '.message-in .selectable-text' },
  'x.com':            { message: '[data-testid="tweetText"]' },
  'linkedin.com':     { message: '.msg-s-event-listitem__body, .comments-comment-item__main-content', mine: '.msg-s-event-listitem--user-own-message' },
  'reddit.com':       { message: '[data-test-id="post-content"] .md, shreddit-comment .md' },
};
const key = Object.keys(RULES).find(k => location.host.includes(k));
const rule = RULES[key];
const el = document.activeElement;
console.log('host rule      :', key || 'NONE - add one');
console.log('composer focused:', el && el.tagName, el && (el.getAttribute('role') || el.type || ''));
if (rule) {
  const all = [...document.querySelectorAll(rule.message)];
  console.log('messages found :', all.length);
  const outside = all.filter(m => !el.contains(m));
  const notMine = rule.mine ? outside.filter(m => !m.closest(rule.mine)) : outside;
  console.log('not mine       :', notMine.length);
  const last = notMine[notMine.length - 1];
  console.log('would read     :', last ? JSON.stringify(last.innerText.trim().slice(0, 120)) : 'NOTHING');
  console.log('my own detected:', rule.mine ? outside.length - notMine.length : 'no rule');
}
```

## Reading the result

| Output | Meaning | Action |
|---|---|---|
| `messages found: 0` | the message selector is wrong for this product today | send me the DOM of one message bubble |
| `would read` is the other person's most recent message | correct | nothing, ship it |
| `would read` is **your own** message | the `mine` rule is wrong or missing | send me the class list of one of your own bubbles |
| `would read` is a name, timestamp or reaction | the selector is matching chrome rather than a body | send me the bubble's inner HTML |
| `my own detected: 0` in a conversation where you have written | `mine` is not matching | same as above |

The failure that matters is the third row. Reading your own last message as
"the message being answered" would weigh a reply against itself, which is the
one thing Proverbs 16:2 says cannot be done, so it is worth the two minutes to
confirm per surface.

## Status

Fill this in as each is checked, with the date, because these products change.

| Surface | Checked | Result |
|---|---|---|
| Gmail | 2026-07-21 | Verified live. 4 message bodies, quote and signature blocks present to strip |
| Slack | not yet | |
| Teams | not yet | |
| WhatsApp Web | not yet | |
| X | not yet | |
| LinkedIn | not yet | |
| Reddit | not yet | |

An unchecked surface is not broken. `readConversation` returns null on anything
it cannot read confidently, and the draft is analysed alone, which is exactly
what shipped before any of this existed. The cost of an unverified selector is
a missing capability, never a wrong one.

## When a surface is verified

Two things change together, or the demo starts lying again:

1. The row above gets a date.
2. The public demo's per-surface line may then claim the conversation is read
   on that surface. Until then it says only what is true: *only what you type
   is read.*
