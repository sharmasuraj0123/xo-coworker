// @ts-check

// Decisions on a DOM: the needs-you list, the card, one decision per ask, the 3 s window with Undo, then one world call.
import assert from "node:assert/strict";
import { dom, settle } from "./lib/dom.mjs";


const { window } = await dom(`<div id="app"><aside id="panel"><div id="pn-h"></div><div id="pn-rail"></div><div id="pn-count"></div><div id="pn-stage"></div><div id="pn-foot"></div><button id="pn-x"></button></aside><div id="toast"></div><div id="live"></div></div>`);
const g = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (globalThis));
g.MutationObserver = window.MutationObserver;
g.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
g.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const Kit = await import("../modules/decisions/kit.js");
const { createDecisions } = await import("../modules/decisions/controller.js");
const { createPacing } = await import("../modules/decisions/pacing.js");

const calls = [];
const thread = (id, title, asks, state = "needs_approval") => ({ id, title, project: "demo", state, asks, checklist: { done: 0, total: 0, items: [] }, needsYou: "", messages: [] });
const world = {
  state: { threads: [
    thread("t1", "Tidy the README", [{ id: "perm_1", kind: "permission", title: "Run: npm test", risk: "routine" }]),
    thread("t2", "Clean the branch", [{ id: "perm_2", kind: "permission", title: "Run: git push --force", risk: "destructive" }]),
  ], hosts: [] },
  act: {
    decide: (id, verdict, note) => { calls.push(["decide", id, verdict, note]); return Promise.resolve(); },
    reply: (id, text) => { calls.push(["reply", id, text]); return Promise.resolve(); },
    resolve: (id) => { calls.push(["resolve", id]); return Promise.resolve(); },
    decideItem: (id, body) => { calls.push(["decideItem", id, body]); return Promise.resolve(); },
  },
};
const said = [], undone = [], sent = [];
const D = createDecisions({
  world, P: createPacing({}), PROJ: (p) => p, announce: (w) => said.push(w), render() {}, back() {}, later: new Set(), waitSince: new Map(),
  onOpenThread() {}, onAllClear() {}, onUndone: (k) => undone.push(k), onBreak() {}, onSent: (p) => sent.push(p.key), onNotSent() {},
});

// the needs-you list: each ask once, keyed by its id and words, with its risk
const keys = () => D.needItems().map((n) => n.key).sort();
assert.deepEqual(keys(), ["perm_1|Run: npm test", "perm_2|Run: git push --force"]);
const n1 = D.needItems().find((n) => n.key === "perm_1|Run: npm test");
assert.equal(n1.risk, "routine"); assert.equal(n1.group, "routine");
assert.equal(D.needItems().find((n) => n.t.id === "t2").group, "rope", "a destructive ask is roped");

// the card, as the conversation's dock draws it: the ask's words and its two answers
const card = D.cardHtml(n1, "dock");
const cardView = document.createElement("div");
cardView.innerHTML = card;
assert.equal(cardView.querySelector(".c-h").textContent, "Run a command");
assert.equal(cardView.querySelector(".c-ev code").textContent, "npm test");
assert.match(cardView.querySelector(".dt-why").textContent, /The agent is waiting on you/);
assert.equal(cardView.querySelector(".dt-side h4").textContent, "Checklist 0 of 0");
assert.match(card, /data-act="allow" title="Allow \(A\)"/); assert.match(card, /data-act="back" title="Send back with a note \(D\)"/);
assert.match(cardView.querySelector(".teach-q").textContent, /Standing rule for demo: you may run "npm test" without asking\./);

// a destructive ask is never allowed by a key or a click: only the hold
assert.equal(D.decideNow("perm_2|Run: git push --force", "allow"), false);
assert.equal(calls.length, 0);

// decided: it leaves the list at once, nothing is sent yet, and Undo brings it back with nothing sent
assert.equal(D.decideNow("perm_1|Run: npm test", "allow"), true);
assert.deepEqual(keys(), ["perm_2|Run: git push --force"], "the decided ask leaves the list");
assert.equal(D.queued("perm_1|Run: npm test"), true, "held in the commit window");
assert.match(said.at(-1), /^Allowed\. Undo for 3 seconds\.$/);
assert.equal(D.decideNow("perm_1|Run: npm test", "allow"), false, "one decision per ask");
assert.equal(D.decide(n1, "allow"), null, "a second press on the same card does nothing");
const toastLine = document.querySelector("#toast");
assert.ok(toastLine.classList.contains("hr") && !toastLine.classList.contains("toast"), "the Undo line is the notice line's pill");
assert.equal(toastLine.querySelector(".hr-t")?.textContent, "Allowed");
const toastUndo = toastLine.querySelector(".hr-undo");
assert.ok(toastUndo);
toastUndo.click();
assert.deepEqual(undone, ["perm_1|Run: npm test"]);
assert.match(said.at(-1), /^Undone\. Nothing was sent; the ask is back\.$/);
assert.deepEqual(keys(), ["perm_1|Run: npm test", "perm_2|Run: git push --force"], "the ask is back");
assert.equal(D.undo(), false, "nothing left to undo");

// decided again and left alone: after the window the world hears it once, and the ask stays answered
assert.equal(D.decideNow("perm_1|Run: npm test", "deny"), true);
await new Promise((r) => setTimeout(r, Kit.COMMIT_MS - 400));
assert.equal(calls.length, 0, "still inside the window");
await new Promise((r) => setTimeout(r, 700)); await settle();
assert.deepEqual(calls, [["decide", "perm_1", "deny", ""]], "sent once, as decided");
assert.deepEqual(sent, ["perm_1|Run: npm test"]);
assert.equal(D.undo(), false, "a sent decision can't be undone");
assert.deepEqual(keys(), ["perm_2|Run: git push --force"], "the answered ask doesn't come back while its thread catches up");

console.log("decisions-undo: ok");
process.exit(0);
