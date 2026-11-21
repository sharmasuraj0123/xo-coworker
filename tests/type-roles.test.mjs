// Every text in the app takes a type role from tokens.css: no other size, line height or weight anywhere.
//   node tests/type-roles.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("../css/", import.meta.url);
const sheets = readdirSync(dir).filter((f) => f.endsWith(".css")).map((f) => [f, readFileSync(new URL(f, dir), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")]);
const tokens = sheets.find(([f]) => f === "tokens.css")[1];
const SIZES = ["meta", "ui", "code", "read", "title", "input", "heading", "display", "hero"];
const LINES = ["meta", "ui", "read", "title", "heading", "display", "hero"];
const WEIGHTS = ["regular", "read", "medium", "strong"];
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("tokens.css defines exactly the roles", () => {
  const fs = [...tokens.matchAll(/--fs-([\w-]+):/g)].map((m) => m[1]);
  const lh = [...tokens.matchAll(/--lh-([\w-]+):/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(fs)].sort(), [...SIZES].sort());
  assert.deepEqual([...new Set(lh)].sort(), [...LINES].sort());
  assert.match(tokens, /--fs-read:16px/); assert.match(tokens, /--fs-ui:14px/); assert.match(tokens, /--fs-meta:12px/);
});
t("reading is the full ink at the regular weight, on dark and light alike", () => {
  assert.match(tokens, /--fw-read:var\(--fw-regular\)/);
  assert.match(tokens, /--ink-read:var\(--ink\)/);
  assert.doesNotMatch(tokens, /--fw-read:3\d\d|--ink-read:color-mix/);
});
t("a thread's page title is the title role, as every top bar's", () => {
  const app = sheets.find(([f]) => f === "app.css")[1];
  for (const sel of [".tw-h{", ".tw-t h1{", ".tw-in{"]) assert.match(app.slice(app.indexOf(sel), app.indexOf("}", app.indexOf(sel))), /var\(--fs-title\)\/var\(--lh-title\)/, sel);
});
t("no stylesheet uses a size, line height or weight outside the roles", () => {
  const bad = [];
  for (const [f, css] of sheets) {
    if (f === "tokens.css") continue;
    for (const m of css.matchAll(/var\(--fs-([\w-]+)\)/g)) if (!SIZES.includes(m[1])) bad.push(`${f}: --fs-${m[1]}`);
    for (const m of css.matchAll(/var\(--lh-([\w-]+)\)/g)) if (!LINES.includes(m[1])) bad.push(`${f}: --lh-${m[1]}`);
    for (const m of css.matchAll(/var\(--fw-([\w-]+)\)/g)) if (!WEIGHTS.includes(m[1])) bad.push(`${f}: --fw-${m[1]}`);
    for (const m of css.matchAll(/font-size:\s*(\d+(?:\.\d+)?px)/g)) bad.push(`${f}: font-size ${m[1]}`);
    for (const m of css.matchAll(/(?:^|[;{\s])font:\s*(?:\d{3}\s+)?\d+(?:\.\d+)?px/g)) bad.push(`${f}: ${m[0].trim()}`);
    for (const m of css.matchAll(/font-weight:\s*(\d{3})/g)) bad.push(`${f}: font-weight ${m[1]}`);
    for (const m of css.matchAll(/(?:^|[;{\s])font:\s*(\d{3})\s/g)) bad.push(`${f}: font weight ${m[1]}`);
  }
  assert.deepEqual(bad, []);
});
t("small text is never bold", () => {
  const bad = [];
  for (const [f, css] of sheets) for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g))
    if (/var\(--fw-strong\)\s+var\(--fs-meta\)/.test(m[2]) || (/font-size:var\(--fs-meta\)/.test(m[2]) && /font-weight:var\(--fw-strong\)/.test(m[2]))) bad.push(`${f}: ${m[1].trim().slice(0, 60)}`);
  assert.deepEqual(bad, []);
});
t("the chat's words, the composer's text and tables read in the read role", () => {
  const app = sheets.find(([f]) => f === "app.css")[1];
  for (const sel of [".prose{", ".bubble{", ".composer textarea{", ".md-table table{"]) {
    const r = app.slice(app.indexOf(sel), app.indexOf("}", app.indexOf(sel)));
    assert.match(r, /font-size:var\(--fs-read\)/, sel); assert.match(r, /font-weight:var\(--fw-read\)/, sel);
  }
});
t("menus and the model picker read the ui and meta roles only; the picker's rows read the composer row's meta, as its chip", () => {
  const all = sheets.map(([, c]) => c).join("\n");
  const MENU = /^(?:\.iq-|\.tw-menu|\.vw-menu|\.dd-(?:menu|row)|\.lp-mn|\.fl-menu|\.side-pop)/;
  for (const m of all.matchAll(/(^|\n)([^{}@\n]+)\{([^}]*)\}/g)) {
    const sel = m[2].trim(); if (!MENU.test(sel)) continue;
    for (const v of m[3].matchAll(/(?:font-size:|font:[^;]*?)(var\(--fs-[\w-]+\)|\d+(?:\.\d+)?px)/g)) assert.match(v[1], /^var\(--fs-(ui|meta)\)$/, `${sel}: ${v[1]}`);
  }
  const app = sheets.find(([f]) => f === "app.css")[1];
  assert.match(app, /:is\(\.target,\.iq\)\{[^}]*font-size:var\(--fs-meta\)/);
  for (const sel of [".iq-n{", ".iq-more{"]) { const r = app.slice(app.indexOf(sel), app.indexOf("}", app.indexOf(sel))); assert.match(r, /var\(--fs-meta\)\/var\(--lh-meta\)/, sel); }
  for (const sel of [".iq-row{", ".iq-more{"]) { const r = app.slice(app.indexOf(sel), app.indexOf("}", app.indexOf(sel))); assert.match(r, /height:var\(--menu-row\)/, sel); }
});
console.log(`\n${passed} passed`);
