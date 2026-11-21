// On a phone the composer's recipient target is bounded: whatever it says, it gives way before the model chip and Send
// (the create-project grader on 9d1f71b, C111, 390 in both themes: with the Workspace's own routing Off the target
// showed "Sending is paused · …" whole, 307 px, and pushed the chip and the disabled Send out of the row: phone.css
// had it flex:none). Checked from the CSS; the drawn row is the flows case C111 (and the smoke gate checks Send and the
// chip on a phone).
//   node tests/target-bounded.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const phone = readFileSync(new URL("../css/phone.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const app = readFileSync(new URL("../css/app.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
t("the target shrinks first, to nothing if it must, and cuts its words short; the chip only leaves Attach and Send their room", () => {
  const m = /\n\.target\{([^}]*)\}/.exec(app);
  assert.ok(m, "the target's rule");
  assert.doesNotMatch(m[1], /flex:/, "it shrinks (flex's default), never rigid");
  assert.match(m[1], /min-width:0/, "to nothing if it must");
  assert.match(m[1], /overflow:hidden/, "its words cut, not spilling");
  assert.ok(!/:root:root \.target\{flex:none\}/.test(phone), "never rigid on a phone");
  const iq = /\n\.iq\{([^}]*)\}/.exec(app)[1];
  assert.match(iq, /flex:none/, "the chip never shrinks for the target");
  assert.match(iq, /max-width:min\(320px,100% - var\(--h-ctl\) - var\(--h-lg\) - 3 \* var\(--s-2\)\)/, "bounded by the row less Attach, Send and the gaps");
  assert.ok(/\.target>span:not\(\.tg-t\):not\(\.tg-warn\):not\(\.tg-end\)\{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/.test(app), "its words end in an ellipsis");
  assert.ok(/\.send\{flex:none;/.test(app), "Send keeps its size");
  assert.ok(/:root:root \.target:has\(> \.tg-warn\) > span:not\(\.tg-warn\)\{display:none\}/.test(phone), "paused, only its mark: the words are the banner above, the chip keeps its whole word");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
