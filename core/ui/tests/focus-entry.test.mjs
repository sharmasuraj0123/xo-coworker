// @ts-check

import assert from "node:assert/strict";
import { dom, same } from "../../../tests/lib/dom.mjs";
import { entryInput, focusEntry, keepFocusInView } from "../a11y/focus.js";

const { document } = await dom('<h2 tabindex="-1">Thread</h2><textarea aria-label="Reply"></textarea>');
const title = document.querySelector("h2");
const field = document.querySelector("textarea");
assert.equal(focusEntry(field, title, "touch"), true);
same(document.activeElement, title);
assert.equal(focusEntry(field, title, "pointer"), true);
same(document.activeElement, field);
assert.equal(focusEntry(field, title, "keyboard"), true);
same(document.activeElement, field);
field.hidden = true;
assert.equal(focusEntry(field, title, "keyboard"), true);
same(document.activeElement, title);
title.hidden = true;
field.hidden = false;
field.blur();
assert.equal(focusEntry(field, title, "touch"), false);
assert.ok(document.activeElement !== field);

const { window, document: panelDocument } = await dom('<button type="button">Open</button><button type="button">Other</button>');
const [opener, other] = panelDocument.querySelectorAll("button");
const dispose = keepFocusInView(panelDocument, window);
const pointer = Object.assign(new window.Event("pointerdown", { bubbles: true }), { pointerType: "touch" });
opener.dispatchEvent(pointer);
const click = (target, detail, pointerType = "") => {
  const event = Object.assign(new window.Event("click", { bubbles: true }), { detail, pointerType });
  let input;
  target.addEventListener("click", () => { input = entryInput(event); }, { once: true });
  target.dispatchEvent(event);
  return input;
};
assert.equal(click(opener, 1), "touch", "a synthesized mouse click can follow a touch press");
assert.equal(click(opener, 0), "keyboard", "keyboard activation ignores the preceding touch");
assert.equal(click(opener, 1, "mouse"), "pointer", "a fine pointer overrides the previous press");
assert.equal(click(other, 1), "pointer", "touch input stays associated with the initiating control");
dispose();
assert.equal(click(opener, 1), "pointer", "disposal forgets the previous press");
opener.dispatchEvent(Object.assign(new window.Event("pointerdown", { bubbles: true }), { pointerType: "touch" }));
assert.equal(click(opener, 1), "pointer", "disposed focus capture ignores further presses");
