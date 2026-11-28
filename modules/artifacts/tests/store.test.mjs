import { createScope } from "../../../core/kernel/scope.js";
import assert from "node:assert/strict";
import { deferred } from "../../../tests/lib/dom.mjs";

const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
const { createMadeStore } = await import("../store.js");

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };
const tick = () => new Promise((r) => setTimeout(r, 0));

const row = (id, at, o = {}) => ({ id, name: `${id}.md`, relative_path: `${id}.md`, project_id: "demo", updated_at: at, ...o });
const threads = [{ id: "t1", project: "demo", title: "Writer", lastAt: Date.now(), outputs: [{ name: "notes.md", path: "notes.md" }] }];
const world = { state: { threads, projects: [{ id: "demo", chatId: "c1" }] }, project: (id) => (id === "demo" ? { id: "demo", chatId: "c1" } : null) };
const make = (api) => {
  const said = [], marks = { scheduled: 0 };
  const scope = createScope();
  const S = createMadeStore({ scope, world, api, schedule: () => marks.scheduled++, announce: (w) => said.push(w) });
  return { S, said, marks, scope };
};

await t("the backend's newest page, newest first, once it answers; pending until then", async () => {
  const asked = [];
  const { S, marks } = make({ made: async (chat, o) => { asked.push([chat, o.limit, o.before]); return { made: [row("a", "2026-11-19T10:00:00Z"), row("b", "2026-11-19T12:00:00Z")], next_before: null }; } });
  assert.equal(S.madePending(null), true);
  assert.deepEqual(S.madeOf("demo").map((m) => m.name), ["notes.md"], "meanwhile, what threads shared (the views hold stand-ins while it's pending)");
  await tick();
  assert.deepEqual(S.madeOf("demo").map((m) => m.id), ["b", "a"]);
  assert.equal(S.madePending(null), false);
  assert.deepEqual(asked, [["c1", 200, undefined]]);
  assert.ok(marks.scheduled >= 1);
});
await t("a Space without the route: what threads shared, and pins kept in this browser", async () => {
  store.clear();
  const { S, said } = make({ made: async () => { throw Object.assign(new Error("no"), { status: 404 }); } });
  S.madeOf("demo"); await tick();
  const [m] = S.madeOf("demo");
  assert.equal(m.name, "notes.md");
  S.togglePin(m.key);
  assert.equal(S.madeOf("demo")[0].pinned, true);
  assert.deepEqual(JSON.parse(store.get("xo-made-pins")), [m.key]);
  assert.deepEqual(said, ["Pinned"]);
});
await t("pins kept under xo-made-pins before a reload are read again", async () => {
  store.set("xo-made-pins", JSON.stringify(["t1|notes.md"]));
  const { S } = make({ made: async () => { throw Object.assign(new Error("no"), { status: 404 }); } });
  S.madeOf("demo"); await tick();
  assert.equal(S.madeOf("demo")[0].pinned, true);
});
await t("the backend's pin shows at once and goes back when it's refused", async () => {
  const { S, said } = make({ made: async () => ({ made: [row("a", "2026-11-19T10:00:00Z")], next_before: null }), pinMade: () => Promise.reject(new Error("refused")) });
  S.madeOf("demo"); await tick();
  S.togglePin("a");
  assert.equal(S.madeOf("demo")[0].pinned, true);
  await tick();
  assert.equal(S.madeOf("demo")[0].pinned, false);
  assert.deepEqual(said, ["Pinned", "Couldn't pin it: refused"]);
});
await t("a refresh started before pinning cannot revert the saved pin", async () => {
  const realNow = Date.now;
  const start = realNow();
  const refresh = deferred();
  const edits = [];
  let readCount = 0;
  const item = () => row("a", "2026-11-19T10:00:00Z", { pinned: false });
  const { S, scope } = make({
    made: () => ++readCount === 1 ? Promise.resolve({ made: [item()] }) : refresh.promise,
    pinMade: async (_chat, _id, pinned) => { edits.push(pinned); },
  });
  try {
    Date.now = () => start;
    S.madeOf("demo");
    await tick();
    Date.now = () => start + 60_000;
    S.madeOf("demo");
    await tick();
    assert.equal(readCount, 2);
    S.togglePin("a");
    await tick();
    assert.deepEqual(edits, [true]);
    refresh.resolve({ made: [{ ...item(), name: "renamed.md" }] });
    await tick();
    const [view] = S.madeOf("demo");
    assert.equal(view.name, "renamed.md", "the refresh updates the rest of the row");
    assert.equal(view.pinned, true, "the older pin value cannot undo the local write");
  } finally {
    Date.now = realNow;
    scope.dispose();
  }
});

await t("rapid pin changes save in order while immediately showing the latest choice", async () => {
  const edits = [];
  const pending = deferred();
  const { S, scope } = make({
    made: async () => ({ made: [row("a", "2026-11-19T10:00:00Z", { pinned: false })] }),
    pinMade: async (_chat, _id, pinned) => {
      edits.push(pinned);
      if (pinned) await pending.promise;
    },
  });
  S.madeOf("demo");
  await tick();
  S.togglePin("a");
  assert.equal(S.madeOf("demo")[0].pinned, true);
  S.togglePin("a");
  assert.equal(S.madeOf("demo")[0].pinned, false);
  assert.deepEqual(edits, [true], "unpin waits until the server answers the pin");
  pending.resolve();
  await tick();
  assert.deepEqual(edits, [true, false]);
  assert.equal(S.madeOf("demo")[0].pinned, false);
  scope.dispose();
});
await t("older pages are read a page at a time from one second past the last, and merged", async () => {
  const asked = [];
  const pages = { undefined: { made: [row("n", "2026-11-19T12:00:00Z")], next_before: "2026-11-19T12:00:00Z" }, "2026-11-19T12:00:01Z": { made: [row("o", "2026-11-18T09:00:00Z")], next_before: null } };
  const { S } = make({ made: async (chat, o) => { asked.push(o.before); return pages[o.before]; } });
  S.madeOf("demo"); await tick();
  assert.equal(S.olderLeft(), true);
  S.olderPages(); await tick();
  assert.deepEqual(asked, [undefined, "2026-11-19T12:00:01Z"]);
  assert.deepEqual(S.madeOf("demo").map((m) => m.id), ["n", "o"]);
  assert.equal(S.olderLeft(), false);
});

await t("a project that changes chat reads and pins from the new owner", async () => {
  const project = { id: "demo", chatId: "before" };
  const edits = [];
  const localWorld = { state: { threads, projects: [project] }, project: () => project };
  const scope = createScope();
  const S = createMadeStore({
    scope, world: localWorld, schedule() {}, announce() {},
    api: {
      made: async (chat) => ({ made: [row(chat, "2026-11-19T12:00:00Z")] }),
      pinMade: async (chat, id, on) => { edits.push([chat, id, on]); },
    },
  });
  try {
    S.madePending(null);
    await tick();
    assert.deepEqual(S.madeOf(null).map(({ id }) => id), ["before"]);
    project.chatId = "after";
    S.madePending(null);
    await tick();
    assert.deepEqual(S.madeOf("demo").map(({ id }) => id), ["after"]);
    assert.deepEqual(S.madeOf(null).map(({ id }) => id), ["after"]);
    S.togglePin("after");
    await tick();
    assert.deepEqual(edits, [["after", "after", true]]);
  } finally {
    scope.dispose();
  }
});

await t("each store deduplicates reads and disposal prevents late commits", async () => {
  const pending = deferred();
  const signals = [];
  const api = { made: (_chat, _query, { signal }) => { signals.push(signal); return pending.promise; } };
  const { S: first, marks, scope: firstScope } = make(api);
  const { S: second, scope: secondScope } = make(api);
  first.madePending(null);
  first.madeOf("demo");
  second.madePending(null);
  await tick();
  assert.equal(signals.length, 2);
  firstScope.dispose();
  assert.equal(signals[0].aborted, true);
  assert.equal(signals[1].aborted, false);
  pending.resolve({ made: [row("late", "2026-11-19T12:00:00Z")] });
  await tick();
  assert.deepEqual(first.madeOf("demo").map((item) => item.name), ["notes.md"]);
  assert.deepEqual(second.madeOf("demo").map((item) => item.name), ["late.md"]);
  assert.equal(marks.scheduled, 0);
  secondScope.dispose();
});

await t("an unexpected refresh failure reports once and leaves the last artifacts visible", async () => {
  const now = Date.now;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "reportError");
  const reports = [];
  const failure = new Error("Made storage unavailable");
  Object.defineProperty(globalThis, "reportError", { configurable: true, value: (error) => reports.push(error) });
  let requests = 0;
  const { S, scope } = make({ made: async () => {
    if (requests++ === 0) return { made: [row("saved", "2026-11-19T12:00:00Z")] };
    throw failure;
  } });
  try {
    const start = now();
    Date.now = () => start;
    S.madePending(null);
    await tick();
    Date.now = () => start + 60_000;
    assert.deepEqual(S.madeOf("demo").map((item) => item.name), ["saved.md"]);
    S.madePending(null);
    await tick();
    assert.deepEqual(S.madeOf("demo").map((item) => item.name), ["saved.md"]);
    assert.deepEqual(reports, [failure]);
    assert.equal(requests, 2);
  } finally {
    scope.dispose();
    Date.now = now;
    if (descriptor) Object.defineProperty(globalThis, "reportError", descriptor);
    else Reflect.deleteProperty(globalThis, "reportError");
  }
});
console.log(`\n${passed} passed`);
