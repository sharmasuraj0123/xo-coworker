// Every xo-select busy saving keeps focus but takes no new choice (the create-project grader on 9d1f71b, S209: while
// 70% saved, the busy threshold still opened, End then Enter showed 90% and sent nothing, and the 70% answer put it
// back; settings put aria-busy/aria-disabled on the host and dropdown.js only heeded disabled). Checked from the
// source: one "held" state from the host's busy attributes; held, it doesn't open and a choice is none; it hears those
// attributes change (closing an open list) and says it on the focused button, which stays focusable. The drawn
// sequence is settings.test.cjs "S209 a dropdown busy saving".
//   node tests/dropdown-held.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/dropdown.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
t("held: from the host's busy attributes", () => {
  assert.ok(/get held\(\) \{ return this\.getAttribute\("aria-busy"\) === "true" \|\| this\.getAttribute\("aria-disabled"\) === "true"; \}/.test(src));
});
t("held, it doesn't open and a choice is none", () => {
  assert.ok(/if \(this\._open \|\| this\.disabled \|\| this\.held \|\| !this\.options\.length\) return;/.test(src), "open()");
  assert.ok(/if \(this\.held\) \{ this\.close\(true\); return; \}/.test(src), "_choose()");
});
t("it hears its busy attributes change, closes an open list, and says it on the button (still focusable)", () => {
  assert.ok(/observedAttributes\(\) \{ return \["disabled", "aria-label", "aria-busy", "aria-disabled"\]; \}/.test(src));
  assert.ok(/if \(this\._open && \(this\.disabled \|\| this\.held\)\) this\.close\(true\);/.test(src));
  assert.ok(/for \(const a of \["aria-busy", "aria-disabled"\]\) \{ if \(this\.getAttribute\(a\) === "true"\) this\._btn\.setAttribute\(a, "true"\); else this\._btn\.removeAttribute\(a\); \}/.test(src));
  assert.ok(/this\._btn\.disabled = this\.disabled;/.test(src), "disabled only by disabled: busy keeps focus");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
