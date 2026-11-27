import assert from "node:assert/strict";
import { sheet } from "./lib/cascade.mjs";
import { dom } from "./lib/dom.mjs";
import { createConversationMessages } from "../modules/conversation/messages.js";
import { createMessageItems } from "../modules/conversation/message-items.js";
const css = sheet(new URL("../css/app.css", import.meta.url));
const { uiMsg } = await import("../core/services/world/rows.js");
const notice = (id, seq, text, extra = {}) => ({ id, chat_id: "chat_b", seq, created_at: `2026-11-26T13:0${seq}:00Z`, author_kind: "system", author_id: "space-advisory", text, extra });
const said = notice("n1", 1, "Memory at 93% of 8 GB. Largest users: xo-coworker 2.1 GB across 3 threads.");
assert.deepEqual(uiMsg(said).space, { percent: 93, total: 8, users: [{ name: "xo-coworker", gb: 2.1, threads: 3 }] }, "the numbers come from the words");
assert.deepEqual(uiMsg(notice("n0", 1, "Memory at 93%", { advisory: { percent: 88.5 } })).space, { percent: 88.5, total: null, users: [] }, "extra.advisory wins once it is sent");
const real = "Memory at 90% of 8 GB. Largest users: xo-space 2 GB across 9 threads; xo-coworker 1.2 GB across 3 threads; the workspace coordinator 0.2 GB.";
assert.deepEqual(uiMsg(notice("r", 1, real)).space.users.map((u) => [u.name, u.gb, u.threads]),
  [["xo-space", 2, 9], ["xo-coworker", 1.2, 3], ["workspace coordinator", 0.2, null]]);
assert.deepEqual(uiMsg(notice("odd", 1, "Memory at 90% of 8 GB. Largest users: whoever.")).space.users, [], "words it can't read list no one");
assert.equal(uiMsg({ ...said, author_id: "router" }).space, null, "other system lines are not Space notices");

const world = { state: { hist: {}, threads: [], timeline: { demo: [] } } };
const messagesOf = createConversationMessages({
  world, D: { decisions: () => [], notSent: () => [] }, shape: { on: () => false },
  localMessages: { list: () => [], mergeEchoes() {}, alias: () => null },
  convThread: () => null, chatOf: () => "demo", threadsOf: () => [],
});
world.project = (p) => p === "xo-space" || p === "xo-coworker" ? { id: p } : null;
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
assert.equal(rows[0].querySelector(".sp-head").textContent, "Memory at 86% of 8 GB · Space advisory", "the number leads, the source follows");
assert.equal(rows[0].querySelector(".sp-bar").getAttribute("aria-valuenow"), "86");
assert.equal(rows[0].querySelector(".sp-users"), null);

rows = draw([notice("r", 1, real)]);
assert.deepEqual([...rows[0].querySelectorAll(".sp-users li")].map((li) => li.textContent),
  ["xo-space 2 GB · 9 threads", "xo-coworker 1.2 GB · 3 threads", "Workspace coordinator 0.2 GB"], "each user on its own, not in one sentence");
assert.equal(rows[0].querySelector('.sp-users [data-go="p:xo-space"]') != null, true, "a project opens in one click");
assert.match(rows[0].querySelector(".sp-bar i").getAttribute("style"), /--u:0\.9/);

rows = draw([notice("plain", 1, "The Space restarts at 18:00.")]);
assert.match(rows[0].textContent, /Space advisory · The Space restarts at 18:00\./, "a notice without numbers reads as written");

rows = draw([said, notice("n2", 2, "Memory at 95% of 8 GB.", { forwarded_from: { chat_id: "chat_ws", message_id: "m9", via: ["workspace"] } })]);
assert.equal(rows.length, 1, "a repeat updates the row instead of adding one");
assert.equal(rows[0].classList.contains("is-hot"), true, "90% and over is red");
assert.match(rows[0].querySelector(".sp-head").textContent, /Memory at 95% of 8 GB · Space advisory · via the Workspace/);
assert.match(rows[0].textContent, /via the Workspace/);
assert.equal(rows[0].querySelector(".ev-n")?.textContent, "updated 2×");

assert.match(css, /\.ev-space\.is-hot\{background:var\(--err-subtle\)\}/);
console.log("space-advisory: ok");
