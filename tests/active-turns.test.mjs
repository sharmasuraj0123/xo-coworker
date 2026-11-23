import { boot, fakeBackend, runner } from "./storm-harness.mjs";
const { createTurns } = await import("../core/services/world/turns.js");
const { activityOf } = await import("../core/services/agent-activity.js");

const { t, done, assert } = runner();
const started = (x) => ({ type: "turn.started", envelope: { type: "turn.started", turn_id: x.turn_id, session_id: x.session_id, chat_id: null, thread_ts: x.thread_ts, ts: x.started_at, data: { origin: x.origin } } });

t("the page's load reads the running turns with the threads", async () => {
  const turn = { turn_id: "agy-1", session_id: "s1", thread_ts: "th", started_at: "2026-11-21T11:15:44Z", origin: "wake" };
  const backend = fakeBackend({ "GET /chat/active": { turns: [turn] } });
  const { world } = await boot(backend);
  assert.equal(backend.count("GET", "/chat/active"), 1);
  const activity = activityOf(world.state.turns, turn.session_id, null);
  assert.equal(Date.parse(activity.running.at), Date.parse(turn.started_at));
});
t("a turn from /active is the session's running turn, started when it says", () => {
  const T = createTurns();
  T.apply(started({ turn_id: "agy-1", session_id: "s1", thread_ts: "th", started_at: "2026-11-21T11:15:44Z", origin: "wake" }));
  const a = activityOf(T, "s1", null);
  assert.ok(a.running, "running");
  assert.equal(Date.parse(a.running.at), Date.parse("2026-11-21T11:15:44Z"));
});
t("its place in the stream comes from the first frame that has one; its end ends it", () => {
  const T = createTurns();
  T.apply(started({ turn_id: "agy-1", session_id: "s1", thread_ts: "th", started_at: "2026-11-21T11:15:44Z" }));
  T.apply({ type: "turn.started", envelope: { type: "turn.started", seq: 42, turn_id: "agy-1", session_id: "s1", ts: "2026-11-21T11:15:44Z", data: {} } });
  assert.equal(T.get("agy-1").seq, 42);
  T.apply({ type: "turn.finished", envelope: { type: "turn.finished", seq: 50, turn_id: "agy-1", session_id: "s1", ts: "2026-11-21T11:20:00Z", data: { status: "finished" } } });
  assert.equal(activityOf(T, "s1", null).running, null);
});
await done();
