// A send the gate refused before it went (routing Off, XO out of reach, a limit, an ended chat) is shown, not only said
// (the controls grader on d79d37e, S137 in all four cells: under routing Off, Tell the agent read "Not sent: Routing is
// off for this chat" in #live and the screen stayed Saved · Undo · Tell). The real herald runs the refused notice;
// then every refused path in app.js is checked to go through the one refuse(), which shows it. The drawn notice in
// all four cells is the flows case's.
//   node tests/refused.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as H from "../js/herald.js";

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const clock = () => { let now = 1000; const timers = []; return { now: () => now, set: (fn, ms) => { timers.push({ at: now + ms, fn }); return timers.length; }, clear: () => {}, tick(ms) { now += ms; for (const x of timers.splice(0)) if (x.at <= now) x.fn(); else timers.push(x); } }; };
const make = () => { const c = clock(), state = { herald: null }; return { c, state, her: H.createHerald({ state, now: c.now, setTimer: c.set, clearTimer: c.clear }) }; };

t("the refused notice: Not sent, why, and what was kept; a failure's kind, forced", () => {
  assert.equal(typeof H.refusedNotice, "function", "js/herald.js refusedNotice(block, kept)");
  const n = H.refusedNotice("Routing is off for this chat");
  assert.deepEqual([n.kind, n.text, n.sub, n.force], ["stopped", "Not sent: Routing is off for this chat", "your words are kept", true]);
  assert.equal(H.refusedNotice("XO can't be reached", "your text is kept").sub, "your text is kept");
});
t("shown at once over a passing line, and in its turn behind an Undo (the real herald)", () => {
  assert.equal(typeof H.refusedNotice, "function");
  const A = make();
  A.her.show({ kind: "sent", text: "Sent to demo" }, 4200);
  A.her.show(H.refusedNotice("Routing is off for this chat"), 6000);
  assert.equal(A.state.herald.text, "Not sent: Routing is off for this chat", "a passing receipt doesn't hold it back");
  const B = make();
  B.her.show({ kind: "halt", text: "Stopping", undo: () => {}, undoUntil: B.c.now() + 3000 }, 3000);
  B.her.show(H.refusedNotice("Routing is off for this chat"), 6000);
  assert.equal(B.state.herald.text, "Stopping", "an Undo keeps its place");
  B.c.tick(3100);
  assert.equal(B.state.herald && B.state.herald.text, "Not sent: Routing is off for this chat", "then the refusal, in its turn");
});

const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const body = (name) => { const i = app.indexOf(`function ${name}(`); if (i < 0) return null; let d = 0; const j = app.indexOf("{", i); for (let k = j; k < app.length; k++) { if (app[k] === "{") d++; else if (app[k] === "}" && --d === 0) return app.slice(j, k + 1); } return null; };
t("one refuse(): it says it and shows it", () => {
  const b = body("refuse");
  assert.ok(b, "app.js has refuse(block, kept)");
  assert.match(b, /announce\(`Not sent: \$\{block\}/, "said once in #live");
  assert.match(b, /heraldShow\(refusedNotice\(block, kept\), \d+\)/, "and shown");
});
t("every refused path goes through it: the composer, Chats, a Retry, a Chat's Retry, a file's Tell and Ask about this", () => {
  assert.doesNotMatch(app, /announce\(`Not sent: \$\{block\}[^`]*`\);\s*return/, "no path only says it");
  const has = (src, what) => assert.ok(/if \(block\) \{ refuse\(block[^)]*\); return( false)?; \}/.test(src || ""), what);
  has(body("sendLive"), "the composer");
  has(body("retry"), "a message's Retry");
  has(body("sendAbout"), "a file's Tell and Ask about this");
  const sendFn = body("send") || "";
  assert.match(sendFn, /CH\.isChats\(S\.view\)[\s\S]*?const block = liveBlock\(\);\s*if \(block\) \{ refuse\(block, "your text is kept"\); return; \}/, "Chats' composer");
  assert.match(app, /if \(chr\) \{[\s\S]{0,200}?const block = liveBlock\(\);\s*if \(block\) \{ refuse\(block, "the message stays, to retry"\); return; \}[\s\S]{0,120}?CH\.retry\(/, "a Chat's Retry passes the gate first");
  // and nothing else calls the gate and quietly returns
  const silent = [...app.matchAll(/(?:blockFor\([^)]*\)|liveBlock\(\))\) return;/g)].length;
  assert.equal(silent, 0, "no refused path returns without a word");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
