// @ts-check

import assert from "node:assert/strict";
import { createScope } from "../../../core/kernel/scope.js";
import { dom, same } from "../../../tests/lib/dom.mjs";

const { document, window } = await dom(`
  <main id="home"><div id="hm-next"><article class="next" data-key="current" tabindex="-1">
    <button data-nx-opt="0">Blue</button><button data-nx-back>Send back</button>
    <div class="nx-note" hidden><textarea id="nx-note-in"></textarea>
      <button data-nx-send>Send</button><button data-nx-cancel>Cancel</button>
    </div>
  </article></div></main>`);
class TestKey extends window.Event {
  constructor(key, flags = {}) {
    super("keydown", { bubbles: true, cancelable: true });
    Object.assign(this, { key, ...flags });
  }
}
Object.assign(globalThis, {
  HTMLButtonElement: window.HTMLButtonElement,
  HTMLTextAreaElement: window.HTMLTextAreaElement,
  KeyboardEvent: TestKey,
  matchMedia: () => ({ matches: true }),
});
const { bindHomeDecisionControls } = await import("../decision-controls.js");
const scope = createScope();
const home = document.getElementById("home");
const card = home.querySelector(".next"), note = home.querySelector("textarea");
const back = home.querySelector("[data-nx-back]"), option = home.querySelector("[data-nx-opt]");
const decisions = [], details = [];
const need = { key: "current", ask: { options: ["Blue"] }, effort: "glance" };
bindHomeDecisionControls(home, {
  next: () => need, isBinary: () => false, decide: (...args) => decisions.push(args), details: (key) => details.push(key),
}, scope);

option.click();
assert.deepEqual(decisions, [[{ option: "Blue" }]]);
assert.equal(option.classList.contains("pressed"), true);
card.dispatchEvent(new TestKey("1", { repeat: true }));
assert.equal(decisions.length, 1, "a held shortcut does not submit twice");
card.dispatchEvent(new TestKey("1"));
assert.deepEqual(decisions.at(-1), [{ option: "Blue" }]);
card.dispatchEvent(new TestKey("Enter"));
assert.deepEqual(details, ["current"]);

back.click();
same(document.activeElement, note, "Send back focuses the note");
note.value = "Try the other option";
note.dispatchEvent(new TestKey("Enter", { isComposing: true }));
assert.equal(decisions.length, 2, "the input method owns its Enter");
note.dispatchEvent(new TestKey("Enter"));
assert.deepEqual(decisions.at(-1), ["deny", "Try the other option"]);
note.dispatchEvent(new TestKey("Escape"));
same(document.activeElement, card, "Escape returns focus to the card");
assert.equal(home.querySelector(".nx-note").hidden, true);

scope.dispose();
assert.equal(scope.size, 0);
option.click();
card.dispatchEvent(new TestKey("Enter"));
assert.equal(decisions.length, 3);
assert.deepEqual(details, ["current"]);
