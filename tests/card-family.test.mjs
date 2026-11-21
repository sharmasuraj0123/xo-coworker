// The dock family (every decision card on the panel, the dock and Home, its folded and done lines, the composer and its reply quote) shares one
// corner, --r-card, and each control inside it sits so that its radius and its inset add up to that corner: worked
// out from the tokens on a desktop and on a phone, so a token that moves keeps the family concentric or fails here.
//   node tests/card-family.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const tokensCss = read("tokens.css"), phoneCss = read("phone.css"), app = read("app.css"), msgx = read("msgx.css"), shape = read("shape.css");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

const decls = (css) => Object.fromEntries([...css.matchAll(/(--[\w-]+):([^;{}]+)[;}]/g)].map((m) => [m[1], m[2].trim()]));
const rootOf = (css) => decls([...css.matchAll(/(?:^|[\s}]):root\{([^}]*)\}/g)].map((m) => m[1] + ";").join(""));
const base = decls(tokensCss.slice(tokensCss.indexOf(":root"), tokensCss.indexOf("}", tokensCss.indexOf(":root"))));
const phoneMedia = phoneCss.slice(phoneCss.indexOf("@media (max-width:760px)"));
const SCREENS = { desktop: base, phone: { ...base, ...rootOf(phoneMedia.slice(0, phoneMedia.indexOf("\n}"))) } };

/** a px value from tokens and simple calc()s: var(--x) as its value on that screen, then the arithmetic */
const px = (expr, env, local = {}) => {
  let s = expr, guard = 0;
  while (/var\(--[\w-]+\)/.test(s) && guard++ < 20) s = s.replace(/var\((--[\w-]+)\)/g, (m, k) => { const v = local[k] ?? env[k]; assert.ok(v !== undefined, `${k} is defined`); return `(${v})`; });
  const v = Function(`return (${s.replace(/calc/g, "").replace(/(\d+(?:\.\d+)?)px/g, "$1")})`)();
  assert.ok(Number.isFinite(v), `${expr} works out (${s})`);
  return v;
};
const rule = (css, sel) => { const m = new RegExp(`(?:^|[}\\n])${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\{([^}]*)\\}`).exec(css); assert.ok(m, sel); return m[1]; };
const prop = (body, p) => { const m = new RegExp(`(?:^|;)${p}:([^;]+)`).exec(body); assert.ok(m, `${p} in ${body}`); return m[1].trim(); };
const nest = (body) => Object.fromEntries(["--nest-r", "--nest-in"].map((k) => [k, prop(body, k)]));
const NEST = "calc(var(--nest-r) - var(--nest-in))";
/** a shorthand's values, split on the spaces outside parentheses */
const parts = (v) => { const out = [""]; let d = 0; for (const ch of v.trim()) { if (ch === "(") d++; if (ch === ")") d--; if (/\s/.test(ch) && !d) { if (out.at(-1)) out.push(""); } else out[out.length - 1] += ch; } return out; };

t("the family's tokens: a 24 corner, controls 12 in, text 20 in (16 on a phone), lines 48 (44 on a phone)", () => {
  assert.equal(px("var(--r-card)", SCREENS.desktop), 24);
  assert.equal(px("var(--card-in)", SCREENS.desktop), 12);
  assert.equal(px("var(--card-pad)", SCREENS.desktop), 20); assert.equal(px("var(--card-pad)", SCREENS.phone), 16);
  assert.equal(px("var(--dock-bar)", SCREENS.desktop), 48); assert.equal(px("var(--dock-bar)", SCREENS.phone), 44);
  assert.equal(px("var(--dock-btn)", SCREENS.desktop), 32); assert.equal(px("var(--dock-btn)", SCREENS.phone), 36);
});
t("a card's buttons: --card-in from its edge, their corner the nest, so 12 + 12 = 24", () => {
  const card = nest(rule(app, ".card"));
  assert.equal(card["--nest-r"], "var(--r-card)"); assert.equal(card["--nest-in"], "var(--card-in)");
  assert.equal(prop(rule(app, ".card"), "border-radius"), "var(--nest-r)");
  assert.match(app, new RegExp(`\\n:is\\(\\.card,\\.next\\) :is\\(\\.c-btns,\\.c-opts\\) \\.b\\{border-radius:${NEST.replace(/[()]/g, "\\$&")}\\}`));
  const act = parts(prop(rule(app, ".c-act"), "padding"));
  for (const env of Object.values(SCREENS)) {
    assert.equal(px(act[1], env) + 1, px("var(--card-in)", env), "sides: the inset, its 1 px line included");
    assert.equal(px(act[2], env) + 1, px("var(--card-in)", env), "foot: the same");
    assert.equal(px(NEST, env, card) + px(card["--nest-in"], env), px("var(--r-card)", env));
  }
});
t("Home's next card is the same card: the 24 corner, controls --card-in in, no rim, the same shadow, no travelling edge", () => {
  const r = rule(app, ".next");
  assert.deepEqual(nest(r), { "--nest-r": "var(--r-card)", "--nest-in": "var(--card-in)" });
  assert.equal(prop(r, "border-radius"), "var(--nest-r)");
  assert.equal(prop(r, "border"), "1px solid transparent"); assert.equal(prop(r, "box-shadow"), prop(rule(app, ".card"), "box-shadow"));
  assert.doesNotMatch(r, /padding/, "its insets are the card's body and action row");
  const resize = (css) => [...css.matchAll(/(?:^|[}\n,])\s*\.next[^{,]*\{[^}]*--nest-(?:r|pad|in):/g)].length;
  assert.equal(resize(app), 1, "only its own rule sets its nest"); assert.equal(resize(phoneCss) + resize(shape), 0, "no screen resizes it");
  assert.doesNotMatch(app, /nx-orbit|--nx-a|\.nx-(?:btns|opts|foot|meta|where|cmd|est|h)\b/);
  assert.match(app, /\n:is\(\.card-in,\.next\)\.noting :is\(\.c-btns,\.c-opts,\.c-rule,\.teach-body\)\{display:none\}/);
});
t("a card takes focus only so its keys work: it draws no ring or rim for it; its buttons show their own focus", () => {
  assert.doesNotMatch(app, /(?:^|[\s,(}])(?:\.card|\.next|:is\(\.card,\.next\))(?:\.[\w-]+)*:focus(?:-visible)?\b/m);
});
t("a card's row: a yes and a no share it at equal width; a lone answer (Home's Decide) and Later keep their words' width", () => {
  assert.equal(rule(app, ".c-btns>.b"), "flex:none");
  assert.equal(rule(app, ".c-btns:has(>.b:not(.b-later)~.b:not(.b-later))>.b:not(.b-later)"), "flex:1 1 0;min-width:max-content", "equal shares, never narrower than their words");
  assert.equal(rule(app, ".c-btns"), "display:flex;flex-wrap:wrap;gap:var(--s-2)", "the row wraps before it cuts a button");
  assert.equal(rule(app, ".hold-txt"), "display:inline-grid;white-space:nowrap", "the hold's two labels share one line's slot, so the visible one stays beside its icon");
  assert.equal(rule(app, ".c-ev .ev-w"), "display:inline-block;max-width:100%", "code wraps after a slash or a space, never at a hyphen it fits past");
});
t("the card's corner control (Read the thread first) sits --card-in from the corner, the same nest", () => {
  const r = rule(app, ".dock-hide");
  assert.equal(prop(r, "margin"), "0 calc(var(--card-in) - var(--card-pad)) 0 auto", "out of the text's inset to the card's");
  assert.equal(prop(r, "border-radius"), NEST);
  assert.equal(prop(r, "height"), "var(--h-ctl)");
  const body = parts(prop(rule(app, ".c-body"), "padding"));
  for (const env of Object.values(SCREENS)) assert.equal(px(body[0], env) + 1, px("var(--card-in)", env), "above it: the inset");
});
t("the folded and done lines: the family's corner, their button (dock-bar − dock-btn) / 2 in, no radius past half its height", () => {
  const r = rule(app, ":is(.dock-fold,.card.is-dock.r-done,.hr)"), n = nest(r);
  assert.equal(n["--nest-r"], "var(--r-card)");
  assert.equal(prop(r, "border-radius"), "var(--nest-r)");
  for (const [name, env] of Object.entries(SCREENS)) {
    const bar = px("var(--dock-bar)", env), btn = px("var(--dock-btn)", env), inn = px(n["--nest-in"], env);
    assert.equal(inn, (bar - btn) / 2 + 1, `${name}: centred in the bar, its 1 px line included`);
    const outer = Math.min(px("var(--r-card)", env), (bar + 2) / 2), inner = Math.min(px(NEST, env, n), btn / 2);
    assert.ok(Math.abs(outer - inn - inner) <= 1, `${name}: ${outer} − ${inn} ≈ ${inner}, its button's corner`);
  }
});
t("the composer: Send and Add files are --comp-ctl circles, --comp-in from its edge, so r + in = 24 on either screen", () => {
  for (const sel of [".send", ".attach"]) {
    const r = rule(app, sel);
    assert.equal(prop(r, "width"), "var(--comp-ctl)", sel); assert.equal(prop(r, "height"), "var(--comp-ctl)", sel);
    assert.equal(prop(r, "border-radius"), "50%", sel);
    assert.doesNotMatch(r, /(?:^|;)margin(?:-\w+)?:/, `${sel}: no margin moves it off the corner`);
  }
  const c = rule(app, ".composer");
  assert.equal(prop(c, "border-radius"), "var(--r-card)");
  const pad = parts(prop(c, "padding"));
  for (const [name, env] of Object.entries(SCREENS)) {
    const ins = px("var(--comp-in)", env), r = px("var(--comp-ctl)", env) / 2;
    assert.equal(r + ins, px("var(--r-card)", env), `${name}: ${r} + ${ins}`);
    assert.equal(px(pad[1], env) + 1, ins, `${name}: the sides`); assert.equal(px(pad[2], env) + 1, ins, `${name}: the foot`);
    assert.ok(px("var(--comp-ctl)", env) >= (name === "phone" ? 36 : 32), `${name}: the control's floor`);
  }
  assert.doesNotMatch(shape, /\[data-density="compact"\] \.composer\{padding/, "compact keeps the family's inset");
  assert.doesNotMatch(app, /\.composer\{padding:12px 9px/, "no phone composer of its own");
});
t("in the composer: a file and the reply quote take the corner left inside it (24 − --comp-in), their controls nested", () => {
  const a = /\n\.att\{(--nest-r:[^}]*)\}/.exec(app); assert.ok(a, "a file's nest");
  const att = nest(a[1]);
  assert.equal(att["--nest-r"], "calc(var(--r-card) - var(--comp-in))");
  assert.equal(prop(a[1], "border-radius"), "var(--nest-r)");
  assert.match(app, /\.att-ic\{border-radius:calc\(var\(--nest-r\) - var\(--nest-in\)\)\}/);
  assert.match(app, /\.att-b\{--nest-in:11px;border-radius:calc\(var\(--nest-r\) - var\(--nest-in\)\)\}/);
  const q = rule(msgx, ".mx-reply"), qn = nest(q);
  assert.equal(qn["--nest-r"], "var(--r-card)"); assert.equal(qn["--nest-in"], "var(--comp-in)");
  assert.equal(prop(q, "border-radius"), NEST);
  assert.equal(prop(q, "height"), "var(--comp-ctl)", "as tall as Send beside it");
  const x = rule(msgx, ".mx-r-x");
  assert.equal(prop(x, "height"), "var(--h-sm)"); assert.equal(prop(x, "border-radius"), "50%");
  for (const [name, env] of Object.entries(SCREENS)) {
    const qr = px(NEST, env, qn), qh = px("var(--comp-ctl)", env), xh = px("var(--h-sm)", env);
    assert.equal(qr, qh / 2, `${name}: the quote is a capsule`);
    assert.equal(qr - (qh - xh) / 2, xh / 2, `${name}: its × concentric (${qr} − ${(qh - xh) / 2})`);
  }
});
t("no rims: a card and the composer draw their 1 px line transparent at rest (forced colours still show it), depth from the shadow", () => {
  const card = rule(app, ".card");
  assert.equal(prop(card, "border"), "1px solid transparent"); assert.equal(prop(card, "box-shadow"), "var(--lift-3)");
  assert.equal(prop(rule(app, ".composer"), "border"), "1px solid transparent");
  assert.doesNotMatch(app, /\.card\.is-dock\{[^}]*border-color/);
  assert.doesNotMatch(app, /\.card(?:\.is-dock)?\.r-destructive\{background/, "the state is the edge light, not a wash");
});
t("the edge light: one --state per risk (amber notable, red destructive or stopped), drawn only on a card that has one", () => {
  assert.match(app, /\n:is\(\.card,\.next,\.dock-fold\)\.r-notable\{--state:var\(--warn\)\}/);
  assert.match(app, /\n:is\(\.card,\.next,\.dock-fold\):is\(\.r-destructive,\.r-stopped\)\{--state:var\(--err-ink\)\}/);
  const m = /\n:is\(\.card,\.next\):is\(\.r-notable,\.r-destructive,\.r-stopped\)::before\{([^}]*)\}/.exec(app);
  assert.ok(m, "only those states light the edge");
  assert.match(m[1], /z-index:-1/, "under the card's content, over its fill");
  assert.match(m[1], /top\/100% 1px no-repeat/, "a 1 px hairline");
  assert.doesNotMatch(app, /\n(?:\.card|\.next)::before\{/, "a plain card has none");
});
t("the lines are glass: the composer's fill tinted by --state, blurred, no edge light", () => {
  assert.match(tokensCss, /--glass-blur:blur\(\d+px\) saturate\([\d.]+\);/);
  assert.match(prop(rule(app, ".dock-fold"), "background"), /^var\(--glass\)$/);
  assert.equal(prop(rule(app, ".dock-fold"), "backdrop-filter"), "var(--glass-blur)");
  assert.match(app, /--glass:color-mix\(in srgb,var\(--state,transparent\) 12%,color-mix\(in srgb,var\(--comp-bg\) 80%,transparent\)\)/);
  assert.doesNotMatch(app, /\.dock-fold[^{]*::before\{/);
});
t("the other surfaces keep their own family: dialogs, sheets and the stage stay --r-2xl", () => {
  assert.match(tokensCss, /--r-2xl:22px/);
  assert.doesNotMatch(app, /\.(?:dlg|sheet|stage)\{[^}]*border-radius:var\(--r-card\)/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
