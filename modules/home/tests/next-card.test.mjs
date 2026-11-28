// @ts-check
import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";
import { createNextCard } from "../next-card.js";

const { document } = await dom('<main id="next-card"></main>');
const card = document.querySelector("#next-card");
const nextCard = createNextCard({
  D: {
    failedNote: (key) => key === "retry" ? "Keep the existing value" : null,
    parts: { chipsHtml: () => "", effTagHtml: () => "", leadHtml: () => '<h2 id="nx-h">Choose</h2>' },
  },
  Kit: { isBinary: (ask) => ask.kind === "approval" },
  evidenceFor: () => ({ preview: [{ label: "Mint", css: "color:green" }] }),
  PROJ: (project) => project,
  convOfChat: (chat) => "p:" + chat,
});
const thread = { id: "thread", project: "project", title: "Thread" };
const ask = { key: "choice", t: thread, group: "routine", risk: "routine", effort: "glance" };

card.innerHTML = nextCard({ ...ask, ask: { kind: "question", options: ["Mint", "Grey"] } });
assert.equal(card.querySelector(".c-where").getAttribute("data-go"), "t:thread");
assert.deepEqual([...card.querySelectorAll("[data-nx-opt] .o-l")].map((button) => button.textContent), ["Mint", "Grey"]);
assert.equal(card.querySelector('[data-nx-opt="0"] .o-s').textContent, "Mint");
assert.equal(card.querySelector('[data-fid="ev"]').getAttribute("data-decide"), "choice");

card.innerHTML = nextCard({
  ...ask, key: "retry", t: { ...thread, host: true, chatId: "chat", asker: true },
  ask: { kind: "approval", item: { options: [{ decision: "approve", label: "Approve schedule" }, { decision: "deny", label: "Leave unscheduled" }] } },
});
assert.equal(card.querySelector(".c-where").getAttribute("data-go"), "p:project");
assert.equal(card.querySelector("[data-nx-allow]").textContent, "Approve schedule");
assert.equal(card.querySelector("[data-nx-back]").textContent, "Leave unscheduled");
assert.equal(card.querySelector(".nx-note").hidden, false);
assert.equal(card.querySelector("#nx-note-in").textContent, "Keep the existing value");

card.innerHTML = nextCard({ ...ask, effort: "think", risk: "destructive", ask: { kind: "approval" } });
assert.equal(card.querySelector(".b-go[data-decide]").textContent, "Read it closely");
assert.equal(card.querySelector("[data-later]").getAttribute("data-later"), "choice");
assert.ok(!card.querySelector("[data-nx-allow]"));
