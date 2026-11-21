// A Working row in the panel's Threads has its time before its thread is opened: the turns already running when the
// page loads come from /chat/active (they had no start until a click read the thread's frames).
//   node tests/active-turns.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const { createTurns } = await import("../js/blocks.js");
const { activityOf } = await import("../js/map.js");

const storm = readFileSync(new URL("../js/storm.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const started = (x) => ({ type: "turn.started", envelope: { type: "turn.started", turn_id: x.turn_id, session_id: x.session_id, chat_id: null, thread_ts: x.thread_ts, ts: x.started_at, data: { origin: x.origin } } });

t("the page's load reads the running turns with the threads", () => {
  assert.match(storm, /await Promise\.all\(\[loadAll\(\), loadStatus\(\), loadActive\(\)\]\);/);
  assert.match(storm, /const \{ turns \} = await api\.active\(\);/);
  assert.match(storm, /!state\.turns\.get\(x\.turn_id\)\) state\.turns\.apply\(\{ type: "turn\.started"/, "a turn the stream already gave is left alone");
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
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
