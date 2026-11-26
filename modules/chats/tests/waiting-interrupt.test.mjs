// @ts-check

// A reply sent while a plain chat works waits behind the turn, with Interrupt on it, as in a thread; no "Send now" toggle.

import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";
import { createChats } from "../chats.js";

await dom('<div id="msgs"></div>');
const bodies = [];
globalThis.fetch = async (_url, options) => { bodies.push(JSON.parse(String(options?.body))); return Response.json({ session_id: "s1", turn_id: "t2" }); };

let turn = "t1", state = "running";
const sessions = { s1: { id: "s1", role: "plain", agent: "gemini", state: "running", native_id: "n1" } };
const chats = createChats({
  world: {
    state: { sessions, projects: [], runtimes: [{ name: "gemini" }] },
    project: () => null,
    onEvent() {},
    act: { sentAt: () => ({ at: 1, seq: 2 }), noteSession() {}, turnOf: () => turn, sessionState: () => state },
  },
  view: () => "c:s1", go() {}, announce() {}, heraldShow() {}, restore: () => false, schedule() {},
}, {
  cliName: (name) => name || "", turnHtml: () => "", turnAv: () => "", chatOrder: (prompts) => prompts.map((m) => ({ kind: "you", m })),
  heldShort: () => "", heldBadge: () => "", dayGroup: () => "", rowTime: () => "",
});
const html = () => chats.items("c:s1").map((item) => item.html).join("");

assert.equal("toggleNow" in chats || "nowState" in chats, false, "no Send now toggle");
await chats.send("c:s1", "Read this after");
assert.equal(bodies[0].delivery, undefined, "it queues behind the turn, never sent \"now\"");
assert.match(html(), /Waiting · it reads this when its current turn ends/);
assert.match(html(), /data-interrupt[^>]*>.*Interrupt</);
state = "stopping";
assert.match(html(), /Stopping its turn · it reads this next/);
assert.doesNotMatch(html(), /data-interrupt/);
state = "running"; turn = "t2";
assert.doesNotMatch(html(), /Waiting|data-interrupt/, "the next turn reads it: nothing waits any more");
console.log("ok waiting-interrupt");
