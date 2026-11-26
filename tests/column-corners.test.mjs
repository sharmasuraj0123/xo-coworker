import assert from "node:assert/strict";
import { sheet } from "./lib/cascade.mjs";

const FILES = ["../modules/conversation/conversation.css", "../core/ui/markdown/rich.css", "../modules/conversation/msgx.css", "../modules/conversation/media/media.css", "../css/app.css"];
const CARDS = ["tcard", "m-ext", "ev-space", "ho-card", "lim-ban", "ckbar", "md-code", "md-table", "md-chart", "md-diagram", "mx-one", "mx-album"];
const read = (f) => sheet(new URL(f, import.meta.url));

const rules = [];
for (const f of FILES) {
  for (const m of read(f).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const radius = /(?:^|;)\s*border-radius:([^;]+)/.exec(m[2]);
    for (const sel of m[1].split(",").map((s) => s.trim())) if (sel && !sel.startsWith("@")) rules.push({ f, sel, d: m[2], radius: radius?.[1].trim() ?? null });
  }
}
const subject = (sel) => sel.split(/[\s>+~]+/).pop();
const has = (part, card) => new RegExp(`\\.${card}(?![\\w-])`).test(part);

const outer = rules.filter((r) => r.radius && !r.sel.includes("::") && CARDS.some((c) => has(subject(r.sel), c)));
assert.ok(outer.length >= CARDS.length, "every card in the column was found");
const odd = outer.filter((r) => r.radius !== "var(--r-block)").map((r) => `${r.f}: ${r.sel} → ${r.radius}`);
assert.deepEqual(odd, [], "every card in the conversation column takes --r-block");
const bubbleCopy = rules.find((r) => r.sel === ":root[data-msgx] .msgs>.m-ext>.mb");
assert.equal(bubbleCopy?.radius, "var(--r-block)", "the copied card in bubbles is a column card too");

const INSIDE = /^(?:var\(--r-block(?:-in)?\)(?: var\(--r-block(?:-in)?\) 0 0| 0 0)?|0 0 var\(--r-block-in\) var\(--r-block-in\)|calc\(var\(--r-block(?:-in)?\) - \d+px\)|var\(--r-pill\)|inherit|0|50%)$/;
const inner = rules.filter((r) => r.radius && !r.sel.includes("::") && CARDS.some((c) => has(r.sel, c) && !has(subject(r.sel), c)));
const loose = inner.filter((r) => !INSIDE.test(r.radius)).map((r) => `${r.f}: ${r.sel} → ${r.radius}`);
assert.deepEqual(loose, [], "what sits inside a column card takes its corner from --r-block, or is a pill");

const rule = (f, sel) => { const r = rules.find((x) => x.f.endsWith(f) && x.sel === sel); assert.ok(r, `${f}: ${sel}`); return r; };
const CONCENTRIC = [
  ["conversation.css", ".tc-next", "calc(var(--r-block-in) - 6px)", /margin:0 6px 6px/],
  ["msgx.css", ":root[data-msgx] .m-them .tc-next", "calc(var(--r-block) - 12px)", /margin:0 12px 12px/],
  ["msgx.css", ":root[data-msgx] .m-them .tcard.st-needs>.tc-dec", "calc(var(--r-block) - 12px)", /right:12px;bottom:12px/],
  ["msgx.css", ":root[data-msgx] .m-them .tc-segs .sg", "calc(var(--r-block) - 16px)", null],
];
for (const [f, sel, radius, inset] of CONCENTRIC) {
  const r = rule(f, sel);
  assert.equal(r.radius, radius, `${sel}: its corner is the card's less its inset`);
  if (inset) assert.match(r.d, inset, `${sel}: sits at that inset`);
}
assert.match(rule("msgx.css", ":root[data-msgx] .m-them .tc-segs").d, /padding:16px/, "the segments sit 16 px in, as their corner says");
for (const [f, sel] of [["rich.css", ":root:not([data-msgx]) .tc-open"], ["conversation.css", ".tc-open"], ["conversation.css", ".ck-tog"]]) {
  assert.equal(rule(f, sel).radius, "var(--r-block-in)", `${sel} fills its card inside the line`);
}

const tokens = read("../core/ui/tokens.css");
assert.match(tokens, /--r-block:var\(--r-lg\); --r-block-in:calc\(var\(--r-block\) - var\(--hair\)\);/);
assert.match(tokens, /:root\[data-msgx\]\{--r-block:var\(--r-xl\)\}/, "with chat bubbles on, column cards round like the bubbles");
console.log("column-corners: ok");
