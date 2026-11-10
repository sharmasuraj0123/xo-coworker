// The sidebar's Find a project (#pf-in, C007; grader B on c767cbf): with the keyboard in it, its box shows the one base
// ring (2 px of the focus colour), the very rule Find an artifact's box has. It showed only its 1 px edge brightening
// (1.7:1 light, 2.5:1 dark), pixel-identical to unfocused at 1440. No browser: the stylesheets say which boxes get the
// ring, and that nothing takes it away from this one.
//   node tests/conv-find-ring.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const dir = new URL("../css/", import.meta.url);
const css = Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith(".css")).map((f) => [f, readFileSync(new URL(f, dir), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")]));
// the rule that draws the ring on a box holding a borderless search field
const ringRule = () => {
  const m = /:is\(([^)]*)\):has\(input:focus-visible\)[^{]*\{([^}]*)\}/.exec(css["foundation.css"]);
  assert.ok(m, "foundation.css: the boxed search fields' ring rule");
  return { boxes: m[1].split(",").map((x) => x.trim()), body: m[2] };
};

t("Find a project's box gets the same base ring as Find an artifact's: one rule, 2 px of the focus colour", () => {
  const { boxes, body } = ringRule();
  assert.ok(boxes.includes(".ar-q"), "Find an artifact's box is in it");
  assert.ok(boxes.includes(".side-find"), `Find a project's box is in it too (${boxes.join(", ")})`);
  assert.match(body, /outline:\s*2px solid var\(--focus\)/);
});

t("nothing takes that ring away from the sidebar's search box", () => {
  for (const [f, text] of Object.entries(css)) {
    for (const m of text.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      const [sel, body] = [m[1], m[2]];
      if (/\.side-find(?![\w-])/.test(sel) && !/\binput\b|#pf-in/.test(sel.split(",").find((s) => /\.side-find/.test(s)) || "") && /outline\s*:\s*(none|0)\b/.test(body)) assert.fail(`${f}: ${sel.trim()} takes the box's outline away`);
    }
  }
});

console.log(`${passed} passed`);
