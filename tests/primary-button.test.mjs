// @ts-check
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("../css/", import.meta.url);
const sheets = readdirSync(dir).filter((f) => f.endsWith(".css") && f !== "flavours.css").map((f) => [f, readFileSync(new URL(f, dir), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")]);
const tokens = readFileSync(new URL("../core/ui/tokens.css", import.meta.url), "utf8");
const css = (f) => sheets.find(([n]) => n === f)[1];
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("the primary tokens are the accent's by default", () => {
  assert.match(tokens, /--pri-fill:var\(--accent-fill\); --pri-fill-hover:var\(--accent-hover\); --pri-fill-press:var\(--accent-press\); --pri-ink:var\(--accent-ink\);/);
});
const { FLAVOURS } = await import("../js/flavours.js");
t("a flavour with primary ink fills its main actions with the ink, and no other flavour does", () => {
  const fl = readFileSync(new URL("flavours.css", dir), "utf8");
  const ink = FLAVOURS.filter((f) => f.primary === "ink").map((f) => f.id);
  assert.ok(ink.length > 0 && ink.length < FLAVOURS.length);
  const set = [...fl.matchAll(/:root\[data-flavour="([a-z]+)"\]\{\s*--pri-fill:var\(--ink\); --pri-fill-hover:var\(--ink-hi\); --pri-fill-press:color-mix\(in srgb,var\(--ink\) 76%,var\(--canvas\)\); --pri-ink:var\(--on-ink\)\s*\}/g)].map((m) => m[1]);
  assert.deepEqual(set, ink);
  assert.equal((fl.match(/--pri-fill:/g) || []).length, ink.length);
});
t("every main action takes them: .btn-pri, .xd-btn.is-pri and the round sends; a card's Send and the picker's Done stay the ink", () => {
  const app = css("app.css"), diffs = css("diffs.css");
  assert.match(app, /\n\.btn-pri\{background:var\(--pri-fill\);border-color:var\(--pri-fill\);color:var\(--pri-ink\)\}/);
  assert.match(diffs, /\n\.xd-btn\.is-pri\{background:var\(--pri-fill\);border-color:var\(--pri-fill\);color:var\(--pri-ink\)\}/);
  assert.match(app, /\n\.b-go\{background:var\(--ink\);color:var\(--on-ink\);border-color:var\(--ink\)\}/);
  assert.match(app, /\n\.iq-done\{[^}]*background:var\(--ink\);color:var\(--on-ink\)/);
  assert.match(app, /\n\.send\{[^}]*background:var\(--pri-fill\);color:var\(--pri-ink\)/);
  assert.match(diffs, /\n\.xd-q \.xd-send\{[^}]*background:var\(--pri-fill\);color:var\(--pri-ink\)/);
  for (const [f, s] of sheets) assert.doesNotMatch(s, /(\.btn-pri|\.xd-btn\.is-pri|\.b-go|\.iq-done|\.send|\.xd-send)[^{,]*\{[^}]*var\(--accent-(fill|hover|press)\)/, f);
});
t("a scoped rule for links in words never reaches a classed link (a link drawn as a button)", () => {
  const bad = [];
  for (const [f, s] of sheets) for (const m of s.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const sel of m[1].split(",")) if (/\s a(:hover|:visited)?$/.test(sel.trim()) && /(^|;)(color|text-decoration)/.test(m[2])) bad.push(`${f}: ${sel.trim()}`);
  }
  assert.deepEqual(bad, []);
});
console.log(`\n${passed} passed`);
