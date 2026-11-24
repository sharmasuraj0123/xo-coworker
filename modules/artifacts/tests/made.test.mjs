// @ts-check
import assert from "node:assert/strict";
import { deferred, dom, settle } from "../../../tests/lib/dom.mjs";

const { document } = await dom(`<div id="tab"></div><div id="home"></div>`);
globalThis.cancelAnimationFrame = clearTimeout;
globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
const saved = JSON.stringify({ parts: [{ id: "hm-made", n: 3 }] });
globalThis.localStorage = /** @type {Storage} */ ({ getItem: (key) => key === "xo-home-shape" ? saved : null, setItem() {} });
const { createRecord } = await import("../../../js/recordview.js");
const { createKernel } = await import("../../../core/kernel/index.js");
const { definePlaces } = await import("../../../shell/places.js");
const kernel = createKernel();
definePlaces(kernel);
const { places } = kernel;

let passed = 0;
/** @param {string} name @param {() => unknown} fn */
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

const reply = deferred();
const rows = [
  { id: "a", name: "plan.md", relative_path: "plan.md", project_id: "demo", updated_at: "2026-11-19T12:00:00Z", thread_ts: "t1" },
  { id: "b", kind: "branch", name: "feat/x", git: { branch: "feat/x" }, updated_at: "2026-11-19T11:00:00Z", thread_ts: "t2" },
];
globalThis.fetch = async (input) => {
  const path = String(input);
  if (path.includes("/chat/chats/c1/made?")) {
    await reply.promise;
    return Response.json({ made: rows, next_before: null });
  }
  return new Response(null, { status: 404 });
};
const threads = [{ id: "t1", project: "demo", title: "Planner" }, { id: "t2", project: "demo", title: "Brancher" }];
/** @type {Parameters<typeof createRecord>[0]["world"] & {state: unknown}} */
const world = { state: { threads, projects: [{ id: "demo", name: "Demo", chatId: "c1" }] }, thread: (id) => threads.find((x) => x.id === id), project: (id) => (id === "demo" ? { id: "demo", name: "Demo", chatId: "c1" } : null) };
/** @type {string[]} */
const went = [];

/** @type {Parameters<Parameters<typeof createRecord>[0]["VW"]["open"]>[0][]} */
const opened = [];
const MD = createRecord({
  world, go: (v) => went.push(v), VW: { open: (f) => opened.push(f) }, PROJ: (p) => p.toUpperCase(), schedule() {}, announce() {}, places,
});

await t("Home's strip: as many stand-ins as last time while it's read, then the newest things", async () => {
  const home = document.getElementById("home");
  MD.homeMade(home);
  const pending = { tiles: home.querySelectorAll(".is-sk").length, hidden: home.querySelector(".md-recent").hidden };
  reply.resolve(); await settle();
  MD.homeMade(home);
  assert.deepEqual(pending, { tiles: 3, hidden: false });
  assert.deepEqual([...home.querySelectorAll(".md-it")].map((li) => li.dataset.k), ["a", "b"]);
});
await t("the panel's Made tab: where, how many, the kinds it has, the groups", async () => {
  const tab = document.getElementById("tab");
  MD.made.mount(tab);
  MD.panel = { isOpen: true };
  MD.made.show("p:demo");
  assert.equal(tab.querySelector("#made-h").textContent, "DEMO");
  assert.equal(tab.querySelector("#made-sub").textContent, "2 things, newest first");
  assert.deepEqual([...tab.querySelectorAll("[data-made-kind]")].map((b) => b.dataset.madeKind), ["all", "doc", "branch"]);
  assert.equal(MD.made.count("t:t1"), 2, "a thread counts its project's");
});
await t("⌘K finds made things by name once something is typed", () => {
  assert.deepEqual(MD.jumpItems(""), []);
  assert.deepEqual(MD.jumpItems("plan").map((r) => [r.name, r.sub]), [["plan.md", "Made in DEMO · Planner"]]);
});
await t("a card's press opens its file in the viewer; a branch goes to its thread", () => {
  document.querySelector('[data-made-file="a"]').dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.deepEqual(opened.map((f) => [f.name, f.project, f.rel]), [["plan.md", "demo", "plan.md"]]);
  document.querySelector('[data-made-file="b"]').dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.deepEqual(went, ["t:t2"]);
  assert.equal(MD.latestOf("t1", "demo")?.id, "a");
});
console.log(`\n${passed} passed`);
