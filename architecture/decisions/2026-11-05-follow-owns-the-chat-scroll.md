# `follow.js` owns the conversation's scroll

- **Decided:** November 2026, from repeated regressions, all of them "bumps".
- **Rule:**
  - Only `follow.js` (and `drawConv`'s place holding) writes a conversation's `scrollTop`.
  - The message list stays a normal-flow list inside a real scroller, so the browser anchors older pages that land above.
- **Never use:** `column-reverse`, windowing or virtualisation, `content-visibility`, or transforms on the list. Each one broke anchoring.
- **Other modules:** call the conversation's `unpin`/`toRow`, and focus with `{preventScroll: true}` inside the scroller.
