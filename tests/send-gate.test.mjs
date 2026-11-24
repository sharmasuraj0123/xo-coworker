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
const delivery = readFileSync(new URL("../modules/conversation/delivery.js", import.meta.url), "utf8");
const fileQuestion = readFileSync(new URL("../modules/conversation/file-question.js", import.meta.url), "utf8");
const body = (name) => { const source = `${app}\n${delivery}\n${fileQuestion}`; const i = source.indexOf(`function ${name}(`); if (i < 0) return null; let d = 0, j = source.indexOf("{", i); for (let k = j; k < source.length; k++) { if (source[k] === "{") d++; else if (source[k] === "}") { d--; if (!d) return source.slice(j, k + 1); } } return null; };
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("one gate judges a destination: blockFor({ thread }) or blockFor({ pid })", () => {
  const b = body("blockFor");
  assert.ok(b, "app.js has blockFor(dest)");
  assert.match(b, /sendBlock\(world\.state, \{ timeline: !dest\.thread, pid:/, "the routing rule, for that destination");
});
t("the composer asks about where its draft goes (the @-named project's chat, else this place's; a thread's reply)", () => {
  assert.match(body("liveBlock") || "", /blockFor\(composerDest\(view, text\)\)/); // its own conversation and draft (P1)
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
// (Tell the agent, after a save, is gone: the file saves itself as you type, and Space tells the agent what you changed at
// the start of its next turn, services/cowork_agent/storm/person_edits.py; there's no notice left to keep)
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
