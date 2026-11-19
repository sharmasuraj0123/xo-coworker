// Every Launchpad scenario a browser suite opens is one the harness's mockspace has, and nothing loads another mockspace.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";

const ROOT = new URL("../../../", import.meta.url);
const { SCENARIOS } = createRequire(import.meta.url)("../../../e2e/fixtures/mockspace-harness.cjs");
const files = ["tests/browser", "e2e/worlds"].flatMap((d) => readdirSync(new URL(`${d}/`, ROOT)).filter((f) => f.endsWith(".cjs")).map((f) => `${d}/${f}`));
const src = files.map((f) => [f, readFileSync(new URL(f, ROOT), "utf8")]);
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("each scenario the suites name is in mockspace-harness.cjs", () => {
  const named = new Set();
  for (const [, s] of src) {
    for (const m of s.matchAll(/launchpad:\s*"([a-z-]+)"/g)) named.add(m[1]);
    for (const m of s.matchAll(/for \(const sc of \[([^\]]+)\]\)/g)) for (const n of m[1].matchAll(/"([a-z-]+)"/g)) named.add(n[1]);
    for (const m of s.matchAll(/SCENARIOS\.([a-z]+)\b/g)) named.add(m[1]);
  }
  assert.ok(named.size >= 10, `${named.size} scenarios named`);
  assert.deepEqual([...named].filter((n) => !SCENARIOS[n]), [], "named by a suite, missing from the harness's mockspace");
});
t("the suites load the harness's mockspace and no other", () => {
  for (const [f, s] of src) for (const m of s.matchAll(/require\(["']([^"']*mockspace[^"']*)["']\)/g)) assert.match(m[1], /mockspace-harness\.cjs$/, f);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
