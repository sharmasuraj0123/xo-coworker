// Saving a file (Files › Edit, js/viewer.js saveOutcome): every refusal Space can give means one thing, in
// words, and none of them loses your edit or overwrites the agent's. The flows themselves were run end to
// end against xo-space's sandbox (tools/diffview/p3flow.cjs). No network, no browser.
//   node tests/edits.test.mjs
import assert from "node:assert/strict";

globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const { saveOutcome } = await import("../js/viewer.js");
const err = (status, code, extra = {}) => Object.assign(new Error(`${status} ${code}`), { status, code, ...extra });

let passed = 0;
const t = (name, fn) => {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
};

t("a file that runs code: ask, then send again with confirm", () => {
  assert.equal(saveOutcome(err(428, "confirm_required")).kind, "confirm");
});
t("the file changed meanwhile: merge with what's there now (sent with the 409)", () => {
  assert.equal(saveOutcome(err(409, "file_changed", { current: { content: "x", version: "v2" } })).kind, "conflict");
  // a 409 without the current version can't be merged: said, never forced
  const o = saveOutcome(err(409, "file_changed"));
  assert.equal(o.kind, "error");
  assert.match(o.words, /copy your edit/);
});
t("a place XO keeps: read only from now on, in words", () => {
  assert.deepEqual(saveOutcome(err(403, "read_only_place")), { kind: "readonly", words: "XO keeps this file: it can't be saved here" });
});
t("other refusals, in words", () => {
  assert.equal(saveOutcome(err(403, "outside_project")).words, "This file is outside the project");
  assert.equal(saveOutcome(err(403, "ui_only")).words, "Saving isn't allowed here");
  assert.equal(saveOutcome(err(503, "writer_key_missing")).words, "XO Space hasn't enabled saving yet");
  assert.equal(saveOutcome(err(0, "network")).words, "0 network");
});

console.log(`\n${passed} passed`);
