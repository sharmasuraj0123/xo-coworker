// node modules/artifacts/tests/store.test.mjs: what was made, on a fake api: the backend's pages per chat, its fallback, older pages and pins.
import assert from "node:assert/strict";

const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
const { createMadeStore } = await import("../store.js");

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };
const tick = () => new Promise((r) => setTimeout(r, 0));

const row = (id, at, o = {}) => ({ id, name: `${id}.md`, relative_path: `${id}.md`, project_id: "demo", updated_at: at, ...o });
const threads = [{ id: "t1", project: "demo", title: "Writer", lastAt: Date.now(), outputs: [{ name: "notes.md", path: "notes.md" }] }];
const world = { state: { threads, projects: [{ id: "demo", chatId: "c1" }] }, project: (id) => (id === "demo" ? { id: "demo", chatId: "c1" } : null) };
const make = (api) => { const said = [], marks = { changed: 0 }; const S = createMadeStore({ world, api, schedule() {}, announce: (w) => said.push(w), changed: () => marks.changed++ }); return { S, said, marks }; };

await t("the backend's newest page, newest first, once it answers; pending until then", async () => {
  const asked = [];
  const { S, marks } = make({ made: async (chat, o) => { asked.push([chat, o.limit, o.before]); return { made: [row("a", "2026-11-19T10:00:00Z"), row("b", "2026-11-19T12:00:00Z")], next_before: null }; } });
  assert.equal(S.madePending(null), true);
  assert.deepEqual(S.madeOf("demo").map((m) => m.name), ["notes.md"], "meanwhile, what threads shared (the views hold stand-ins while it's pending)");
  await tick();
  assert.deepEqual(S.madeOf("demo").map((m) => m.id), ["b", "a"]);
  assert.equal(S.madePending(null), false);
  assert.deepEqual(asked, [["c1", 200, undefined]]);
  assert.ok(marks.changed >= 1);
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
console.log(`\n${passed} passed`);
