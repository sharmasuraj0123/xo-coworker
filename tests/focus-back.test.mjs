// Focus goes back to a control a person can be on, by one helper, and a panel's opener that a redraw took away is
// found again in the draw that brings it back (the controls grader on 05d76ca, S142, 12/12: Home's next card's
// Details opens the decisions panel; Close decisions put focus on the page, BODY at 450 ms, for Enter, Space and a
// press, in all four cells. The panel focused the node it was opened from, but Home had drawn its card again
// meanwhile: while the panel shows that ask, the card gives way to "Open in the panel", so that node was gone).
//
// The rule: a control still here takes focus now; one redrawn takes it in the draw that brings it back, found by its
// identity (hookOf: its id, else its tag and data- hooks), else the place. Never a node that's gone, never the page.
// "Here" is one test (usable), where five files each had their own copy.
//   node tests/focus-back.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
const read = (f) => readFileSync(new URL(f, ROOT), "utf8");
let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

await t("one helper says a control can take focus: no file keeps its own copy", () => {
  const fv = read("js/focusview.js");
  assert.match(fv, /export const usable = \(el\) => !!el && el !== document\.body && el\.isConnected && !el\.closest\("\[inert\], \[hidden\]"\) && el\.getClientRects\(\)\.length > 0;/);
  const copies = readdirSync(new URL("js/", ROOT)).filter((f) => f.endsWith(".js") && f !== "focusview.js").filter((f) => /closest\("\[inert\], \[hidden\]"\)/.test(read(`js/${f}`)));
  assert.deepEqual(copies, [], `own copies of the test: ${copies.join(", ")}`);
  for (const f of ["app.js", "decide.js", "viewer.js", "stage.js", "create.js", "ui.js"]) assert.match(read(`js/${f}`), /import \{[^}]*\busable\b[^}]*\} from "\.\/focusview\.js";/, `${f} takes it from focusview.js`);
});

await t("hookOf names a control so the redraw's copy is found: its id, else its tag and data- hooks, a count aside", async () => {
  globalThis.CSS = { escape: (s) => String(s).replace(/["\\]/g, "\\$&") };
  const { hookOf } = await import(new URL("js/focusview.js", ROOT));
  const el = (tag, attrs, id = "") => ({ tagName: tag.toUpperCase(), id, attributes: Object.entries(attrs).map(([name, value]) => ({ name, value })), getAttribute: (n) => attrs[n] ?? null });
  assert.equal(hookOf(el("button", { class: "nx-link", "data-fid": "ev", "data-decide": "t1:ask" })), 'button[data-fid="ev"][data-decide="t1:ask"]', "Home's Details");
  assert.equal(hookOf(el("button", { class: "x", "data-runs": "", "data-n": "45" })), "button[data-runs]", "a count isn't its identity");
  assert.equal(hookOf(el("button", { "data-x": "1" }, "pn-x")), "#pn-x", "an id first");
  assert.equal(hookOf(el("button", { class: "plain" })), null, "no identity: no selector");
  assert.equal(hookOf(null), null);
});

await t("the decisions panel's close: its opener now if it's here, else the same control in the next draw, else the place", () => {
  const d = read("js/decide.js");
  const close = d.slice(d.indexOf("function close({ restore = true } = {})"), d.indexOf("function sync()"));
  assert.match(close, /if \(restore && r\) \{ if \(usable\(r\)\) r\.focus\(\{ preventScroll: true \}\); else back && back\(\[hookOf\(r\)\]\.filter\(Boolean\)\); \}/);
  assert.doesNotMatch(close, /r\.isConnected && r !== document\.body\) r\.focus/, "not a node that may be gone");
  assert.match(d, /export function createDecisions\(\{[^}]*\bback\b/);
  const app = read("js/app.js");
  assert.match(app, /back: \(sels\) => \{ S\.focusNext = \[\.\.\.sels, placeRegion\]; schedule\(\); \},/, "the app lands it in the draw that brings the control back, else the place");
  assert.match(app, /if \(S\.focusNext\) \{ const to = S\.focusNext\.map\(\(sel\) => \(typeof sel === "function" \? sel\(\) : \$\(sel\)\)\)\.find\(usable\);/, "a landing may name the place itself");
});

await t("Runs' close takes the shared test (its own copy is gone)", () => {
  const app = read("js/app.js");
  const runs = app.slice(app.indexOf("function closeRuns()"), app.indexOf("/** Stop one sub-agent"));
  assert.doesNotMatch(runs, /usable = \(/);
  assert.match(runs, /\[was, like\(was\), \$\("#thead \[data-runs\]"\), placeRegion\(\)\]\.find\(usable\)/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
