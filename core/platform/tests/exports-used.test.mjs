// node core/platform/tests/exports-used.test.mjs: every name core/platform exports is imported somewhere, so nothing dead stays in it.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const PLATFORM = join(ROOT, "core/platform");
const walk = (dir, out = []) => {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (n === "vendor" || n === "node_modules") continue;
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.(m?js)$/.test(n)) out.push(p);
  }
  return out;
};
const users = ["js", "core", "shell", "modules", "apps-host", "tests", "e2e"].flatMap((d) => walk(join(ROOT, d))).concat(existsSync(join(ROOT, "boot.js")) ? [join(ROOT, "boot.js")] : []);
const sources = users.map((f) => ({ f, text: readFileSync(f, "utf8") }));

const exportsOf = (text) => [...text.matchAll(/^export (?:async )?(?:function\*? |const |let |class )([A-Za-z_$][\w$]*)/gm)].map((m) => m[1])
  .concat([...text.matchAll(/^export \{([^}]*)\}(?! from)/gm)].flatMap((m) => m[1].split(",").map((s) => s.trim().split(/\s+as\s+/).pop()).filter(Boolean)));

const imported = (name, file) => sources.some(({ f, text }) => {
  if (f === file) return false;
  for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g)) if (m[1].split(",").some((s) => s.trim().split(/\s+as\s+/)[0] === name)) return true;
  for (const m of text.matchAll(/import\s*\*\s*as\s+([\w$]+)\s+from\s*"([^"]+)"/g)) if (new RegExp(`\\b${m[1]}\\.${name}\\b`).test(text)) return true;
  return false;
});

let passed = 0;
for (const f of walk(PLATFORM).filter((f) => !f.includes("/tests/") && basename(f) !== "index.js")) {
  const dead = exportsOf(readFileSync(f, "utf8")).filter((n) => !imported(n, f));
  assert.deepEqual(dead, [], `${f.slice(ROOT.length + 1)} exports names nothing imports`);
  passed++;
  console.log("  ok  " + f.slice(ROOT.length + 1));
}
assert.ok(passed >= 3, "found the platform's files");
console.log(`\n${passed} passed`);
