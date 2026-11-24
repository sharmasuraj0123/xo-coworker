import assert from "node:assert/strict";
import { sheet } from "./lib/cascade.mjs";

const css = sheet(new URL("../css/app.css", import.meta.url));
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("the frame clips without being a scroll container", () => {
  const r = /(?:^|[}\n])\.dg\{([^}]*)\}/.exec(css);
  assert.ok(r, "the .dg rule");
  assert.match(r[1], /overflow:clip/);
  assert.doesNotMatch(r[1], /overflow:(hidden|auto|scroll)/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
