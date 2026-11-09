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
t("on a phone the target shrinks first, to nothing if it must, and cuts its words short", () => {
  const m = /:root:root \.target\{([^}]*)\}/.exec(phone);
  assert.ok(m, "the phone's target rule");
  assert.match(m[1], /flex:0 (\d+) auto/, "it can shrink");
  assert.ok(+/flex:0 (\d+) auto/.exec(m[1])[1] >= 10, "and shrinks before the chip (which shrinks by 1)");
  assert.match(m[1], /min-width:0/, "to nothing if it must");
  assert.match(m[1], /overflow:hidden/, "its words cut, not spilling");
  assert.ok(!/:root:root \.target\{flex:none\}/.test(phone), "never rigid");
  assert.ok(/\.target>span:not\(\.tg-t\):not\(\.tg-warn\):not\(\.tg-end\):not\(\.tg-ch\)\{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/.test(app), "its words end in an ellipsis");
  assert.ok(/\.send\{flex:none;/.test(app), "Send keeps its size");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
