// The sidebar's Find a project (#pf-in, C007) and Find an artifact's box follow the one rule for every message and search
// box: no ring of their own while you type (the owner, 11 Nov 07:52Z: "remove the current border of textbox"; it was a
// 2 px ring of the focus colour, after grader B on c767cbf, C007). No browser: the stylesheets say which boxes the rule
// reaches, and that nothing draws a ring on the sidebar's box anyway.
//   node tests/conv-find-ring.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
const css = readdirSync(new URL("../css/", import.meta.url)).filter((f) => f.endsWith(".css")).map((f) => [f, readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")]);
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const all = css.map(([, s]) => s).join("\n");
t("Find a project's box and Find an artifact's are in the one no-ring rule", () => {
  const m = /:is\(([^)]*)\):has\(:is\(input,textarea\):focus-visible\)[^{]*\{outline:none\}/.exec(all);
  assert.ok(m, "the rule"); for (const b of [".side-find", ".ar-q"]) assert.ok(m[1].split(",").includes(b), `${b} in it`);
});
t("nothing draws a ring on the sidebar's search box", () => {
  const ringed = [];
  for (const [f, s] of css) for (const m of s.matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (/\.side-find|#pf-in/.test(m[1]) && /focus/.test(m[1]) && /outline:\s*[0-9]|box-shadow:[^;]*var\(--focus\)/.test(m[2])) ringed.push(`${f}: ${m[1].trim().slice(0, 80)}`);
  assert.deepEqual(ringed, []);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
