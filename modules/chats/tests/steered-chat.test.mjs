// @ts-check

// A Claude Code chat: what you send while it works joins its turn, and it reads it only at its next step.

import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";
import { chatOrder } from "../../../core/services/world/conversation.js";
import { createChats } from "../chats.js";

await dom('<div id="msgs"></div>');
const bodies = [];
const at = (s) => `2026-11-27T20:${s}`;
const said = (id, iso, ...texts) => ({ id, session_id: "n1", time_created: iso, data: { role: "user" },
  parts: texts.map((text, i) => ({ id: `${id}_p${i}`, data: { type: "text", text } })) });
let history = [];
globalThis.fetch = async (url, options) => {
  if (String(url).includes("/chat/prompt")) {
    bodies.push(JSON.parse(String(options?.body)));
    return Response.json({ session_id: "s1", turn_id: "t1" });
  }
  if (String(url).includes("api/messages/n1")) return Response.json({ total: history.length, offset: 0, messages: history });
  if (String(url).includes("api/chat/sessions?")) return Response.json({ sessions: [], next_after_seq: null });
  return Response.json({ detail: "not here" }, { status: 404 });
};

const steered = { name: "claude_code", features: { features: { send_while_running: { behaviour: "steered" } } } };
const sessions = { s1: { id: "s1", role: "plain", agent: "claude_code", state: "running", native_id: "n1", cwd: "/home" } };
let turn = "t1", state = "running";
/** @type {{ id: string, session: string, at: string, origin: string, wakes: string[], status: string }[]} */
let turns = [];
const chats = createChats({
  world: {
    state: { sessions, projects: [], runtimes: [steered], turns: { list: (keep) => turns.filter(keep), blocksOf: () => [] } },
    project: () => null,
    onEvent() {},
    act: { sentAt: () => ({ at: 1, seq: 2 }), noteSession() {}, turnOf: () => turn, sessionState: () => state },
  },
  view: () => "c:s1", go() {}, announce() {}, heraldShow() {}, restore: () => false, schedule() {},
}, {
  cliName: (name) => name || "", turnHtml: (t) => `[turn ${t.id}]`, turnAv: () => "", chatOrder,
  heldShort: () => "", heldBadge: () => "", dayGroup: () => "", rowTime: () => "",
});
const html = () => chats.items("c:s1").map((item) => item.html).join("");
const read = () => html().replace(/<div class="meta">.*?<\/div>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

Date.now = () => Date.parse(at("30:48.709Z"));
await chats.send("c:s1", "show me the file chip of this");
assert.equal(bodies[0].delivery, "add", "it still joins the running turn");
assert.match(html(), /Sent · it reads this after its current step/, "it says the agent hasn't read it yet");
assert.match(html(), /data-interrupt[^>]*>.*Interrupt</, "and offers Interrupt, as a message that waits does");
state = "stopping";
assert.match(html(), /Stopping its turn · it reads this next/);
assert.doesNotMatch(html(), /data-interrupt/);
state = "running"; turn = "t2";
assert.doesNotMatch(html(), /Sent ·|data-interrupt/, "its next turn reads it: nothing is pending any more");

// stopped mid-step, claude writes a note and the prompts it was sent as one message, and answers in a turn of its own
Date.now = () => Date.parse(at("30:58.365Z"));
await chats.send("c:s1", "done run it");
history = [
  said("u1", at("30:42.580Z"), "/home/coder/xo-deploy-pr.sh"),
  said("u2", at("31:06.973Z"), "[Request interrupted by user for tool use]"),
  said("u3", at("31:06.982Z"), "show me the file chip of this\ndone run it"),
];
turns = [
  { id: "t1", session: "s1", at: at("30:42Z"), origin: "person", wakes: ["msg:prompt:a", "msg:prompt:b", "msg:prompt:c"], status: "stopped" },
  { id: "t2", session: "s1", at: at("31:06Z"), origin: "injected", wakes: [], status: "finished" },
];
chats.open("c:s1");
for (let i = 0; i < 20 && !html().includes("xo-deploy"); i++) await new Promise(setImmediate);
assert.equal(read(), "/home/coder/xo-deploy-pr.sh [turn t1] show me the file chip of this done run it [turn t2]",
  "its answer sits under your message; the CLI's note isn't yours; what this tab sent shows once");
console.log("ok steered-chat");
