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
  assert.match(body, /const said = stopReceipt\(r, what, key\.startsWith\("all:"\)\);/);
  const j = app.indexOf("function stopReceipt("), f = app.slice(j, app.indexOf("\n}\n", j));
  assert.match(f, /all \? Array\.isArray\(r\.stopping\) && r\.stopping\.length > 0 : r\.stopping === true/, "sent: true (one run), or the runs it went to (all)");
  assert.match(f, /!all && r && r\.stopping === false/, "one run that had ended (stop_run refuses a live record with run_not_live)");
  assert.match(f, /all && r && Array\.isArray\(r\.stopping\) && !r\.stopping\.length/, "Stop all's []: no stop went out");
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
  assert.match(r, /\(same && usable\(same\) \? same : runsCard\)\.focus\(\{ preventScroll: true \}\);/);
});
t("the Undo in its line: an even 2 px inset, and the line's corners its own plus the inset (6 + 2 = 8)", () => {
  assert.match(css, /\.rn-stopping\{[^}]*padding:2px 2px 2px 12px;[^}]*border-radius:var\(--r\);/);
  assert.match(css, /\.rn-stopping>\.t-undo\{height:36px\}/);
});
// each endpoint's answer is read in its own type (the create-project grader on 8d8b244, runs-stop-types: routers/
// cowork_agent/storm/runs.py gives stop_run {run, stopping: bool} and stop_all {stopping: [ids]}; a one-run
// {stopping:['a1']} said it was sent, and a Stop all {stopping:false} said it had finished)
t("one run's answer is a boolean, Stop all's an array: the other type confirms nothing", () => {
  const j = app.indexOf("function stopReceipt("), f = app.slice(j, app.indexOf("\n}\n", j));
  assert.match(f, /function stopReceipt\(r, what, all\)/);
  assert.match(f, /const sent = !!r && \(all \? Array\.isArray\(r\.stopping\) && r\.stopping\.length > 0 : r\.stopping === true\);/);
  assert.match(f, /if \(!all && r && r\.stopping === false\)/, "had ended: one run only");
  assert.match(f, /if \(all && r && Array\.isArray\(r\.stopping\) && !r\.stopping\.length\)/, "none went out: Stop all only");
  assert.match(body, /const said = stopReceipt\(r, what, key\.startsWith\("all:"\)\);/, "the endpoint from the stop's key");
});
// once the Undo is over and the request is out, the sheet says so and the Stop waits (the create-project grader on
// 8d8b244, runs-stop-types request-visible: Stop stayed enabled, "Stop", aria-busy null, and nothing was said until
// the answer)
t("a stop on its way: its line says it's being sent, and its Stop is busy and takes no repeat", () => {
  const k = body.indexOf("job.sent = true;"), sent = body.slice(k, body.indexOf("try {", k));
  assert.match(sent, /stopsOut\.add\(key\);\s*RS\.said = \{ key, kind: "halt", text: "Sending the stop…", sub: what \};\s*runsRender\(\);/, "said, then drawn, once it's out");
  assert.match(app, /out: \[\.\.\.stopsOut\]/, "the sheet knows what's on its way");
  assert.match(view, /const busy = out\.includes\(`run:\$\{r\.id\}`\);/);
  assert.match(view, /\$\{busy \? ' aria-busy="true" aria-disabled="true"' : ""\}>\$\{ICON\.stop\}<span>\$\{busy \? "Stopping…" : "Stop"\}<\/span>/);
  assert.match(view, /out\.includes\(`all:\$\{session\}`\)/, "Stop all too");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
