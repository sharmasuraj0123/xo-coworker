// The phone's open drawer is a layer Tab goes round (the create-project/Launchpad grader on c055e74, phone, both themes:
// with the drawer open, Tab past Settings fell to BODY: the page behind is inert, and the Tab wrap knew only the
// sheets and a phone's Settings). Checked from the source: one keyLayer() names the layer that holds the keyboard,
// and the Tab wrap asks it. The walk is the flows case "phone drawer".
//   node tests/key-layer.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
t("one layer holds the keyboard: a sheet, a phone's Settings, else a phone's open drawer; the Tab wrap asks it", () => {
  const k = /function keyLayer\(\) \{([\s\S]*?)\n\}/.exec(app);
  assert.ok(k, "one keyLayer()");
  assert.match(k[1], /\[runsEl, keys, allEl, jump\]\.find\(\(el\) => !el\.hidden\)/, "the sheets first");
  assert.match(k[1], /PHONE\.matches && !setEl\.hidden \? setEl/, "a phone's Settings");
  assert.match(k[1], /PHONE\.matches && \$\("#app"\)\.classList\.contains\("drawer"\) \? \$\("#side"\)/, "the open drawer, on a phone");
  assert.ok(/if \(e\.key !== "Tab" \|\| e\.defaultPrevented\) return;\s*const top = keyLayer\(\);/.test(app), "the Tab wrap asks it");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
