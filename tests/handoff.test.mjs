// Handoffs: the setup card, the quiet handed-back line, and the handed_back / stalled thread cards.
import assert from "node:assert/strict";
import { sheet } from "./lib/cascade.mjs";
import { dom } from "./lib/dom.mjs";
import { setupOf, handoffHtml, handBackHtml, setupHtml } from "../modules/conversation/handoff.js";
import { modelWord, EFFORT_WORD } from "../core/services/runtimes.js";
import { hopLine } from "../core/services/world/relay.js";
import { createConversationMessages } from "../modules/conversation/messages.js";
import { createMessageItems } from "../modules/conversation/message-items.js";
import { createMessageDetails } from "../modules/conversation/message-details.js";

assert.deepEqual(setupOf("The project coordinator set effort to high."), { by: "project coordinator", effort: "high" });
assert.deepEqual(setupOf("The workspace coordinator set the model to opus."), { by: "workspace coordinator", model: "opus" });
assert.deepEqual(setupOf("The project coordinator set the model to gpt-6.1-terra and effort to low."),
  { by: "project coordinator", model: "gpt-6.1-terra", effort: "low" });
assert.equal(setupOf("The project coordinator stopped the thread."), null);
assert.equal(setupOf("The project coordinator set a reminder for later."), null);
assert.equal(setupOf(""), null);

assert.equal(modelWord("opus"), "Opus");
assert.equal(modelWord("gpt-6-astra"), "GPT-6 Astra");
assert.equal(modelWord("gpt-6.1-terra"), "GPT-6.1 Terra");
assert.equal(modelWord("claude-opus-5-5"), "Opus 5.5");
assert.equal(modelWord("claude-sonnet-4-5-20250929"), "Sonnet 4.5");
assert.equal(EFFORT_WORD.high, "Deep");

const { document } = await dom('<section id="x"></section>');
const box = /** @type {HTMLElement} */ (document.getElementById("x"));
const at = Date.parse("2026-11-26T14:31:00Z");

box.innerHTML = handoffHtml({ from: { agent: "claude_code", model: "opus", effort: "high" },
  to: { agent: "codex", model: "gpt-6.1-terra", effort: "medium" }, words: "Continued in <b>X</b>", at });
let chips = [...box.querySelectorAll(".ho-chip")];
assert.equal(chips.length, 2, "two chips: before and after");
assert.equal(chips[0].classList.contains("is-was"), true, "the old setup is faded");
assert.equal(chips[1].classList.contains("is-was"), false, "the new setup is at full strength");
assert.match(chips[0].textContent, /Claude Code·Opus·Deep/);
assert.match(chips[1].textContent, /Codex·GPT-6\.1 Terra·Balanced/);
assert.equal(!!chips[0].querySelector(".agm-claude"), true);
assert.equal(!!chips[1].querySelector(".agm-openai"), true);
assert.equal(!!box.querySelector(".ho-pair > .ho-arrow"), true, "an arrow between the chips");
assert.match(box.querySelector(".ho-words")?.textContent || "", /^Continued in X/);

box.innerHTML = handoffHtml({ to: { agent: "codex" }, words: "w", at });
assert.equal(box.querySelectorAll(".ho-chip").length, 1, "an unknown before side is not invented");
assert.equal(!!box.querySelector(".ho-arrow"), false);

box.innerHTML = setupHtml({ by: "project coordinator", effort: "high" }, "claude_code", at);
chips = [...box.querySelectorAll(".ho-chip")];
assert.equal(chips.length, 1, "a setup change has no before values, so one chip");
assert.equal(chips[0].querySelectorAll("b")[1]?.textContent, "Deep", "the changed field is bold");
assert.match(box.querySelector(".ho-t")?.textContent || "", /^The project coordinator set thinking to Deep\. Same session, from its next turn\.$/);

box.innerHTML = handBackHtml({ from: "codex", to: "claude_code", toWho: "the Demo coordinator", at,
  title: "Plan.md", file: "made:1", path: "docs/plan.md" });
let row = box.querySelector(".ev-handback");
assert.equal(!!row, true);
const marks = [...(row?.querySelectorAll(".ho-mini .agm") || [])].map((m) => m.className);
assert.deepEqual(marks, ["agm agm-openai", "agm agm-claude"], "the thread's mark, then the receiver's");
assert.equal(row?.querySelector("button.rt-go")?.getAttribute("data-made-file"), "made:1", "the title opens the result");
assert.match(row?.querySelector(".ev-t")?.textContent || "", /^Handed back its result · Plan\.md$/);

box.innerHTML = handBackHtml({ from: "codex", to: null, toWho: "the Demo coordinator", at });
row = box.querySelector(".ev-handback");
assert.equal(row?.querySelectorAll(".agm").length, 1, "an unknown receiver shows no second mark");
assert.equal(!!row?.querySelector(".xo, .agm-xo, svg.xo"), false, "never XO's mark");
assert.equal(!!row?.querySelector(".ho-mini .ho-arrow"), false);
assert.match(row?.querySelector(".ev-t")?.textContent || "", /^Handed back its result$/);

const hop = (id, wake, extra = {}) => ({ id, thread_ts: "t1", kind: "status", from_role: "thread", to_role: "project-coordinator",
  from_session: "s_thread", to_session: "s_coord", wake_id: wake, seq: 5, created_at: "2026-11-26T14:31:00Z", ...extra });
assert.equal(hopLine(hop("h1", "result:r1"), "Demo"), "This thread handed its result back to the Demo coordinator");
assert.match(String(hopLine(hop("h2", "idle:h0"), "Demo")), /went quiet with its task open · the Demo coordinator was told$/);

const css = sheet(new URL("../css/app.css", import.meta.url));
assert.match(css, /\.ho-pair \.ho-arrow\{animation:ho-pass var\(--dur-slow\) var\(--ease\) both\}/, "motion from tokens");
assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.ho-pair \.ho-arrow\{animation:none\}\}/, "nothing moves under reduced motion");
assert.match(css, /\.st-stalled \.tc-st\{color:var\(--warn\)\}/, "stalled is amber");

const msg = (id, seq, kind, authorId, text) => ({ id, seq, at: Date.parse(`2026-11-26T14:0${seq}:00Z`), who: kind, role: authorId, text });
const thread = {
  id: "t1", project: "demo", title: "Fix the login", loaded: true, sessionId: null, lastAt: Date.now() - 14 * 60000,
  session: { agent: "codex", model: "gpt-6.1-terra", effort: "medium" }, activity: "handed_back", state: "resolved",
  checklist: { items: [], total: 0, done: 0 }, messages: [
    msg("m1", 1, "agent", "thread", "On it."),
    msg("m2", 2, "system", "xo", "The project coordinator set effort to high."),
  ],
};
let hopsOn = false;
const world = {
  state: { hist: {}, threads: [thread], timeline: { demo: [] }, controls: { t1: [{ action: "setup", at: "2026-11-26T14:02:00Z", seq: 3 }] },
    hops: new Map([["h1", hop("h1", "result:r1")], ["h2", hop("h2", "idle:h0", { seq: 6 })]]),
    sessions: { s_thread: { agent: "codex" }, s_coord: { agent: "claude_code" } }, turns: null },
  thread: (id) => (id === "t1" ? thread : null), act: { sessionState: () => null },
};
const shape = { on: (k) => k === "xo:thread/hops" && hopsOn, word: () => "thread" };
const messagesOf = createConversationMessages({
  world, D: { decisions: () => [], notSent: () => [] }, shape, PROJ: () => "Demo",
  localMessages: { list: () => [], mergeEchoes() {}, alias: () => null },
  convThread: () => thread, chatOf: () => "demo", convProject: () => "demo", threadsOf: () => [],
});
const REC = { latestOf: () => ({ key: "made:1", title: "Login fix", name: "fix.md", path: "docs/fix.md" }) };
const details = createMessageDetails({
  aliases: () => [], world, REC, SHAPE: shape, PROJ: () => "Demo", convThread: () => thread, convProject: () => "demo",
  isBusy: () => false, isHeld: () => false, stOf: () => "idle", glyphOf: () => "idle", wordOf: () => "Idle", EFFORT: {},
  askTitle: () => "", threadMark: () => "", noun: () => "thread", sendWhileRunning: () => null, running: () => null,
  workingRuns: () => 0, agentOf: (t) => t?.session?.agent || null, isStopping: () => false,
});
const view = createMessageItems({
  world, messagesOf, STAGE: { chosen: () => null }, CH: { isChats: () => false }, fwdSource: () => null,
  PROJ: () => "Demo", reactionsHtml: () => "", ...details, convThread: () => thread,
});
const draw = () => { box.innerHTML = view.msgItems("t:t1", []).map((item) => item.html).join(""); return box; };

let rows = messagesOf("t:t1");
assert.equal(rows.some((m) => m.who === "control"), false, "a setup control is not read as stopping the thread");
assert.deepEqual(rows.find((m) => m.sid === "m2")?.setup, { by: "project coordinator", effort: "high" });
assert.equal(rows.filter((m) => m.who === "handback").length, 1, "a handed-back result shows with Show hops off");
assert.equal(rows.some((m) => m.key === "hop:h2"), false, "the idle hop waits for Show hops");
draw();
assert.equal(/stopped the thread/i.test(box.textContent), false);
assert.equal(box.querySelectorAll(".ho-card").length, 1, "the setup line renders as the handoff card");
assert.equal(!!box.querySelector(".ho-card .agm-openai"), true, "with the thread's own runtime");

hopsOn = true;
rows = messagesOf("t:t1");
assert.equal(rows.filter((m) => m.who === "handback").length, 1, "one quiet line per result hop");
assert.equal(rows.some((m) => m.key === "hop:h1"), false, "the result hop is not said twice");
assert.equal(rows.filter((m) => m.key === "hop:h2").length, 1, "the idle hop gets its own line");
draw();
row = box.querySelector(".ev-handback");
assert.deepEqual([...(row?.querySelectorAll(".agm") || [])].map((m) => m.className), ["agm agm-openai", "agm agm-claude"],
  "the receiver's mark comes from its session");
assert.match(row?.textContent || "", /Handed back its result · Login fix/);
world.state.sessions = { s_thread: { agent: "codex" } };
draw();
assert.equal(box.querySelector(".ev-handback")?.querySelectorAll(".agm").length, 1, "no receiver session, no second mark");

const card = () => { box.innerHTML = details.threadCardHtml("t1", []); return box; };
card();
assert.match(box.querySelector(".tc-st")?.textContent || "", /^Handed back · /);
assert.equal(box.querySelector(".tc-next span")?.textContent, "Open its result");
thread.activity = "stalled";
card();
assert.match(box.querySelector(".tc-st")?.textContent || "", /^Stalled · 14 min$/);
assert.equal(box.querySelector(".tc-now")?.textContent, "The coordinator was told.");
assert.equal(box.querySelector(".tcard")?.classList.contains("st-stalled"), true);
assert.equal(!!box.querySelector(".tc-next"), false);
console.log("handoff: ok");
