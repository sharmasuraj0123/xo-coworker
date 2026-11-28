// A narrow top bar keeps the project's name: the threads button drops its total and keeps what's working and waiting.
import assert from "node:assert/strict";
import { test } from "node:test";
import { declarationsFor } from "./lib/css-snapshot.mjs";

const narrow = (row) => row.context.some((at) => at.at === "container" && /^top \(max-width:\s*\d+px\)$/.test(at.params ?? ""));
const shown = (part) => declarationsFor((selector) => selector.startsWith(".top .tw-act.th-ctl>") && selector.includes(part), "display")
  .filter(narrow).map((row) => row.value);

test("in a narrow top bar the total thread count is hidden, with the word Threads", () => {
  assert.deepEqual(shown(".th-n"), ["none"]);
  assert.deepEqual(shown(".th-w"), ["none"]);
});

test("the working and waiting counts stay", () => {
  assert.equal(shown(".th-seg").includes("none"), false);
  assert.deepEqual(declarationsFor(".th-ctl .th-seg", "display").map((row) => row.value), ["inline-flex"]);
});

test("the first count after the icon has no divider in front of it", () => {
  const lead = (property) => declarationsFor(".top .tw-act.th-ctl>.th-n+.th-seg", property).filter(narrow).map((row) => row.value);
  assert.deepEqual(lead("border-left"), ["0"]);
});
