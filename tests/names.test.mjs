// Two functions with the same name at the same depth in one module: the later one silently replaces the
// earlier (function declarations hoist). That made the file viewer's Download call Edit's save() and do
// nothing (5 Nov). Every module under js/ is scanned.
//   node tests/names.test.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../js/", import.meta.url).pathname;
const files = [];
const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) { if (n !== "vendor") walk(p); } else if (n.endsWith(".js")) files.push(p); } };
walk(root);
let bad = 0;
for (const f of files) {
  const seen = new Map();
  readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    const m = /^(\s*)(?:async\s+)?function\s*\*?\s*(\w+)\s*\(/.exec(line);
    if (!m) return;
    const k = `${m[1].length}:${m[2]}`;
    if (seen.has(k)) { bad++; console.error(`  FAIL ${f.slice(root.length)}: function ${m[2]} at lines ${seen.get(k)} and ${i + 1} (the second replaces the first)`); }
    else seen.set(k, i + 1);
  });
}
if (bad) process.exitCode = 1;
console.log(`${files.length} modules scanned, ${bad} duplicate function name${bad === 1 ? "" : "s"}`);
