import assert from "node:assert/strict";
import { sheet } from "./lib/cascade.mjs";
import { dom } from "./lib/dom.mjs";
import { createConversationMessages } from "../modules/conversation/messages.js";
import { createMessageItems } from "../modules/conversation/message-items.js";
const css = sheet(new URL("../css/app.css", import.meta.url));
const rich = sheet(new URL("../core/ui/markdown/rich.css", import.meta.url));
const bubbles = sheet(new URL("../modules/conversation/msgx.css", import.meta.url));
const { uiMsg } = await import("../core/services/world/rows.js");
const row = { id: "cmsg_2", chat_id: "chat_b", seq: 9, created_at: "2026-11-21T20:32:00Z", author_kind: "agent", author_id: "project-coordinator", text: "The workspace wants your approval", extra: { forwarded_from: { chat_id: "chat_a", message_id: "cmsg_1", via: ["xo-coworker", "workspace"] } } };
const m = uiMsg(row);
assert.equal(m.who, "coord");
assert.deepEqual(m.fwd, { chatId: "chat_a", id: "cmsg_1", via: ["xo-coworker", "workspace"] });
const world = {
  state: {
    hist: {}, threads: [],
    timeline: { demo: [{ ...row, id: "original", seq: 8, text: "The local coordinator's words", extra: {} }, row] },
  },
};
const messagesOf = createConversationMessages({
  world, D: { decisions: () => [], notSent: () => [] }, shape: { on: () => false },
  localMessages: { list: () => [], mergeEchoes() {}, alias: () => null },
  convThread: () => null, chatOf: () => "demo", threadsOf: () => [],
});
assert.deepEqual(messagesOf("p:demo").at(-1).fwd, m.fwd, "an agent's copy keeps where it came from");
assert.equal(messagesOf("ws").at(-1).fwd, null);
const { document } = await dom('<section id="messages"></section>');
const view = createMessageItems({
  world, messagesOf, STAGE: { chosen: () => null }, CH: { isChats: () => false },
  convThread: () => null, fwdSource: () => "source", PROJ: () => "Source",
  reactionsHtml: () => "<span class=reactions></span>", nameOf: () => ["Local coordinator", ""],
});
const list = document.getElementById("messages");
list.innerHTML = view.msgItems("p:demo", []).map((item) => item.html).join("");
const message = list.querySelector(".m-them.m-ext");
assert.ok(message, "a copy sits in its own card");
assert.equal(list.querySelector(".route-row.is-copy"), null, "where it came from is no longer a footnote under the words");
assert.equal(message.classList.contains("cont"), false, "a copy does not fold into the chat's own speaker");
assert.equal(message.classList.contains("m-anon"), false, "a copy always shows its header");
const head = message.querySelector(".mb>.mh");
assert.equal(head.querySelector("b").textContent, "Source coordinator");
const from = head.querySelector(".m-from");
assert.ok(from, "the header says where it came from");
assert.equal(from.querySelector("button").getAttribute("data-go-msg"), "cmsg_1");
assert.match(from.textContent, /another project · via the Workspace/);
assert.equal(message.firstElementChild.classList.contains("av-p"), true, "a copy wears the project mark, not the chat's own");
assert.match(rich, /:root:not\(\[data-msgx\]\) \.m-ext\{border:var\(--hair\) solid var\(--line\);border-radius:var\(--r-card\);background:var\(--surface\)\}/);
assert.match(bubbles, /:root\[data-msgx\] \.m-ext \.mh\{display:flex;/);
assert.match(css, /@media \(max-width:760px\)\{\.m-from \.via\{display:none\}\}/);
console.log("copied-speaker: ok");
