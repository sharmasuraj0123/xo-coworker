// A button that reads as a link in text answers hover and press, by one shared state (the controls grader on d79d37e,
// S139, all four cells: the viewer's Try again looked the same at rest, on hover and pressed: it rested at full ink,
// so hover had nowhere to go, and the shared press fill had no box to show in). Checked from the CSS: every
// underlined text button is in the shared state; hover brings its ink and underline up to full; a press dims it; it's
// out of the press fill; and none rests at full ink, so hover shows. The drawn states are the flows case S139 (paint).
//   node tests/link-buttons.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("../css/", import.meta.url);
const all = readdirSync(dir).filter((f) => f.endsWith(".css")).map((f) => [f, readFileSync(new URL(f, dir), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")]);
const found = readFileSync(new URL("foundation.css", dir), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const src = ["index.html", ...readdirSync(new URL("../js/", import.meta.url)).filter((f) => f.endsWith(".js")).map((f) => `js/${f}`)].map((f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8")).join("\n");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const LIST = /:is\(([^)]*)\)\{transition:color var\(--d-hover\)/.exec(found);

t("one shared state for buttons that read as links", () => {
  assert.ok(LIST, "foundation.css: :is(<the link-style buttons>){transition:…}");
  const list = LIST[1];
  const esc = list.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(found, new RegExp(`:is\\(${esc}\\):where\\(:hover:not\\(:disabled,\\[aria-disabled="true"\\],\\[aria-busy="true"\\]\\)\\)\\{color:var\\(--ink\\);text-decoration-color:currentColor\\}`), "hover: full ink and underline");
  assert.match(found, new RegExp(`:is\\(${esc}\\):where\\(:active:not\\(:disabled,\\[aria-disabled="true"\\],\\[aria-busy="true"\\]\\)\\)\\{opacity:\\.7\\}`), "press: it dims, as a link does");
  const press = found.split("\n").find((l) => l.includes("{background-image:linear-gradient(var(--press-fill),var(--press-fill))!important}"));
  assert.ok(press && press.includes(`:is(${list})`), "out of the shared press fill (no box to fill)");
});
t("every button styled as an underlined text link is in it, and none rests at full ink", () => {
  assert.ok(LIST);
  const listed = new Set(LIST[1].split(",").map((x) => x.trim().replace(/^\./, "")));
  const buttons = new Set([...src.matchAll(/<button\b[^>]*class="([^"$]*)"/g)].flatMap((m) => m[1].trim().split(/\s+/)));
  const underlined = new Set();
  const restInk = {};
  for (const [, s] of all) for (const m of s.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim();
    const k = /^(?:button)?\.([\w-]+)$/.exec(sel);
    if (!k || !buttons.has(k[1])) continue;
    if (/text-decoration:underline/.test(m[2])) underlined.add(k[1]);
    const c = /(?:^|;)color:([^;]+)/.exec(m[2]);
    if (c) restInk[k[1]] = c[1].trim();
  }
  const missing = [...underlined].filter((k) => !listed.has(k));
  assert.deepEqual(missing, [], `underlined text buttons outside the shared state: ${missing.join(", ")}`);
  const full = [...listed].filter((k) => restInk[k] === "var(--ink)");
  assert.deepEqual(full, [], `resting at full ink, so hover can't show: ${full.join(", ")}`);
  assert.ok(listed.has("vw-cut-dl") && underlined.has("vw-cut-dl"), "the viewer's Try again (and Download) is one");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
