// The conversation's buttons are on the 24/32/40 scale on a desktop, from the size tokens (grader A on c767cbf, C052:
// Copy beside a message was 28 × 28 at 1440, in both themes). Reply and Copy are buttons: the standard --h-ctl (32);
// the room a bubble leaves them, and the space held under pictures, follow that token, never a number of their own.
// The reply quote's × is an inline dismiss: --h-sm (24), concentric with the quote's corner. A phone keeps its 36.
// No browser: the stylesheets.
//   node tests/conv-ctl-scale.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const read = (f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const msgx = read("msgx.css"), tokens = read("tokens.css"), phone = read("phone.css");
const body = (css, sel) => { const m = new RegExp(`(?:^|[}\\n])\\s*${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\{([^}]*)\\}`).exec(css); assert.ok(m, `${sel} is declared`); return m[1]; };
const px = (b, prop) => (new RegExp(`(?:^|;)${prop}:([^;]+)`).exec(b) || [])[1];

t("the scale itself: --h-sm 24, --h-ctl 32, --h-lg 40", () => {
  assert.match(tokens, /--h-sm:24px;\s*--h-ctl:32px;\s*--h-lg:40px;/);
});

t("C052: Reply and Copy beside a message are the standard control height, from --h-ctl (they were 28)", () => {
  const b = body(msgx, ".mx-acts button");
  assert.equal(px(b, "width"), "var(--h-ctl)");
  assert.equal(px(b, "height"), "var(--h-ctl)");
});

t("the room a bubble leaves them is two of them, their gap and the 8 px between: from the token, never 66", () => {
  assert.doesNotMatch(msgx, /\b66px\b/, "no number of its own");
  const room = /calc\(100% - 2 \* var\(--h-ctl\) - 10px\)/g;
  assert.equal((msgx.match(room) || []).length, 4, "a person's bubble, an agent's, and a table's width and max-width");
  assert.match(body(msgx, ".mx-acts"), /gap:2px/, "the 2 px of the 10");
  assert.match(body(msgx, ".mx-acts"), /left:calc\(100% \+ 8px\)/, "the 8 px of the 10");
});

t("under pictures, the row holds the buttons' height plus its 6 and 20 (it held 28's)", () => {
  assert.match(msgx, /:root\[data-msgx\] #msgs>\.m\.mx-nobub\{margin-bottom:calc\(var\(--h-ctl\) \+ 26px\)\}/);
  assert.match(body(msgx, ".mx-nobub .mx-acts.is-foot"), /top:calc\(100% \+ 6px\)/);
});

t("the reply quote's ×: --h-sm (it was 28), 6 px in on every side of the quote's 36, so concentric with its 18 corner", () => {
  const x = body(msgx, ".mx-r-x"), q = body(msgx, ".mx-reply");
  assert.equal(px(x, "width"), "var(--h-sm)"); assert.equal(px(x, "height"), "var(--h-sm)");
  assert.equal(px(x, "border-radius"), "50%");
  assert.equal(px(q, "height"), "36px");
  assert.equal(px(q, "padding"), "0 6px 0 12px", "(36 − 24) / 2 = 6 on the right as above and below");
  assert.equal(px(q, "border-radius"), "calc(var(--r-3xl) - 10px)", "28 − 10 = 18; 18 − 6 = 12, the ×'s radius");
  assert.match(tokens, /--r-3xl:28px/);
});

t("no button in the conversation's stylesheet takes a literal size off the scale", () => {
  for (const sel of [".mx-acts button", ".mx-r-x"]) {
    const b = body(msgx, sel);
    for (const p of ["width", "height", "min-height"]) { const v = px(b, p); assert.ok(!v || !/^\d+px$/.test(v), `${sel} ${p}: ${v}`); }
  }
});

t("a phone keeps its 36: the quote's × stays at the floor, 4 px in; Reply and Copy show only where a pointer hovers", () => {
  assert.match(phone, /\.mx-r-x[,)]/, "the phone's 36 floor names the ×");
  assert.match(msgx, /@media \(max-width:760px\)\{\.mx-reply\{padding-right:4px\}\}/);
  assert.match(msgx, /@media \(hover:none\)\{\.mx-acts\{display:none\}\}/);
});

// The census of 30bd6d0 (tests/ctl-scale.test.mjs) listed one more in this stylesheet: the folded tool pill, 28. It's a
// button: the compact control height, --h-ctl, as the rail's header and rows it opens to (a literal 32 till now).
t("the folded tool pill is --h-ctl (it was 28), and so are the rail's header and rows: the token, not a literal 32", () => {
  for (const sel of [":root[data-msgx] .m-turn .turn>.tb>.tb-h", ":root[data-msgx] .m-turn .tb-work.is-open .tb-rail>.tb>.tb-h",
    ":root[data-msgx] .m-turn .tb-work.is-open .tb-rail .tb-rows>.tb-row>.tb-rh", ":root[data-msgx] .m-turn .turn>.tb.tb-act.is-unfolded>.tb-rows>.tb-row>.tb-rh"])
    assert.equal(px(body(msgx, sel), "min-height"), "var(--h-ctl)", sel);
  const pill = body(msgx, ":root[data-msgx] .m-turn .turn>.tb>.tb-h");
  assert.equal(px(pill, "padding"), "4px 12px 4px 16px", "its words keep their 16 px edge");
  assert.equal(px(pill, "line-height"), "20px", "centred: (32 − 20) / 2 = 6 above and below");
});

t("a phone keeps the pill and the rail's header and rows at its 36 floor", () => {
  assert.match(phone, /:root\[data-msgx\] \.m-turn \.turn>\.tb>\.tb-h,\s*:root\[data-msgx\] \.m-turn \.tb-work\.is-open \.tb-rail>\.tb>\.tb-h,\s*\[data-density="compact"\] \.tb-h\{min-height:36px\}/);
  assert.match(phone, /:root\[data-msgx\] \.m-turn \.tb-work\.is-open \.tb-rail \.tb-rows>\.tb-row>\.tb-rh,\s*:root\[data-msgx\] \.m-turn \.turn>\.tb\.tb-act\.is-unfolded>\.tb-rows>\.tb-row>\.tb-rh\{min-height:36px\}/);
});

console.log(`${passed} passed`);
