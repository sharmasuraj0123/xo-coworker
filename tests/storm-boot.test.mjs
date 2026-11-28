// storm boot, stream and reset, end to end on a fake backend: the stream first, frames held through the load, reads ordered by the stream.
import { fakeBackend, boot, until, settle, fire, intervals, thread, runner } from "./storm-harness.mjs";

const { t, done, assert } = runner();
const { createWorld } = await import("../core/services/world/store.js");

t("one world never receives the runs and turns of another instance", async () => {
  const be = fakeBackend();
  const { world: first } = await boot(be);
  be.push("turn.started", { turn_id: "first-turn", session_id: "first-session", seq: 2 }, 2);
  be.push("run.started", { session_id: "first-session", seq: 3, data: { run_id: "first-run" } }, 3);
  await until(() => first.state.runs.has("first-run"));

  const { world: second } = await boot(be);
  assert.equal(second.state.turns.get("first-turn"), null);
  assert.equal(second.state.runs.has("first-run"), false);
  be.push("turn.started", { turn_id: "second-turn", session_id: "second-session", seq: 2 }, 2);
  be.push("run.started", { session_id: "second-session", seq: 3, data: { run_id: "second-run" } }, 3);
  await until(() => second.state.runs.has("second-run"));
  assert.equal(second.state.turns.running("second-session")?.id, "second-turn");
  assert.equal(first.state.turns.running("first-session")?.id, "first-turn");
  assert.equal(first.state.turns.get("second-turn"), null);
  assert.equal(first.state.runs.has("second-run"), false);
});

t("boot: the stream opens first, nothing is read until its first frame, then everything is read", async () => {
  const be = fakeBackend();
  const world = createWorld();
  await until(() => be.conns.length === 1);
  await settle(150);
  assert.deepEqual(be.asked.map((a) => a.path), ["/chat/stream"], "no GET before the snapshot");
  be.push("snapshot", { data: { seq: 3, turns: [] } });
  await until(() => world.state.loaded);
  const paths = be.asked.map((a) => a.path);
  for (const p of ["/chat/chats", "/chat/chats/chat_p/threads", "/chat/sessions", "/chat/review", "/chat/status", "/chat/runtimes"]) assert.ok(paths.includes(p), p);
  assert.ok(paths.indexOf("/chat/chats") < paths.indexOf("/chat/chats/chat_p/threads"), "the chats before their threads");
  assert.equal(be.writes().length, 0);
});

t("boot: frames during the load are held and applied after it, in order; the stream's position moves while they wait", async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const be = fakeBackend({ "GET /chat/chats/chat_p/threads": async () => { await gate; return { threads: [thread("a", { title: "From the listing" })] }; } });
  const world = createWorld();
  const events = [];
  world.onEvent((e) => events.push(e));
  await until(() => be.conns.length === 1);
  be.push("snapshot", { data: { seq: 5, turns: [] } });
  await until(() => be.count("GET", "/chat/chats/chat_p/threads") === 1);
  be.push("thread", { chat_id: "chat_p", seq: 9, ts: "2026-11-19T10:00:05Z", data: { ts: "a", chat_id: "chat_p", title: "Renamed during the load" } }, 9);
  be.push("message", { chat_id: "chat_p", seq: 10, data: { id: "m1", chat_id: "chat_p", text: "hi", author_kind: "agent", author_id: "project-coordinator" } }, 10);
  await until(() => world.state.lastSeq === 10);
  assert.equal(world.act.sentAt().seq, 10, "a read sent now stands after the held frames");
  assert.equal(world.state.loaded, false);
  assert.equal(world.state.timeline.demo, undefined, "held, not applied");
  release();
  await until(() => world.state.loaded);
  await settle();
  assert.equal(world.thread("a").title, "Renamed during the load", "the frame from the load's time wins over the listing");
  assert.deepEqual((world.state.timeline.demo || []).map((m) => m.id), ["m1"]);
  assert.equal(events.filter((e) => e.kind === "spawn").length, 0, "no new-thread lines for what the load found");
});

t("boot: when the stream is unavailable the load starts without a first frame", async () => {
  const be = fakeBackend();
  be.refuseStream(503, { message: "Stream temporarily unavailable" });
  const world = createWorld();
  await until(() => world.state.loaded);
  assert.ok(be.count("GET", "/chat/chats") >= 1);
});

t("sessions: a read stands where it was sent; a frame after it wins its status and its pause; a retirement is never undone", async () => {
  const be = fakeBackend({ "GET /chat/sessions": { sessions: [{ id: "cse_1", seq: 1, chat_id: "chat_p", role: "thread", state: "warm" }] } });
  const { world } = await boot(be, { seq: 20 });
  assert.equal(world.state.sessions.cse_1.statusSeq, 20);
  const sent = world.act.sentAt();
  be.push("session", { session_id: "cse_1", seq: 21, data: { status: "running" } }, 21);
  be.push("session", { session_id: "cse_1", seq: 22, data: { reason: "paused", why: "loop" } }, 22);
  await until(() => world.state.sessions.cse_1.paused === "loop");
  world.act.noteSession({ id: "cse_1", state: "warm", paused: null }, sent);
  assert.equal(world.state.sessions.cse_1.state, "running", "the frame came after the read was sent");
  assert.equal(world.state.sessions.cse_1.paused, "loop");
  world.act.noteSession({ id: "cse_1", state: "warm", paused: null });
  assert.equal(world.state.sessions.cse_1.state, "warm", "a read sent after the frame stands");
  assert.equal(world.state.sessions.cse_1.paused, null);
  be.push("session", { session_id: "cse_1", seq: 23, ts: "2026-11-19T11:00:00Z", data: { reason: "retired" } }, 23);
  await until(() => !!world.state.sessions.cse_1.retired_at);
  world.act.noteSession({ id: "cse_1", state: "warm", retired_at: null });
  assert.equal(world.state.sessions.cse_1.retired_at, "2026-11-19T11:00:00Z");
});

t("reset for retention: reload in place, no false new-thread lines, the open timeline read again, resume from from_seq", async () => {
  const be = fakeBackend({
    "GET /chat/chats/chat_p/threads": { threads: [thread("a"), thread("b")] },
    "GET /chat/chats/chat_p/messages": { messages: [{ id: "m1", chat_id: "chat_p", seq: 4, text: "x" }] },
  });
  const { world, events } = await boot(be, { seq: 4 });
  world.act.watch(["demo"]);
  await until(() => world.state.hist.demo && world.state.hist.demo.loaded);
  const chats = be.count("GET", "/chat/chats"), msgs = be.count("GET", "/chat/chats/chat_p/messages");
  be.push("reset", { data: { reason: "retention", from_seq: 50 } });
  be.end();
  await until(() => be.conns.length === 2);
  assert.equal(be.count("GET", "/chat/chats"), chats + 1, "read again");
  assert.equal(be.count("GET", "/chat/chats/chat_p/messages"), msgs + 1, "the watched timeline read again");
  assert.equal(be.conns[1].lastId, "50");
  await settle();
  assert.deepEqual(world.state.threads.map((x) => x.id).sort(), ["a", "b"]);
  assert.equal(events.filter((e) => e.kind === "spawn").length, 0);
});

t("reset for slowness: reconnect from from_seq, nothing read again", async () => {
  const be = fakeBackend();
  const { world } = await boot(be, { seq: 4 });
  const chats = be.count("GET", "/chat/chats");
  be.push("reset", { data: { reason: "slow", from_seq: 60 } });
  be.end();
  await until(() => be.conns.length === 2);
  assert.equal(be.conns[1].lastId, "60");
  await settle();
  assert.equal(be.count("GET", "/chat/chats"), chats);
  assert.equal(world.state.loaded, true);
});

t("a resume point the server can't read starts again from now", async () => {
  const be = fakeBackend();
  await boot(be, { seq: 4 });
  be.push("message", { chat_id: "chat_p", seq: 7, data: { id: "m7", chat_id: "chat_p", text: "x", author_kind: "agent" } }, 7);
  await settle();
  be.refuseStream(400, { code: "bad_last_event_id", message: "unknown id" });
  be.end();
  await until(() => be.conns.length === 3, 5000);
  assert.equal(be.conns[1].lastId, "7", "resumed from the last id first");
  assert.equal(be.conns[2].lastId, null, "then from now");
});

t("the tab coming back reads the status and nudges the stream; the 60 s housekeeping is set", async () => {
  const be = fakeBackend();
  await boot(be);
  const n = be.count("GET", "/chat/status");
  fire("visibilitychange");
  await until(() => be.count("GET", "/chat/status") > n);
  assert.ok(intervals.some((x) => x.ms === 60000));
});

t("an older backend: no runtime policy, intents or advisory; the rest still loads", async () => {
  const be = fakeBackend({ "GET /chat/chats/chat_p/threads": { threads: [thread("a")] } });
  const { world } = await boot(be);
  await settle(150);
  assert.equal(world.state.policy, null);
  assert.equal(be.count("GET", "/chat/chats/chat_p/runtime-policy"), 1, "the project can have a policy of its own");
  assert.equal(world.state.paidOk, false);
  assert.deepEqual(world.state.paid, []);
  assert.equal(world.state.advisory, null);
  assert.equal(world.act.policyFor("demo"), null);
  assert.ok(world.thread("a"));
});

t("a newer backend's optional fields: can_delete, continued_in and continued_from; absent, nothing is guessed", async () => {
  const be = fakeBackend({ "GET /chat/chats/chat_p/threads": { threads: [
    thread("old", { can_delete: true, continued_in: "new", state: "paused" }),
    thread("new", { continued_from: "old" }),
    thread("plain"),
  ] } });
  const { world } = await boot(be);
  assert.equal(world.thread("old").canDelete, true);
  assert.equal(world.thread("plain").canDelete, false);
  assert.deepEqual(world.thread("old").movedTo, { to: "new" });
  assert.equal(world.thread("old").frozen, true);
  assert.equal(world.thread("new").movedFrom.from, "old");
  assert.equal(world.thread("plain").movedTo, null);
  assert.equal(world.thread("plain").movedFrom, null);
});

await done();
