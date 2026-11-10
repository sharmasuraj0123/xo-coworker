// What a sub-agent Stop's answer says is only what it confirms, said in the Runs sheet where you acted as well as in
// the notice, with focus kept on the Stop (the create-project grader on 2a8d278, S100/S101/S239, runs-stop):
// - an answer that confirms no stop ({}, {ok:false}, {stopping:null}) said "Stopping";
// - Stop all's [] said "already finished", but stop_all also answers [] when no live process runs them;
// - a refusal (503) was said only in #herald, behind the open sheet;
// - after the answer focus went to the sheet, though its Stop was still there;
// - the Undo inside its line: 6 px corners in a 6 px line, insets 3 and 4 (never concentric).
//   node tests/runs-stop-receipt.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const view = readFileSync(new URL("../js/runsview.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/app.css", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const i = app.indexOf("function stopRunsUndo("), body = app.slice(i, app.indexOf("\nrunsEl.addEventListener(\"click\"", i));

t("the answer is read for what it confirms: sent, ended (one run), none sent (all), or unconfirmed", () => {
  assert.match(body, /const said = stopReceipt\(r, what\);/);
  const j = app.indexOf("function stopReceipt("), f = app.slice(j, app.indexOf("\n}\n", j));
  assert.match(f, /r\.stopping === true \|\| \(Array\.isArray\(r\.stopping\) && r\.stopping\.length > 0\)/, "sent: true, or the runs it went to");
  assert.match(f, /r\.stopping === false/, "one run that had ended (stop_run refuses a live record with run_not_live)");
  assert.match(f, /Array\.isArray\(r\.stopping\) && !r\.stopping\.length/, "Stop all's []: no stop went out");
  assert.doesNotMatch(f.slice(f.indexOf("Array.isArray(r.stopping) && !r.stopping.length")), /^[^\n]*already finished/m, "[] never claims they finished");
  assert.match(f, /didn't confirm/, "anything else: not confirmed");
});
t("it's said in the sheet, where you acted, as well as in the notice", () => {
  assert.match(body, /RS\.said = \{ key, \.\.\.said \};/);
  assert.match(app, /saidFor: RS\.said/, "the sheet is drawn with it");
  assert.match(view, /export function saidHtml\(said, key\)/);
  assert.match(view, /role="\$\{said\.kind === "halt" \? "status" : "alert"\}"/);
  assert.match(view, /saidHtml\(saidFor, `run:\$\{r\.id\}`\)/, "a run's own Stop: under its row");
  assert.match(view, /saidHtml\(saidFor, `all:/, "Stop all: at the top of the list");
});
t("a redraw keeps focus on the same control, found by its hook's name and value; the sheet only if it's gone", () => {
  const r = app.slice(app.indexOf("function runsRender()"), app.indexOf("\n}\n", app.indexOf("function runsRender()")));
  assert.match(r, /const hook = runsHook\(document\.activeElement\);/);
  assert.match(r, /const same = hook && runsCard\.querySelector\(hook\);/);
  assert.match(r, /\(same && usableEl\(same\) \? same : runsCard\)\.focus\(\{ preventScroll: true \}\);/);
});
t("the Undo in its line: an even 2 px inset, and the line's corners its own plus the inset (6 + 2 = 8)", () => {
  assert.match(css, /\.rn-stopping\{[^}]*padding:2px 2px 2px 12px;[^}]*border-radius:var\(--r\);/);
  assert.match(css, /\.rn-stopping>\.t-undo\{height:36px\}/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
