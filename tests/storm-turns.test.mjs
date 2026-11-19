// storm.js on turns, end to end on a fake backend: which coordinator is a chat's, "is replying", and what is kept in memory.
import { fakeBackend, boot, until, settle, advance, intervals, thread, runner } from "./storm-harness.mjs";

const { t, done, assert } = runner();
const coord = (id, seq, extra = {}) => ({ id, seq, chat_id: "chat_p", role: "project-coordinator", agent: `agent_${id}`, state: "warm", ...extra });
const turnFrames = (be, session, id, seq, extra = {}) => {
  be.push("turn.started", { session_id: session, chat_id: "chat_p", turn_id: id, seq, data: { origin: "person", ...extra } }, seq);
  be.push("turn.finished", { session_id: session, chat_id: "chat_p", turn_id: id, seq: seq + 1, data: { status: "finished" } }, seq + 1);
};

t("a chat's coordinator is its newest live one by seq, chosen before activity: an older one's work never makes it busy", async () => {
  const be = fakeBackend({ "GET /chat/sessions": { sessions: [coord("cse_old", 1, { state: "running" }), coord("cse_new", 5), coord("cse_gone", 9, { retired_at: "2026-11-19T09:00:00Z", state: "running" })] } });
  const { world } = await boot(be);
  assert.equal(world.act.coordinatorAgent("chat_p"), "agent_cse_new");
  assert.equal(world.act.coordinatorBusy("demo"), null, "an older session's running is not this chat's");
  assert.equal(world.act.replying("demo"), false);
  be.push("session", { session_id: "cse_old", seq: 20, data: { status: "queued" } }, 20);
  await settle();
  assert.equal(world.act.coordinatorHeld("demo"), null, "nor is its queued");
  be.push("session", { session_id: "cse_new", seq: 21, data: { status: "running" } }, 21);
  await settle();
  assert.equal(world.act.coordinatorBusy("demo"), "cse_new", "Stop's target is the newest");
  assert.equal(world.act.replying("demo"), true);
});

t("replying: our message waits for the coordinator; its answer ends it, any other author doesn't", async () => {
  const be = fakeBackend({
    "GET /chat/sessions": { sessions: [coord("cse_co", 1)] },
    "POST /chat/chats/chat_p/messages": (_q, b) => ({ id: "m_me", chat_id: "chat_p", text: b.text, author_kind: "owner", seq: 30 }),
  });
  const { world, events } = await boot(be);
  await world.act.ask("demo", "hello");
  assert.equal(world.state.awaiting.demo.id, "m_me");
  assert.equal(world.act.replying("demo"), true);
  assert.deepEqual(be.writes().map((w) => [w.method, w.path, w.body.text]), [["POST", "/chat/chats/chat_p/messages", "hello"]]);
  assert.equal(events.filter((e) => e.kind === "you").length, 1);
  be.push("message", { chat_id: "chat_p", seq: 31, data: { id: "m_x", chat_id: "chat_p", text: "a thread said", author_kind: "agent", author_id: "thread" } }, 31);
  await settle();
  assert.equal(world.act.replying("demo"), true);
  be.push("message", { chat_id: "chat_p", seq: 32, data: { id: "m_co", chat_id: "chat_p", text: "on it", author_kind: "agent", author_id: "project-coordinator" } }, 32);
  await settle();
  assert.equal(world.state.awaiting.demo, undefined);
  assert.equal(world.act.replying("demo"), false);
  assert.equal(events.filter((e) => e.kind === "message").pop().answered, true);
});

t("replying: a failed turn for our message says so; one put back by a restart keeps waiting", async () => {
  let n = 0;
  const be = fakeBackend({
    "GET /chat/sessions": { sessions: [coord("cse_co", 1)] },
    "POST /chat/chats/chat_p/messages": () => ({ id: `m${++n}`, chat_id: "chat_p", author_kind: "owner" }),
  });
  const { world, events } = await boot(be);
  await world.act.ask("demo", "one");
  be.push("turn.started", { session_id: "cse_co", chat_id: "chat_p", turn_id: "tu1", seq: 40, data: { wakes: ["msg:m1"] } }, 40);
  be.push("turn.finished", { session_id: "cse_co", chat_id: "chat_p", turn_id: "tu1", seq: 41, data: { status: "failed", wakes_requeued: ["msg:m1"], error: "restart" } }, 41);
  await settle();
  assert.equal(world.state.awaiting.demo.id, "m1", "requeued: still waiting");
  assert.equal(world.state.failed.demo, undefined);
  be.push("turn.started", { session_id: "cse_co", chat_id: "chat_p", turn_id: "tu2", seq: 42, data: { wakes: ["msg:m1"] } }, 42);
  be.push("turn.finished", { session_id: "cse_co", chat_id: "chat_p", turn_id: "tu2", seq: 43, data: { status: "failed", error: "boom" } }, 43);
  await settle();
  assert.equal(world.state.awaiting.demo, undefined);
  assert.deepEqual([world.state.failed.demo.error, world.state.failed.demo.id], ["boom", "m1"]);
  assert.deepEqual(events.filter((e) => e.kind === "coord_failed").map((e) => [e.project, e.text]), [["demo", "boom"]]);
  await world.act.ask("demo", "two");
  assert.equal(world.state.failed.demo, undefined, "a new message clears the failure");
});

t("replying: the coordinator going quiet ends it only after 1.5 s; nothing outlives 10 min", async () => {
  let n = 0;
  const be = fakeBackend({
    "GET /chat/sessions": { sessions: [coord("cse_co", 1)] },
    "POST /chat/chats/chat_p/messages": () => ({ id: `q${++n}`, chat_id: "chat_p", author_kind: "owner" }),
  });
  const { world } = await boot(be);
  await world.act.ask("demo", "x");
  be.push("session", { session_id: "cse_co", seq: 50, data: { status: "warm" } }, 50);
  await settle();
  assert.ok(world.state.awaiting.demo, "within the grace");
  advance(2000);
  be.push("session", { session_id: "cse_co", seq: 51, data: { status: "warm" } }, 51);
  await settle();
  assert.equal(world.state.awaiting.demo, undefined);
  await world.act.ask("demo", "y");
  assert.equal(world.act.replying("demo"), true);
  advance(10 * 60000 + 1000);
  assert.equal(world.act.replying("demo"), false);
  assert.equal(world.state.awaiting.demo, undefined);
});

t("every 60 s: unwatched sessions keep their two newest finished turns and are marked trimmed; the open thread's and plain chat's keep all", async () => {
  const be = fakeBackend({ "GET /chat/chats/chat_p/threads": { threads: [thread("open", { session_id: "s_open" })] } });
  const { world } = await boot(be);
  world.act.watchThread("open");
  world.act.watchSession("s_plain");
  let seq = 100;
  for (const s of ["s_open", "s_other", "s_plain"]) for (let i = 0; i < 3; i++) { turnFrames(be, s, `${s}_${i}`, seq); seq += 2; }
  await until(() => world.state.lastSeq === seq - 1);
  await settle();
  const count = (s) => world.state.turns.list((x) => x.session === s).length;
  assert.deepEqual([count("s_open"), count("s_other"), count("s_plain")], [3, 3, 3]);
  intervals.filter((x) => x.ms === 60000).pop().fn();
  assert.deepEqual([count("s_open"), count("s_other"), count("s_plain")], [3, 2, 3]);
  assert.equal(world.state.turns.get("s_other_0"), null, "the oldest goes");
  assert.equal(world.act.takeTrimmed("s_other"), true);
  assert.equal(world.act.takeTrimmed("s_other"), false, "asking clears it");
  assert.equal(world.act.takeTrimmed("s_open"), false);
});

t("every 60 s: finished sub-agents beyond 300 go, oldest first; live ones and the open thread's stay", async () => {
  const be = fakeBackend({ "GET /chat/chats/chat_p/threads": { threads: [thread("open", { session_id: "s_open" })] } });
  const { world } = await boot(be);
  world.act.watchThread("open");
  const iso = (i) => new Date(Date.UTC(2026, 10, 19, 0, 0, i)).toISOString();
  for (let i = 0; i < 303; i++) be.push("run.finished", { session_id: "s_x", ts: iso(i), data: { run_id: `r${i}`, state: "finished" } });
  be.push("run.finished", { session_id: "s_open", ts: iso(0), data: { run_id: "r_open", state: "finished" } });
  be.push("run.started", { session_id: "s_x", ts: iso(0), data: { run_id: "r_live", info: {} } });
  await until(() => world.state.runs.has("r_live"));
  intervals.filter((x) => x.ms === 60000).pop().fn();
  assert.equal([...world.state.runs.values()].filter((r) => r.session === "s_x" && r.state === "finished").length, 300);
  for (const id of ["r0", "r1", "r2"]) assert.equal(world.state.runs.has(id), false, id);
  for (const id of ["r3", "r302", "r_open", "r_live"]) assert.equal(world.state.runs.has(id), true, id);
});

t("a thread page beside the chat is watched as the main one: read once, its turns kept, its new hops re-read; null lets it go", async () => {
  const be = fakeBackend({
    "GET /chat/chats/chat_p/threads": { threads: [thread("main", { session_id: "s_main" }), thread("side", { session_id: "s_side" })] },
    "GET /chat/chats/chat_p/messages": { messages: [] }, "GET /chat/chats/chat_p/hops": { hops: [] }, "GET /chat/events": { events: [] },
  });
  const { world } = await boot(be);
  world.act.watchThread("main");
  world.act.watchSideThread("side");
  world.act.watchSideThread("side");
  await until(() => world.state.threadHist.side && world.state.threadHist.side.loaded);
  assert.equal(be.asked.filter((a) => a.path === "/chat/chats/chat_p/messages" && a.query.thread === "side").length, 1);
  let seq = 200;
  for (const s of ["s_main", "s_side"]) for (let i = 0; i < 3; i++) { turnFrames(be, s, `${s}_${i}`, seq); seq += 2; }
  await until(() => world.state.lastSeq === seq - 1);
  intervals.filter((x) => x.ms === 60000).pop().fn();
  assert.equal(world.state.turns.list((x) => x.session === "s_side").length, 3);
  const hops = () => be.asked.filter((a) => a.path === "/chat/chats/chat_p/hops" && a.query.thread === "side").length;
  const n = hops();
  be.push("hop", { chat_id: "chat_p", seq: 900, data: { id: "hs", kind: "relay", state: "sent", thread_ts: "side" } }, 900);
  await until(() => hops() === n + 1, 2000);
  world.act.watchSideThread(null);
  intervals.filter((x) => x.ms === 60000).pop().fn();
  assert.equal(world.state.turns.list((x) => x.session === "s_side").length, 2);
});

await done();
