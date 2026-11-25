import assert from "node:assert/strict";
import { test } from "node:test";
import { askTitle, askShort } from "../ask-label.js";

test("the card renders inline code while its compact label reads as plain text", () => {
  const need = { ask: { live: true, title: "Review `index.js`" }, risk: "low" };
  assert.match(askTitle(need), /<code>index\.js<\/code>/);
  assert.equal(askShort(need), "Review index.js");
  const stopped = { ask: { kind: "stopped" }, t: { title: "parse <input>" }, risk: "low" };
  assert.equal(askTitle(stopped), "Stopped at parse &lt;input&gt;");
  assert.equal(askShort(stopped), "Stopped at parse <input>");
});
