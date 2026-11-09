// One send gate, asked about where a message actually goes (Launchpad grader on 652ed3d, still on 945eecb): Retry
// resent a message to its own chat or thread but asked about the composer's current draft (so a newer "@workspace"
// draft with the Workspace Off blocked an allowed reply), and the file actions (Ask about lines' fallback, Tell the
// agent) sent to the file's thread or project but asked about the current chat and draft. blockFor(dest) judges a
// destination ({ thread } or { pid }); every send path names its own. No browser (the routing rule itself is
// tests/routing-truth.test.mjs).
//   node tests/send-gate.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const body = (name) => { const i = app.indexOf(`function ${name}(`); if (i < 0) return null; let d = 0, j = app.indexOf("{", i); for (let k = j; k < app.length; k++) { if (app[k] === "{") d++; else if (app[k] === "}") { d--; if (!d) return app.slice(j, k + 1); } } return null; };
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("one gate judges a destination: blockFor({ thread }) or blockFor({ pid })", () => {
  const b = body("blockFor");
  assert.ok(b, "app.js has blockFor(dest)");
  assert.match(b, /sendBlock\(world\.state, \{ timeline: !dest\.thread, pid:/, "the routing rule, for that destination");
});
t("the composer asks about where its draft goes (the @-named project's chat, else this place's; a thread's reply)", () => {
  assert.match(body("liveBlock") || "", /blockFor\(composerDest\(\)\)/);
});
t("Retry asks about the message's own destination, never the composer's draft", () => {
  const b = body("retry") || "";
  assert.doesNotMatch(b, /liveBlock\(\)/, "not the draft's gate");
  assert.match(b, /blockFor\(m\.target \? \{ pid: m\.target \} : \{ thread: true \}\)/, "the message's chat, or its thread");
});
t("the file actions (Ask about lines' fallback, Tell the agent) ask about the file's own place", () => {
  const b = body("sendAbout") || "";
  assert.doesNotMatch(b, /liveBlock\(\)/, "not the current chat's or draft's gate");
  assert.match(b, /blockFor\(at\.thread \? \{ thread: true \} : \{ pid: at\.chat \}\)/, "the file's thread, or its project");
});
t("Tell the agent, refused, keeps its notice (and the Tell in it) to try again: the notice goes only once it went", () => {
  const v = readFileSync(new URL("../js/viewer.js", import.meta.url), "utf8");
  const i = v.indexOf('e.target.closest("[data-vw-tell]")');
  assert.ok(i >= 0, "the Tell handler");
  const line = v.slice(i, v.indexOf("\n", i));
  const tell = line.indexOf("edits.tell("), clear = line.indexOf("saved = null");
  assert.ok(tell >= 0 && clear >= 0, "it tells and clears");
  assert.ok(tell < clear, "it asks edits.tell first, and clears the notice only after it went");
  assert.match(line, /if \(!s \|\| !edits\.tell\(V\.file, s\)\) return;/, "refused: nothing cleared");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
