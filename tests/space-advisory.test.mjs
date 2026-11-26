import assert from "node:assert/strict";
import { sheet } from "./lib/cascade.mjs";
import { dom } from "./lib/dom.mjs";
import { createConversationMessages } from "../modules/conversation/messages.js";
import { createMessageItems } from "../modules/conversation/message-items.js";
const css = sheet(new URL("../css/app.css", import.meta.url));
const { uiMsg } = await import("../core/services/world/rows.js");
const notice = (id, seq, text, extra = {}) => ({ id, chat_id: "chat_b", seq, created_at: `2026-11-26T13:0${seq}:00Z`, author_kind: "system", author_id: "space-advisory", text, extra });
const said = notice("n1", 1, "Memory at 93% of 8 GB. Largest users: xo-coworker 2.1 GB across 3 threads.");
assert.deepEqual(uiMsg(said).space, { percent: 93 }, "the percent comes from the words while the notice has no numbers");
assert.deepEqual(uiMsg(notice("n0", 1, "Memory at 93%", { advisory: { percent: 88.5 } })).space, { percent: 88.5 }, "extra.advisory wins once it is sent");
assert.equal(uiMsg({ ...said, author_id: "router" }).space, null, "other system lines are not Space notices");

const world = { state: { hist: {}, threads: [], timeline: { demo: [] } } };
const messagesOf = createConversationMessages({
  world, D: { decisions: () => [], notSent: () => [] }, shape: { on: () => false },
  localMessages: { list: () => [], mergeEchoes() {}, alias: () => null },
  convThread: () => null, chatOf: () => "demo", threadsOf: () => [],
});
const view = createMessageItems({
  world, messagesOf, STAGE: { chosen: () => null }, CH: { isChats: () => false },
  convThread: () => null, fwdSource: () => null, PROJ: (x) => x,
  reactionsHtml: () => "", nameOf: () => ["Local coordinator", ""],
});
const { document } = await dom('<section id="messages"></section>');
const list = document.getElementById("messages");
const draw = (rows) => { world.state.timeline.demo = rows; list.innerHTML = view.msgItems("p:demo", []).map((item) => item.html).join(""); return [...list.querySelectorAll(".ev-space")]; };

let rows = draw([notice("w", 1, "Memory at 86% of 8 GB.", { advisory: { percent: 86 } })]);
assert.equal(rows.length, 1);
assert.equal(rows[0].classList.contains("is-hot"), false, "under 90% stays amber");
assert.match(rows[0].textContent, /Space advisory · Memory at 86% of 8 GB\./);

rows = draw([said, notice("n2", 2, "Memory at 95% of 8 GB.", { forwarded_from: { chat_id: "chat_ws", message_id: "m9", via: ["workspace"] } })]);
assert.equal(rows.length, 1, "a repeat updates the row instead of adding one");
assert.equal(rows[0].classList.contains("is-hot"), true, "90% and over is red");
assert.match(rows[0].textContent, /Memory at 95%/);
assert.match(rows[0].textContent, /via the Workspace/);
assert.equal(rows[0].querySelector(".ev-n")?.textContent, "updated 2×");

assert.match(css, /\.ev-space\.is-hot\{border-color:color-mix\(in srgb,var\(--err\) 40%,var\(--line\)\);background:var\(--err-subtle\)\}/);
console.log("space-advisory: ok");
