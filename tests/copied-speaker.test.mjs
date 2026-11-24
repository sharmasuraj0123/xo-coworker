import assert from "node:assert/strict";
import { sheet } from "./lib/cascade.mjs";
import { dom } from "./lib/dom.mjs";
import { createConversationMessages } from "../modules/conversation/messages.js";
import { createMessageItems } from "../modules/conversation/message-items.js";
const css = sheet(new URL("../css/app.css", import.meta.url));
const { uiMsg } = await import("../core/services/world/timeline.js");
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
const copy = list.querySelector(".route-row.is-copy");
const message = copy.closest(".m-them");
assert.equal(message.classList.contains("cont"), false, "a copy does not fold into the chat's own speaker");
assert.equal(message.querySelector(".mh b").textContent, "Source coordinator");
assert.equal(copy.querySelector("button").getAttribute("data-go-msg"), "cmsg_1");
assert.match(copy.textContent, /Copied from Source's coordinator/);
assert.equal(copy.previousElementSibling?.classList.contains("reactions"), true, "the copy attribution follows the message's reactions");
assert.match(css, /\.route-row\.is-copy::after\{content:"";flex:1;height:1px;margin-left:var\(--s-1\);background:var\(--fill-2\)\}/);
assert.match(css, /\.route-row\.is-copy>span\{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis\}/);
assert.match(css, /@media \(max-width:760px\)\{\.route-row\.is-copy \.via\{display:none\}\}/);
console.log("copied-speaker: ok");
