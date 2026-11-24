import assert from "node:assert/strict";
import { stopOf, stopWords } from "../core/services/world/timeline.js";
import { publishedRules, resolveValue } from "./lib/css-snapshot.mjs";
import { dom } from "./lib/dom.mjs";
import { createChecklistRenderer } from "../modules/conversation/checklist.js";
import { createScope } from "../core/kernel/scope.js";
import { createThreadGroups } from "../modules/threads/groups.js";
import { createTopHeader } from "../shell/top-header.js";

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + (e.stack || e.message)); process.exitCode = 1; } };

// ── the pure rule ─────────────────────────────────────────────────────────
await t("stopOf: only activity \"stopped\" is a stop someone meant; who, from the founder's intent or the newest stop control", () => {
  assert.equal(stopOf("failed", null, []), null, "a real failure");
  assert.equal(stopOf(null, null, []), null, "an older backend: no activity");
  assert.equal(stopOf(undefined, undefined), null);
  assert.deepEqual(stopOf("stopped", "stopped by the founder (thread)", []), { by: "you", reason: null });
  const ctl = [
    { action: "steer", by: "project-coordinator" },
    { action: "stop", by: "project-coordinator", reason: "an older one" },
    { action: "stop", by: "project-coordinator", reason: "Owner asked for Opus  instead\nof Fable." },
  ];
  assert.deepEqual(stopOf("stopped", "task stopped", ctl), { by: "coordinator", reason: "Owner asked for Opus instead of Fable." });
  assert.deepEqual(stopOf("stopped", "task stopped", [{ action: "stop", by: "workspace-coordinator" }]), { by: "workspace", reason: null });
  assert.deepEqual(stopOf("stopped", "task cancelled", undefined), { by: null, reason: null }, "its controls not read yet");
});
await t("stopWords: the quiet line", () => {
  assert.equal(stopWords({ by: "coordinator", reason: "Owner asked for Opus" }), "Stopped by the coordinator · Owner asked for Opus");
  assert.equal(stopWords({ by: "you", reason: null }), "Stopped by you");
  assert.equal(stopWords({ by: "workspace", reason: null }), "Stopped by the workspace coordinator");
  assert.equal(stopWords({ by: null, reason: null }), "Stopped");
  assert.equal(stopWords(null), "");
});

// ── storm end to end: fetch and the stream are fakes, nothing is written ──
globalThis.addEventListener = () => {};
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const realInterval = globalThis.setInterval;
globalThis.setInterval = (fn, ms) => { const h = realInterval(fn, ms); h.unref?.(); return h; };
function fakeBackend(routes) {
  const asked = [], queue = [];
  let wake = null;
  const enc = new TextEncoder();
  const push = (type, env) => { queue.push(`event: ${type}\ndata: ${JSON.stringify({ type, ...env })}\n\n`); if (wake) { const w = wake; wake = null; w(); } };
  globalThis.fetch = async (url, opts = {}) => {
    const method = (opts.method || "GET").toUpperCase();
    const path = String(url).replace(/^api/, "").split("?")[0];
    asked.push(`${method} ${path}`);
    if (method !== "GET") throw new Error(`a ${method} was sent: tests never write`);
    if (path === "/chat/stream") {
      return { ok: true, status: 200, type: "basic", body: { getReader: () => ({ cancel() {}, read: async () => {
        while (!queue.length) await new Promise((r) => { wake = r; });
        return { value: enc.encode(queue.shift()), done: false };
      } }) } };
    }
    const body = routes[path];
    return new Response(JSON.stringify(body === undefined ? { detail: "Not Found" } : body), { status: body === undefined ? 404 : 200, headers: { "Content-Type": "application/json" } });
  };
  return { asked, push };
}
const until = async (cond, ms = 3000) => { const t0 = Date.now(); while (!cond()) { if (Date.now() - t0 > ms) throw new Error("timed out"); await new Promise((r) => setTimeout(r, 5)); } };
const settle = () => new Promise((r) => setTimeout(r, 80));

let world;
await t("storm: activity and wait_reason are kept; t.stop only for a stop someone meant, with who and why once the control is read", async () => {
  const at = "2026-11-16T14:51:28Z";
  const th = (ts, extra) => ({ ts, chat_id: "chat_p", title: ts, state: "failed", session_id: "cse_" + ts, created_at: at, updated_at: at, session: { state: "warm", busy: false }, busy: false, ...extra });
  const be = fakeBackend({
    "/chat/chats": { chats: [{ id: "chat_ws", kind: "workspace" }, { id: "chat_p", kind: "project", project: "demo" }] },
    "/chat/chats/chat_p/threads": { threads: [
      th("task", { activity: "stopped", wait_reason: "task stopped" }),                       // the coordinator's stop_thread
      th("mine", { activity: "stopped", wait_reason: "stopped by the founder (thread)" }),      // the founder's Stop intent
      th("crash", { activity: "failed", wait_reason: null }),                                 // claude exited (143), a 429
      th("older"),                                                                             // an older backend: no activity
    ] },
    "/chat/sessions": { sessions: [] }, "/chat/review": { items: [] }, "/chat/chats/chat_ws/hops": { hops: [] },
    "/chat/status": { pools: [] }, "/chat/runtimes": { runtimes: [] }, "/chat/router": { mode: "auto" },
  });
  const { createWorld } = await import("../core/services/world/store.js");
  world = createWorld();
  be.push("snapshot", { data: { seq: 1, turns: [] } });
  await until(() => world.state.loaded);
  await settle();
  const T = (id) => world.thread(id);
  assert.deepEqual(["task", "mine", "crash", "older"].map((id) => T(id).state), ["failed", "failed", "failed", "failed"], "the seven words as they were");
  assert.equal(T("task").activity, "stopped");
  assert.equal(T("task").waitReason, "task stopped");
  assert.deepEqual(T("task").stop, { by: null, reason: null }, "stopped on purpose; its control not read yet");
  assert.deepEqual(T("mine").stop, { by: "you", reason: null });
  assert.equal(T("crash").stop, null, "a real failure");
  assert.equal(T("older").stop, null, "an older backend: as before");
  assert.equal(T("older").activity, null);

  // the coordinator's stop, as the stream gives it: who and why
  be.push("thread.control", { seq: 20, ts: at, chat_id: "chat_p", thread_ts: "task", data: { action: "stop", by: "project-coordinator", reason: "Owner asked for Opus instead of Fable." } });
  await settle();
  assert.equal(stopWords(T("task").stop), "Stopped by the coordinator · Owner asked for Opus instead of Fable.");

  be.push("thread", { seq: 21, ts: at, chat_id: "chat_p", thread_ts: "task", data: { ts: "task", chat_id: "chat_p", state: "working", activity: "working", wait_reason: null } });
  await settle();
  assert.equal(T("task").stop, null);
  assert.ok(be.asked.every((a) => a.startsWith("GET ")), "only GETs");
});

// ── Decide: the red Try again card only for a real failure ─────────────────
const el = () => new Proxy(function () {}, { get: (_t, k) => (k === "classList" ? { add() {}, remove() {}, toggle() {}, contains: () => false } : k === "dataset" || k === "style" ? {} : k === Symbol.toPrimitive ? () => "" : el()), apply: () => el(), set: () => true });
globalThis.document = { querySelector: () => el(), querySelectorAll: () => [], getElementById: () => el(), addEventListener() {}, createElement: () => el(), body: el(), documentElement: el() };
globalThis.localStorage = { getItem: () => null, setItem() {} };
await t("Decide: a stop someone meant asks nothing; a crash and an older backend's \"failed\" keep Try again; its open review items still ask", async () => {
  const { createDecisions } = await import("../modules/decisions/controller.js");
  const Kit = await import("../modules/decisions/kit.js");
  const mk = (id, extra) => ({ id, title: id, project: "demo", state: "failed", checklist: { items: [], done: 0, total: 0 }, asks: [], lastAt: 1, happened: "", stop: null, ...extra });
  const item = { id: "rv_1", kind: "approval", title: "Approve the schedule", risk: "notable", item: { id: "rv_1", kind: "approval", title: "Approve the schedule", options: [] } };
  const w = { state: { threads: [mk("meant", { stop: { by: "coordinator", reason: "r" }, asks: [item] }), mk("crash"), mk("older", { stop: undefined })], hosts: [] } };
  const D = createDecisions({ world: w, P: { classify() {} }, PROJ: (x) => x, announce() {}, render() {}, back() {}, later: new Set(), waitSince: new Map() });
  const got = D.needItems().map((n) => `${n.t.id}:${n.group}`).sort();
  assert.ok(!got.includes("meant:stopped"), "no Try again card for a stop someone meant");
  assert.ok(got.includes("crash:stopped") && got.includes("older:stopped"), "a real failure still asks");
  assert.ok(got.some((g) => g.startsWith("meant:") && g !== "meant:stopped"), "its open review item still asks, in its own group");
  assert.equal(Kit.groupOf(mk("x", { stop: { by: "you" } }), { risk: "notable" }), "notable");
  assert.equal(Kit.groupOf(mk("x"), { risk: "notable" }), "stopped");
});

// ── the thread says it quietly ────────────────────────────────────────────
await t("A requested stop retains its explanation across the header, checklist and panel", async () => {
  const { document } = await dom('<header id="top"><button id="top-back"></button><div id="top-who"></div><div id="top-end"></div></header><div id="thead"></div>');
  const thread = { id: "t", project: "p", title: "Test", state: "failed", lastAt: 0,
    stop: { by: "you", reason: "Finishing for today" }, checklist: { total: 1, done: 0, items: [{ state: "doing", text: "First task" }] } };
  const view = () => "t:t";
  const convThread = () => thread, isBusy = () => false;
  const { render: checklistRender } = createChecklistRenderer({
    view, scope: createScope(), convThread, SHAPE: { on: () => false }, runsStrip: () => "", schedule() {},
  });
  const header = createTopHeader({ location: { view, parentOf: () => undefined },
    convThread, isBusy, checklistRender, CH: { isChats: () => false }, STAGE: { button: () => "" },
    PROJ: () => "Project", conversationHeaderHtml: () => ({ who: "<h1>Test</h1>", controls: "" }), LP: { ensure() {} }, tdelRender() {}, REC: { sinceLine() {} } });
  const { panelThreads } = createThreadGroups({ world: { state: { threads: [thread] } }, D: { needItems: () => [] }, MAP: { agents: () => [] },
    convProject: () => "p", askShort: () => "", threadMark: () => "", isBusy, isHeld: () => false });
  header([]);
  assert.equal(document.getElementById("top").dataset.state, "");
  assert.equal(document.querySelector(".ck-now").dataset.mode, "stopped");
  assert.equal(document.querySelector(".ck-now").textContent, "Stopped by you · Finishing for today");
  assert.equal(panelThreads("t:t")[0].rows[0].sub, "Stopped by you · Finishing for today");
  thread.stop = null;
  header([]);
  assert.equal(document.getElementById("top").dataset.state, "stop");
  assert.equal(document.querySelector(".ck-now").dataset.mode, "failed");
  const rules = publishedRules();
  for (const [selector, property] of [[".g-stopped", "color"], [".st-stopped", "--st"]]) {
    const values = rules.filter((rule) => rule.sel === selector)
      .flatMap((rule) => rule.declarations.filter(({ p }) => p === property).map(({ v }) => resolveValue(v)));
    assert.deepEqual(values, [resolveValue("var(--ink-4)")]);
  }
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
process.exit(process.exitCode || 0);
