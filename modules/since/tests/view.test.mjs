// node modules/since/tests/view.test.mjs: Since you left on screen, on a DOM with a fake api: when it speaks, the line, Home's lines, Got it and leaving.
import assert from "node:assert/strict";
import { dom, settle } from "../../../tests/lib/dom.mjs";

const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
const calls = [];
let chats = { chats: [] };
const api = { chats: () => new Promise((r) => setTimeout(() => r(chats), 0)), worktrees: async () => ({ worktrees: [] }), markSeen: async (chat) => { calls.push(`seen ${chat}`); } };
await dom("");
const { createSince } = await import("../view.js");

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

const H = 3600 * 1000;
const now = Date.now();
const threads = [{ id: "c", project: "demo", title: "Old fix", state: "done", lastAt: now - 3 * H }, { id: "b", project: "demo", title: "Write docs", state: "working", lastAt: now - 2 * H }, { id: "a", project: "demo", title: "Fix the build", state: "done", lastAt: now - H }];
const world = { state: { threads, projects: [{ id: "demo", name: "Demo" }] }, thread: (id) => threads.find((x) => x.id === id), project: (id) => (id === "demo" ? { id: "demo", name: "Demo" } : null) };
const said = [];
let box = null;
// each case on its own page, so only its own instance hears the clicks
const make = async () => {
  await dom(`<div id="home" tabindex="-1"></div><div id="scroller" tabindex="-1"></div><div id="since" hidden></div>`);
  box = document.getElementById("since");
  said.length = 0;
  const s = createSince({ world, api, schedule() {}, announce: (w) => said.push(w) });
  s.view = () => "p:demo";
  return s;
};

await t("a first visit says nothing and marks the place seen", async () => {
  store.clear();
  const S = await make();
  await settle();
  S.sinceLine("demo", []);
  assert.equal(box.hidden, true);
  assert.ok(JSON.parse(store.get("xo-seen"))["p:demo"] > 0);
});
await t("back after 8 hours: one line under the header, a part per group, each opening its newest thread", async () => {
  store.set("xo-seen", JSON.stringify({ "p:demo": now - 9 * H, home: now - 9 * H }));
  const S = await make();
  await settle();
  S.sinceLine("demo", []);
  assert.equal(box.hidden, false);
  assert.match(box.textContent, /^Since /);
  assert.deepEqual([...box.querySelectorAll(".sl-part")].map((b) => [b.dataset.go, b.textContent]), [["t:a", "2 finished"], ["t:b", "1 still going"]], "a part opens the newest thread in its group");
  assert.match(S.homeSinceLines([]), /data-go="p:demo">Demo<\/button>/);
});
await t("under 8 hours away nothing speaks", async () => {
  store.set("xo-seen", JSON.stringify({ "p:demo": now - 7 * H }));
  const S = await make();
  await settle();
  S.sinceLine("demo", []);
  assert.equal(box.hidden, true);
});
await t("Got it: the line goes, the place is seen, focus goes to the conversation, never the page", async () => {
  store.set("xo-seen", JSON.stringify({ "p:demo": now - 9 * H }));
  const S = await make();
  await settle();
  S.sinceLine("demo", []);
  const x = box.querySelector("[data-rec-got]");
  x.focus();
  x.dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.equal(document.activeElement.id, "scroller");
  assert.deepEqual(said, ["Caught up"]);
  S.sinceLine("demo", []);
  assert.equal(box.hidden, true);
  assert.ok(JSON.parse(store.get("xo-seen"))["p:demo"] > now - 1000);
});
await t("Home's Got it: Home's lines go, and focus goes to Home", async () => {
  store.set("xo-seen", JSON.stringify({ home: now - 9 * H }));
  const S = await make();
  await settle();
  const home = document.getElementById("home");
  home.innerHTML = S.homeSinceLines([]);
  const x = home.querySelector('[data-rec-got="home"]');
  x.focus();
  x.dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.equal(document.activeElement.id, "home");
  assert.deepEqual(said, ["Caught up"]);
  assert.equal(S.homeSinceLines([]), "");
});
await t("a project with a chat waits for the backend's mark before it speaks, then the later of the two counts", async () => {
  store.set("xo-seen", JSON.stringify({ "p:demo": now - 9 * H }));
  chats = { chats: [{ id: "c1", seen: { seen_at: new Date(now - 60_000).toISOString() } }] };
  world.project = (id) => (id === "demo" ? { id: "demo", name: "Demo", chatId: "c1" } : null);
  const S = await make();
  S.sinceLine("demo", []);
  assert.equal(box.hidden, true, "its mark is on its way");
  await settle();
  S.sinceLine("demo", []);
  assert.equal(box.hidden, true, "another device looked a minute ago");
});
await t("the backend's mark counts only when it's the later one", async () => {
  store.set("xo-seen", JSON.stringify({ "p:demo": now - 9 * H }));
  chats = { chats: [{ id: "c1", seen: { seen_at: new Date(now - 30 * H).toISOString() } }] };
  world.project = (id) => (id === "demo" ? { id: "demo", name: "Demo", chatId: "c1" } : null);
  const S = await make();
  S.sinceLine("demo", []);
  assert.equal(box.hidden, true, "its mark is on its way: nothing yet, and nothing decided");
  await settle();
  S.sinceLine("demo", []);
  assert.equal(box.hidden, false, "this browser looked 9 hours ago, later than the backend's mark");
});
await t("leaving marks the place seen only when you leave it, and a project's chat mark goes to the backend", async () => {
  store.set("xo-seen", JSON.stringify({ "p:demo": 1 }));
  chats = { chats: [{ id: "c1", seen: null }] };
  world.project = (id) => (id === "demo" ? { id: "demo", name: "Demo", chatId: "c1" } : null);
  const S = await make();
  await settle();
  S.leave("t:a", "p:demo");
  assert.equal(JSON.parse(store.get("xo-seen"))["p:demo"], 1, "inside the project: not left");
  calls.length = 0;
  S.leave("p:demo", "home");
  assert.ok(JSON.parse(store.get("xo-seen"))["p:demo"] > 1);
  await settle();
  assert.deepEqual(calls, ["seen c1"]);
});
console.log(`\n${passed} passed`);
