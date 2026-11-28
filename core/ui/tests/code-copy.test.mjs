import assert from "node:assert/strict";
import { mock } from "node:test";
import { deferred, dom, same } from "../../../tests/lib/dom.mjs";
import { createCodeCopy } from "../markdown/copy.js";

const { document, window } = await dom('<div class="md-code"><button>Copy</button><pre><code>const a = 1;</code></pre></div>');
const button = document.querySelector("button");
const replies = [], announcements = [];
Object.defineProperty(navigator, "clipboard", {
  value: { writeText(text) { const answer = deferred(); replies.push({ text, answer }); return answer.promise; } },
});
globalThis.isSecureContext = true;
window.HTMLTextAreaElement.prototype.select = () => {};
document.execCommand = () => false;
mock.timers.enable({ apis: ["setTimeout"] });
const { copy, dispose } = createCodeCopy((text, isCurrent) => announcements.push({ text, isCurrent }));
button.focus();

const first = copy(button);
const second = copy(button);
assert.deepEqual(replies.map(({ text }) => text), ["const a = 1;", "const a = 1;"]);
assert.equal(button.textContent, "Copy");
replies[1].answer.resolve();
await second;
assert.equal(button.textContent, "Copied");
replies[0].answer.reject(new Error("Access refused"));
await first;
assert.equal(button.textContent, "Copied");
assert.deepEqual(announcements.map(({ text }) => text), ["Copied the code."]);
same(document.activeElement, button);

const third = copy(button);
assert.equal(announcements[0].isCurrent(), false, "A superseded acknowledgement cannot reach the live region");
mock.timers.tick(1500);
assert.equal(button.textContent, "Copied", "The older timer cannot reset a newer copy");
replies[2].answer.reject(new Error("Access refused"));
await third;
assert.equal(button.textContent, "Copy");
assert.match(announcements.at(-1).text, /^Couldn't copy/);
same(document.activeElement, button);

const expiring = copy(button);
replies[3].answer.resolve();
await expiring;
assert.equal(button.textContent, "Copied");
mock.timers.tick(1399);
assert.equal(button.textContent, "Copied");
mock.timers.tick(1);
assert.equal(button.textContent, "Copy", "the current acknowledgement expires after 1400 ms");

const pending = copy(button);
dispose();
replies[4].answer.resolve();
await pending;
assert.equal(button.textContent, "Copy");
assert.equal(announcements.length, 3);
mock.timers.reset();
