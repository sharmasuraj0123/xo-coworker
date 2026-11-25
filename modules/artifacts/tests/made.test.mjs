// @ts-check
import assert from "node:assert/strict";
import { deferred, dom, settle } from "../../../tests/lib/dom.mjs";

const { document } = await dom(`<div id="home"></div>`);
globalThis.cancelAnimationFrame = clearTimeout;
globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
const { createArtifactsModule } = await import("../module.js");
const { createAppServices } = await import("../../../shell/app-services.js");
const { createKernel } = await import("../../../core/kernel/index.js");
const { definePlaces, contributedSearch } = await import("../../../shell/places.js");
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
const world = { state: { threads, projects: [{ id: "demo", name: "Demo", chatId: "c1" }] }, thread: (id) => threads.find((x) => x.id === id), project: (id) => (id === "demo" ? { id: "demo", name: "Demo", chatId: "c1" } : null) };
/** @type {string[]} */
const went = [];

/** @type {Parameters<Parameters<typeof createArtifactsModule>[0]["VW"]["open"]>[0][]} */
const opened = [];
const MD = createArtifactsModule({
  go: (v) => went.push(v), VW: { open: (f) => opened.push(f) },
  skTile: () => '<li class="md-it is-sk"></li>', skBar: () => "", rememberedMade: () => 3,
});
kernel.register(createAppServices({ world, announce() {}, projectName: (p) => p.toUpperCase(), currentView: () => "home" }, () => {}));
kernel.register(MD.module);
await kernel.start();
const section = places.get("home.section", "hm-made");
const jump = (query) => contributedSearch(places, query);

await t("Home's strip: as many stand-ins as last time while it's read, then the newest things", async () => {
  const home = document.getElementById("home");
  section.render(home);
  const pending = { tiles: home.querySelectorAll(".is-sk").length, hidden: home.querySelector(".md-recent").hidden };
  reply.resolve(); await settle();
  section.render(home);
  assert.deepEqual(pending, { tiles: 3, hidden: false });
  assert.deepEqual([...home.querySelectorAll(".md-it")].map((li) => li.dataset.k), ["a", "b"]);
});
await t("⌘K finds made things by name once something is typed", () => {
  assert.deepEqual(jump(""), []);
  assert.deepEqual(jump("plan").map((r) => [r.name, r.sub]), [["plan.md", "Made in DEMO · Planner"]]);
});
await t("a card's press opens its file in the viewer; a branch goes to its thread", () => {
  document.querySelector('[data-made-file="a"]').dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.deepEqual(opened.map((f) => [f.name, f.project, f.rel]), [["plan.md", "demo", "plan.md"]]);
  document.querySelector('[data-made-file="b"]').dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.deepEqual(went, ["t:t2"]);
  assert.equal(MD.latestOf("t1", "demo")?.id, "a");
});
await t("selecting a Jump result goes to its thread and opens the file", () => {
  jump("plan")[0].run();
  assert.deepEqual(went, ["t:t2", "t:t1"]);
  assert.deepEqual(opened.map((file) => file.rel), ["plan.md", "plan.md"]);
});
console.log(`\n${passed} passed`);
