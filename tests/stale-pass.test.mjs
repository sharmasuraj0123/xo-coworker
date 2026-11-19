// Every control the shared link state reaches has its row in the Recheck list for a4faed2, and the list names no other.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sourcePaths } from "./lib/sources.mjs";

const R = new URL("../", import.meta.url);
const read = (f) => readFileSync(new URL(f, R), "utf8");
const found = read("css/foundation.css").replace(/\/\*[\s\S]*?\*\//g, "");
const reg = JSON.parse(read("e2e/fixtures/controls/controls-ids.json")).ids;
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("every control the shared link state reaches has its row in the Recheck list, and only those", () => {
  const sel = /:is\(([^)]*)\)\{transition:color var\(--d-hover\)/.exec(found);
  assert.ok(sel, "the shared link state in foundation.css");
  const classes = sel[1].split(",").map((x) => x.trim().replace(/^\./, ""));
  const src = ["index.html", ...sourcePaths(".js")].map(read).join("\n");
  // each element with one of the classes, keyed as the registry keys it: its tag and its data- hooks
  const keys = new Set();
  for (const m of src.matchAll(/<(button|a)\b([^>]*)>/g)) {
    const c = /class="([^"]*)"/.exec(m[2]);
    if (!c || !c[1].split(/\s+/).some((k) => classes.includes(k))) continue;
    const hooks = [...m[2].matchAll(/(data-[\w-]+)(?:="([^"$]*)")?/g)];
    const cls = c[1].split(/\s+/).find((k) => classes.includes(k));
    keys.add(`${m[1]}|${hooks.map((h) => h[1]).join(",")}|${hooks.map((h) => `${h[1]}=${h[2] || ""}`).join(",")}|${cls}`);
  }
  // a control with data- hooks is keyed by them (tag[hooks]); one without, by its tag and class (a.lp-ln)
  const rowsFor = (k) => {
    const [tag, names, pairs, cls] = k.split("|");
    if (!names) return Object.entries(reg).filter(([, e]) => [e.key, ...(e.aliases || [])].some((x) => x === `${tag}.${cls}` || x.startsWith(`${tag}.${cls} `) || x.includes(` ${tag}.${cls}`))).map(([id]) => id);
    return Object.entries(reg).filter(([, e]) => { const key = e.key; if (!key.startsWith(tag + "[")) return false; return names.split(",").every((n) => key.includes(n)) && pairs.split(",").every((p) => { const [n, v] = p.split("="); return !v || !key.includes(`${n}=`) || key.includes(`${n}=${v}`); }); }).map(([id]) => id);
  };
  const reached = new Set([...keys].flatMap(rowsFor));
  const listed = new Set(JSON.parse(read("e2e/fixtures/controls/link-rows.json")));
  const missing = [...reached].filter((id) => !listed.has(id)).sort(), extra = [...listed].filter((id) => !reached.has(id)).sort();
  assert.deepEqual(missing, [], `rows the shared state reaches, missing from Recheck: ${missing.join(", ")}`);
  assert.deepEqual(extra, [], `rows in Recheck it doesn't reach: ${extra.join(", ")}`);
  assert.ok(reached.has("S238") && reached.has("S139"), "Runs' Try again and the viewer's");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
