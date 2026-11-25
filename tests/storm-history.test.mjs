// storm history, end to end on a fake backend: pages read once and whole, rows looked up by id off the timeline, hops that only move on.
import { fakeBackend, boot, until, settle, thread, runner } from "./storm-harness.mjs";

const { t, done, assert } = runner();
const NEWEST = 9007199254740991;
const row = (seq, extra = {}) => ({ id: `r${seq}`, chat_id: "chat_p", seq, text: `row ${seq}`, author_kind: "agent", ...extra });
const gated = () => { let open; const p = new Promise((r) => { open = r; }); return { p, open: () => open() }; };

t("a project's older page is asked for once, 30 rows below the oldest, and never after the beginning", async () => {
  const g = gated();
  const be = fakeBackend({ "GET /chat/chats/chat_p/messages": async (q) => {
    if (Number(q.before_seq) === NEWEST) return { messages: [row(100)], next_before_seq: 100 };
    if (q.before_seq === "100") { await g.p; return { messages: [row(80)], next_before_seq: 80 }; }
    return { messages: [row(50)] };
  } });
  const { world } = await boot(be);
  world.act.watch(["demo"]);
  await until(() => world.state.hist.demo && world.state.hist.demo.loaded);
  assert.equal(be.asked.find((a) => a.path === "/chat/chats/chat_p/messages").query.limit, "40");
  world.act.loadOlder("demo");
  world.act.loadOlder("demo");
  await settle();
  const older = () => be.asked.filter((a) => a.path === "/chat/chats/chat_p/messages" && a.query.before_seq !== String(NEWEST));
  assert.deepEqual(older().map((a) => [a.query.before_seq, a.query.limit]), [["100", "30"]]);
  g.open();
  await until(() => world.state.hist.demo.before === 80);
  await world.act.loadOlder("demo");
  await world.act.loadOlder("demo");
  assert.deepEqual(older().map((a) => a.query.before_seq), ["100", "80"]);
  assert.equal(world.state.hist.demo.all, true);
  assert.deepEqual(world.state.timeline.demo.map((r) => r.seq), [50, 80, 100]);
});

t("a thread's first page lands with its turns and hops, not before; an older page brings its turns' frames with it", async () => {
  const hopsGate = gated(), framesGate = gated();
  const be = fakeBackend({
    "GET /chat/chats/chat_p/threads": { threads: [thread("t1", { session_id: "s1" })] },
    "GET /chat/chats/chat_p/messages": (q) => (q.before_seq === String(NEWEST) ? { messages: [row(10, { thread_ts: "t1" })], next_before_seq: 10 } : { messages: [row(5, { thread_ts: "t1" }), row(7, { thread_ts: "t1" })] }),
    "GET /chat/chats/chat_p/hops": async () => { await hopsGate.p; return { hops: [] }; },
    "GET /chat/events": async (q) => {
      if (q.kinds) return { events: [] };
      if (q.before_seq === String(NEWEST)) return { events: [], next_before_seq: 50 };
      if (q.before_seq === "50") { await framesGate.p; return { events: [], next_before_seq: 20 }; }
      return { events: [] };
    },
  });
  const { world } = await boot(be);
  world.act.watchThread("t1");
  await until(() => be.count("GET", "/chat/chats/chat_p/hops") === 1 && be.count("GET", "/chat/events") === 2);
  await settle();
  assert.equal(world.state.threadMsgs.t1, undefined, "the messages wait for the hops");
  assert.equal(world.state.threadHist.t1.loading, true);
  hopsGate.open();
  await until(() => world.state.threadHist.t1.loaded);
  assert.deepEqual(world.state.threadMsgs.t1.map((r) => r.seq), [10]);
  const older = world.act.loadOlderThread("t1");
  world.act.loadOlderThread("t1");
  await until(() => be.asked.some((a) => a.path === "/chat/events" && a.query.before_seq === "50"));
  await settle();
  assert.deepEqual(world.state.threadMsgs.t1.map((r) => r.seq), [10], "the older page waits for its frames");
  be.push("message", { seq: 11, chat_id: "chat_p", data: row(11, { thread_ts: "t1" }) });
  await until(() => world.state.threadMsgs.t1.some((r) => r.id === "r11"));
  framesGate.open();
  await older;
  assert.deepEqual(world.state.threadMsgs.t1.map((r) => r.seq), [5, 7, 10, 11]);
  const olderMsgs = be.asked.filter((a) => a.path === "/chat/chats/chat_p/messages" && a.query.thread === "t1" && a.query.before_seq !== String(NEWEST));
  assert.deepEqual(olderMsgs.map((a) => [a.query.before_seq, a.query.limit]), [["10", "30"]], "once");
  const frames = be.asked.filter((a) => a.path === "/chat/events" && !a.query.kinds).map((a) => a.query.before_seq);
  assert.deepEqual(frames, [String(NEWEST), "50", "20"], "until the frames reach the page's oldest message");
  assert.equal(world.state.threadHist.t1.all, true);
});

t("rows asked for by id: one walk per project, pages of 50 from the highest hint down, found rows off the timeline, each asked once", async () => {
  const at = { x1: 140, x2: 130, x3: 90 };
  const be = fakeBackend({ "GET /chat/chats/chat_p/messages": (q) => {
    const before = Number(q.before_seq) === NEWEST ? 1000 : Number(q.before_seq);
    const rows = [];
    for (let s = Math.max(1, before - 50); s < before; s++) rows.push(Object.entries(at).find(([, v]) => v === s) ? { ...row(s), id: Object.entries(at).find(([, v]) => v === s)[0] } : row(s));
    return { messages: rows, next_before_seq: rows.length ? rows[0].seq : null };
  } });
  const { world } = await boot(be);
  const reads = () => be.asked.filter((a) => a.path === "/chat/chats/chat_p/messages");
  world.act.findRows("demo", ["x1", "x2"], 150);
  world.act.findRows("demo", ["x3"], 120);
  await until(() => world.state.found.demo && world.state.found.demo.has("x3"));
  await settle();
  assert.deepEqual(reads().map((a) => [a.query.before_seq, a.query.limit]), [["151", "50"], ["101", "50"]]);
  assert.equal(world.state.timeline.demo, undefined, "never the visible timeline");
  world.act.findRows("demo", ["x1", "x3"], 150);
  await settle();
  assert.equal(reads().length, 2, "found rows aren't asked again");
  world.act.findRows("demo", ["nowhere"], null);
  await settle(200);
  assert.equal(reads().length, 2 + 6, "at most six pages");
  world.act.findRows("demo", ["nowhere"], null);
  await settle();
  assert.equal(reads().length, 8, "what wasn't found isn't looked for again");
});

t("hops only move on: a receipt before its hop is held for it, an older read never puts a state back", async () => {
  const be = fakeBackend({ "GET /chat/chats/chat_p/hops": { hops: [{ id: "h1", kind: "relay", state: "sent", created_at: "2026-11-19T10:00:00Z" }, { id: "h2", kind: "relay", state: "sent" }] } });
  const { world } = await boot(be);
  be.push("hop", { chat_id: "chat_p", seq: 10, data: { id: "h1", state: "answered" } }, 10);
  be.push("hop", { chat_id: "chat_p", seq: 11, data: { id: "h2", kind: "relay", state: "delivered" } }, 11);
  await settle();
  assert.equal(world.state.hops.has("h1"), false, "held until its hop is read");
  await world.act.loadChatHops("demo");
  assert.equal(world.state.hops.get("h1").state, "answered");
  assert.equal(world.state.hops.get("h2").state, "delivered", "the read said sent, the stream had moved on");
  assert.equal(world.state.hops.get("h2").seq, 11);
  await world.act.loadChatHops("demo");
  assert.equal(be.count("GET", "/chat/chats/chat_p/hops"), 1, "a chat's hops are read once");
});

t("a new hop on an open thread re-reads its hops once, after a burst settles", async () => {
  const be = fakeBackend({ "GET /chat/chats/chat_p/threads": { threads: [thread("t1")] }, "GET /chat/chats/chat_p/hops": { hops: [] }, "GET /chat/chats/chat_p/messages": { messages: [] } });
  const { world } = await boot(be);
  world.act.watchThread("t1");
  await until(() => world.state.threadHist.t1 && world.state.threadHist.t1.loaded);
  const n = be.count("GET", "/chat/chats/chat_p/hops");
  for (let i = 0; i < 3; i++) be.push("hop", { chat_id: "chat_p", seq: 20 + i, data: { id: `h${i}`, kind: "relay", state: "sent", thread_ts: "t1" } }, 20 + i);
  await settle(200);
  assert.equal(be.count("GET", "/chat/chats/chat_p/hops"), n, "not yet");
  await until(() => be.count("GET", "/chat/chats/chat_p/hops") === n + 1, 2000);
  await settle(500);
  assert.equal(be.count("GET", "/chat/chats/chat_p/hops"), n + 1);
});

await done();
