// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { list } from "postcss";
import { substitute } from "../tools/conformance/css-resolve.mjs";
import { declarationsFor, stylesheetRows, tokenValuesFor, valuesFor } from "./lib/css-snapshot.mjs";

const base = Object.fromEntries(tokenValuesFor());
const phoneOverrides = stylesheetRows.filter((row) => row.context.at(-1)?.selector === ":root" && row.property?.startsWith("--")
  && row.context.some((scope) => scope.at === "media" && scope.params === "(max-width:760px)"));
const SCREENS = { desktop: base, phone: { ...base, ...Object.fromEntries(phoneOverrides.map((row) => [row.property, row.value])) } };

/** a px value from tokens and simple calc()s: var(--x) as its value on that screen, then the arithmetic */
const px = (expr, env, local = {}) => {
  let s = expr, guard = 0;
  while (/var\(--[\w-]+\)/.test(s) && guard++ < 20) s = s.replace(/var\((--[\w-]+)\)/g, (m, k) => { const v = local[k] ?? env[k]; assert.ok(v !== undefined, `${k} is defined`); return `(${v})`; });
  const v = Function(`return (${s.replace(/calc/g, "").replace(/(\d+(?:\.\d+)?)px/g, "$1")})`)();
  assert.ok(Number.isFinite(v), `${expr} works out (${s})`);
  return v;
};
const selectorOf = (row) => row.context.at(-1)?.selector ?? "";
const rule = (selector) => {
  const declarations = declarationsFor(selector).filter((row) => !row.context.some((scope) => scope.at === "media"));
  assert.ok(declarations.length, selector);
  return new Map(declarations.map((row) => [row.property, row.value]));
};
const prop = (body, property) => {
  const value = body.get(property);
  assert.ok(value, property);
  return value;
};
const nest = (body) => Object.fromEntries(["--nest-r", "--nest-in"].map((k) => [k, prop(body, k)]));
const NEST = "calc(var(--nest-r) - var(--nest-in))";
/** a shorthand's values, split on the spaces outside parentheses */
const parts = (v) => { const out = [""]; let d = 0; for (const ch of v.trim()) { if (ch === "(") d++; if (ch === ")") d--; if (/\s/.test(ch) && !d) { if (out.at(-1)) out.push(""); } else out[out.length - 1] += ch; } return out; };

test("the family's tokens: a 24 corner, controls 12 in, text 20 in (16 on a phone), lines 48 (44 on a phone)", () => {
  assert.equal(px("var(--r-card)", SCREENS.desktop), 24);
  assert.equal(px("var(--card-in)", SCREENS.desktop), 12);
  assert.equal(px("var(--card-pad)", SCREENS.desktop), 20); assert.equal(px("var(--card-pad)", SCREENS.phone), 16);
  assert.equal(px("var(--dock-bar)", SCREENS.desktop), 48); assert.equal(px("var(--dock-bar)", SCREENS.phone), 44);
  assert.equal(px("var(--dock-btn)", SCREENS.desktop), 32); assert.equal(px("var(--dock-btn)", SCREENS.phone), 36);
});
test("a card's buttons: --card-in from its edge, their corner the nest, so 12 + 12 = 24", () => {
  const card = nest(rule(".card"));
  assert.equal(card["--nest-r"], "var(--r-card)"); assert.equal(card["--nest-in"], "var(--card-in)");
  assert.equal(prop(rule(".card"), "border-radius"), "var(--nest-r)");
  assert.equal(prop(rule(":is(.card,.next) :is(.c-btns,.c-opts) .b"), "border-radius"), NEST);
  const act = parts(prop(rule(".c-act"), "padding"));
  for (const env of Object.values(SCREENS)) {
    assert.equal(px(act[1], env) + 1, px("var(--card-in)", env), "sides: the inset, its 1 px line included");
    assert.equal(px(act[2], env) + 1, px("var(--card-in)", env), "foot: the same");
    assert.equal(px(NEST, env, card) + px(card["--nest-in"], env), px("var(--r-card)", env));
  }
});
test("Home's next card is the same card: the 24 corner, controls --card-in in, no rim, the same shadow, no travelling edge", () => {
  const r = rule(".next");
  assert.deepEqual(nest(r), { "--nest-r": "var(--r-card)", "--nest-in": "var(--card-in)" });
  assert.equal(prop(r, "border-radius"), "var(--nest-r)");
  assert.deepEqual(valuesFor(".next", "border"), ["1px solid transparent"]);
  assert.equal(prop(r, "box-shadow"), prop(rule(".card"), "box-shadow"));
  assert.ok(!r.has("padding"));
  const resize = declarationsFor((selector) => list.comma(selector).some((part) => /^\.next(?![\w-])/.test(part)))
    .filter((row) => /^--nest-(?:r|pad|in)$/.test(row.property));
  assert.ok(resize.every((row) => selectorOf(row) === ".next"));
  assert.equal(new Set(resize.map((row) => row.context)).size, 1);
  assert.ok(!stylesheetRows.some((row) => /nx-orbit|--nx-a|\.nx-(?:btns|opts|foot|meta|where|cmd|est|h)\b/
    .test(row.property + " " + selectorOf(row))));
  assert.equal(prop(rule(":is(.card-in,.next).noting :is(.c-btns,.c-opts,.c-rule,.teach-body)"), "display"), "none");
});
test("a card takes focus only so its keys work: it draws no ring or rim for it; its buttons show their own focus", () => {
  assert.ok(!stylesheetRows.some((row) => /(?:^|[\s,(])(?:\.card|\.next|:is\(\.card,\.next\))(?:\.[\w-]+)*:focus(?:-visible)?\b/.test(selectorOf(row))));
});
test("a card's row: a yes and a no share it at equal width; a lone answer (Home's Decide) and Later keep their words' width", () => {
  assert.deepEqual(Object.fromEntries(rule(".c-btns>.b")), {"flex":"none"});
  assert.deepEqual(Object.fromEntries(rule(".c-btns:has(>.b:not(.b-later)~.b:not(.b-later))>.b:not(.b-later)")), {"flex":"1 1 0","min-width":"max-content"});
  assert.deepEqual(Object.fromEntries(rule(".c-btns")), {"display":"flex","flex-wrap":"wrap","gap":"var(--s-2)"});
  assert.deepEqual(Object.fromEntries(rule(".hold-txt")), {"display":"inline-grid","white-space":"nowrap"});
  assert.deepEqual(Object.fromEntries(rule(".c-ev .ev-w")), {"display":"inline-block","max-width":"100%"});
});
test("the card's corner control (Read the thread first) sits --card-in from the corner, the same nest", () => {
  const r = rule(".dock-hide");
  assert.equal(prop(r, "margin"), "0 calc(var(--card-in) - var(--card-pad)) 0 auto", "out of the text's inset to the card's");
  assert.equal(prop(r, "border-radius"), NEST);
  assert.equal(prop(r, "height"), "var(--h-ctl)");
  const body = parts(prop(rule(".c-body"), "padding"));
  for (const env of Object.values(SCREENS)) assert.equal(px(body[0], env) + 1, px("var(--card-in)", env), "above it: the inset");
});
test("the folded line: the family's corner, their button (dock-bar − dock-btn) / 2 in, no radius past half its height", () => {
  const r = rule(".dock-fold"), n = nest(r);
  assert.equal(n["--nest-r"], "var(--r-card)");
  assert.equal(prop(r, "border-radius"), "var(--nest-r)");
  for (const [name, env] of Object.entries(SCREENS)) {
    const bar = px("var(--dock-bar)", env), btn = px("var(--dock-btn)", env), inn = px(n["--nest-in"], env);
    assert.equal(inn, (bar - btn) / 2 + 1, `${name}: centred in the bar, its 1 px line included`);
    const outer = Math.min(px("var(--r-card)", env), (bar + 2) / 2), inner = Math.min(px(NEST, env, n), btn / 2);
    assert.ok(Math.abs(outer - inn - inner) <= 1, `${name}: ${outer} − ${inn} ≈ ${inner}, its button's corner`);
  }
});
test("the composer: Send and Add files are --comp-ctl circles, --comp-in from its edge, so r + in = 24 on either screen", () => {
  for (const sel of [".send", ".attach"]) {
    const r = rule(sel);
    assert.equal(prop(r, "width"), "var(--comp-ctl)", sel); assert.equal(prop(r, "height"), "var(--comp-ctl)", sel);
    for (const env of Object.values(SCREENS)) assert.equal(substitute(prop(r, "border-radius"), new Map(Object.entries(env))), "50%", sel);
    assert.ok([...r.keys()].every((property) => !property.startsWith("margin")), sel);
  }
  const c = rule(".composer");
  assert.equal(prop(c, "border-radius"), "var(--r-card)");
  const pad = parts(prop(c, "padding"));
  for (const [name, env] of Object.entries(SCREENS)) {
    const ins = px("var(--comp-in)", env), r = px("var(--comp-ctl)", env) / 2;
    assert.equal(r + ins, px("var(--r-card)", env), `${name}: ${r} + ${ins}`);
    assert.equal(px(pad[1], env) + 1, ins, `${name}: the sides`); assert.equal(px(pad[2], env) + 1, ins, `${name}: the foot`);
    assert.ok(px("var(--comp-ctl)", env) >= (name === "phone" ? 36 : 32), `${name}: the control's floor`);
  }
  const compact = declarationsFor((selector) => selector.includes('[data-density="compact"]') && selector.endsWith(" .composer"));
  assert.ok(compact.every((row) => !row.property.startsWith("padding")));
  const phone = declarationsFor(".composer", "padding");
  assert.ok(phone.every((row) => !row.value.startsWith("12px 9px")));
});
test("in the composer: a file and the reply quote take the corner left inside it (24 − --comp-in), their controls nested", () => {
  const attachment = rule(".att");
  const att = nest(attachment);
  assert.equal(att["--nest-r"], "calc(var(--r-card) - var(--comp-in))");
  assert.equal(prop(attachment, "border-radius"), "var(--nest-r)");
  assert.equal(prop(rule(".att-ic"), "border-radius"), NEST);
  const button = rule(".att-b");
  assert.equal(px(prop(button, "--nest-in"), SCREENS.desktop), 11);
  assert.equal(prop(button, "border-radius"), NEST);
  const q = rule(".mx-reply"), qn = nest(q);
  assert.equal(qn["--nest-r"], "var(--r-card)"); assert.equal(qn["--nest-in"], "var(--comp-in)");
  assert.equal(prop(q, "border-radius"), NEST);
  assert.equal(prop(q, "height"), "var(--comp-ctl)", "as tall as Send beside it");
  const x = rule(".mx-r-x");
  assert.equal(prop(x, "height"), "var(--h-sm)"); assert.equal(prop(x, "border-radius"), "50%");
  for (const [name, env] of Object.entries(SCREENS)) {
    const qr = px(NEST, env, qn), qh = px("var(--comp-ctl)", env), xh = px("var(--h-sm)", env);
    assert.equal(qr, qh / 2, `${name}: the quote is a capsule`);
    assert.equal(qr - (qh - xh) / 2, xh / 2, `${name}: its × concentric (${qr} − ${(qh - xh) / 2})`);
  }
});
test("no rims: a card and the composer draw their 1 px line transparent at rest (forced colours still show it), depth from the shadow", () => {
  const card = rule(".card");
  assert.equal(prop(card, "border"), "1px solid transparent"); assert.equal(prop(card, "box-shadow"), "var(--lift-3)");
  assert.equal(prop(rule(".composer"), "border"), "1px solid transparent");
  assert.deepEqual(declarationsFor(".card.is-dock", "border-color"), []);
  assert.deepEqual(declarationsFor((selector) => /^\.card(?:\.is-dock)?\.r-destructive$/.test(selector), "background"), []);
});
test("the edge light: one --state per risk (amber notable, red destructive or stopped), drawn only on a card that has one", () => {
  const risk = ":is(.card,.next,.dock-fold)";
  assert.equal(prop(rule(risk + ".r-notable"), "--state"), "var(--warn)");
  assert.equal(prop(rule(risk + ":is(.r-destructive,.r-stopped)"), "--state"), "var(--err-ink)");
  const edge = rule(":is(.card,.next):is(.r-notable,.r-destructive,.r-stopped)::before");
  assert.equal(prop(edge, "z-index"), "-1");
  const [, positionAndWidth, height, repeat] = parts(list.comma(prop(edge, "background"))[0]);
  assert.equal(positionAndWidth, "top/100%");
  assert.equal(repeat, "no-repeat");
  for (const env of Object.values(SCREENS)) assert.equal(px(height, env), 1, "The edge light is 1 px high");
  assert.deepEqual(declarationsFor((selector) => /^\.(?:card|next)::before$/.test(selector)), []);
});
test("the lines are glass: the composer's fill tinted by --state, blurred, no edge light", () => {
  assert.match(base["--glass-blur"], /^blur\(\d+px\) saturate\([\d.]+\)$/);
  assert.match(prop(rule(".dock-fold"), "background"), /^var\(--glass\)$/);
  assert.equal(prop(rule(".dock-fold"), "backdrop-filter"), "var(--glass-blur)");
  const tint = "color-mix(in srgb,var(--state,transparent) 12%,color-mix(in srgb,var(--comp-bg) 80%,transparent))";
  assert.ok(declarationsFor((selector) => selector.includes(".dock-fold"), "--glass").some((row) => row.value === tint));
  assert.deepEqual(declarationsFor((selector) => /^\.dock-fold.*::before$/.test(selector)), []);
});
test("the other surfaces keep their own family: dialogs, sheets and the stage stay --r-2xl", () => {
  assert.equal(base["--r-2xl"], "22px");
  const otherRadii = declarationsFor((selector) => /^\.(?:dlg|sheet|stage)$/.test(selector), "border-radius");
  assert.ok(otherRadii.every((row) => row.value !== "var(--r-card)"));
});
