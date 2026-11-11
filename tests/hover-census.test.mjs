// Every button shows it's under the pointer, by one census (the controls grader on f93345a: Interrupt, Retry and Edit,
// .meta-btn, looked the same hovered and at rest, S037, S039, S040). A button answers the pointer by its own :hover
// rule, or by the shared lift of the meta inks (foundation.css: hovered, --ink-3 and --ink-4 step up to --ink-2), which
// shows only on words drawn in those inks: .meta-btn's were the second ink already, so nothing changed. Those that
// answer another way are listed with how; a new button with none fails here.
//   node tests/hover-census.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
const read = (f) => readFileSync(new URL(f, ROOT), "utf8");
const src = [read("index.html"), ...readdirSync(new URL("js/", ROOT)).filter((f) => f.endsWith(".js")).map((f) => read(`js/${f}`)), ...readdirSync(new URL("js/shells/", ROOT)).filter((f) => f.endsWith(".js")).map((f) => read(`js/shells/${f}`))].join("\n");
const css = readdirSync(new URL("css/", ROOT)).filter((f) => f.endsWith(".css")).map((f) => read(`css/${f}`).replace(/\/\*[\s\S]*?\*\//g, "")).join("\n");
// each button by the first class the templates give it
const buttons = new Set();
for (const m of src.matchAll(/<button\b([^>]*)>/g)) { const c = /class="([^"$]*)/.exec(m[1]); if (c) { const k = c[1].trim().split(/\s+/)[0]; if (k && !/^(is|st|k|m|t|r|e)-/.test(k)) buttons.add(k); } }
const hovers = [...css.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1]).filter((s) => /:hover/.test(s)).join("\n");
const restInk = (k) => { const m = new RegExp(`(^|[},\\n])\\s*\\.${k}\\{([^}]*)\\}`).exec(css); const c = m && /(?:^|;)color:var\((--ink-\d)\)/.exec(m[2]); return c ? c[1] : null; };
const answers = (k) => new RegExp(`\\.${k}(?![\\w-])[^,{]*:hover|:hover[^,{]*\\.${k}(?![\\w-])|\\.${k}(?![\\w-])[^{]*\\)[^{]*:hover`).test(hovers) || ["--ink-3", "--ink-4"].includes(restInk(k));
// those that answer another way, each with how
const OTHER = {
  "tc-open": [/\.tcard:hover\{/, "a thread card's body: the card itself lights (.tcard:hover)"],
  "vw-fold": [/\.vw-menu :is\(\[role=menuitem\],\[role=menuitemradio\]\):focus\{background:var\(--fill-2\)/, "an item of the file's ⋯ menu: the pointer moves the menu's focus (keynav pointerFollows), and focus fills it"],
  "side-x": [/\.side-x\{display:none\}/, "the drawer's close: a phone's, never drawn on a desktop"],
  "top-menu": [/\.top-menu\{display:none\}/, "the phone bar's menu: never drawn on a desktop"],
  "pb-menu": [/@media \(max-width:760px\)\{[\s\S]*?\.pb-menu\{display:grid/, "the phone bar's menu: drawn only on a phone"],
};
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("the census reads the buttons (Interrupt, Retry and Edit's .meta-btn among them)", () => {
  for (const k of ["meta-btn", "hr-undo", "xd-send", "rn-live", "c-where", "ev-undo"]) assert.ok(buttons.has(k), k);
  assert.ok(buttons.size > 120, `${buttons.size} buttons`);
});
t("every button answers the pointer: its own hover, the meta inks' lift, or a written other way", () => {
  const none = [...buttons].filter((k) => !answers(k) && !(k in OTHER)).sort();
  assert.deepEqual(none, [], `buttons that look the same hovered: ${none.join(", ")}`);
});
t("each other way still holds, and none is listed that answers by itself", () => {
  for (const [k, [re, why]] of Object.entries(OTHER)) { assert.match(css, re, `${k}: ${why}`); assert.ok(!answers(k), `${k} answers by itself now: take it off the list`); }
});
t("a button with no class of its own, styled by its parent (.ar-undo button), answers hover too (S024: All's Undo)", () => {
  // the census above names buttons by their first class; one drawn without a class escaped it. Every rule that draws
  // a classless button a box (a border or a fill) has its :hover
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]]);
  const boxed = rules.filter(([sel, d]) => /(^|[\s>])button$/.test(sel.split(",").pop().trim()) && !/^\.(?:[\w-]+ )*button$/.test("") && /(border:1px|background:var\(--(?:float|fill|surface))/.test(d)).map(([sel]) => sel.split(",").pop().trim());
  const hovered = new Set(rules.map(([sel]) => sel).join(",").split(",").map((x) => x.trim()).filter((x) => /button:hover/.test(x)).map((x) => x.replace(/:hover.*$/, "")));
  const silent = [...new Set(boxed)].filter((sel) => !hovered.has(sel) && !/\.lp-menu button|\.vw-seg button|\.dg-mode button|\.dg-tools button|\.rt-seg button|\.cp-mode button|\.iq-route button|\.all-f button|\.ar-kinds button|\.teach-scope button|\.set-nav button/.test(sel));
  assert.deepEqual(silent, [], `classless buttons with a box and no hover:\n  ${silent.join("\n  ")}`);
});
t("Interrupt, Retry and Edit: the next fill, the hover line, the first ink", () => {
  assert.match(css, /\.meta-btn:not\(:disabled\):hover\{background:var\(--fill-2\);border-color:var\(--line-hover\);color:var\(--ink\)/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
