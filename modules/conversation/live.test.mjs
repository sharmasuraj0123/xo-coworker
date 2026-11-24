import assert from "node:assert/strict";
import { createLiveConversation } from "./live.js";

const calls = [];
const S = { view: "home" };
const thread = { id: "thread-1", project: "demo", loaded: false, messages: [{ seq: null }, { seq: 16 }] };
const world = {
  state: { hist: { workspace: { loading: true } }, timeline: {}, threadHist: {}, found: {} },
  act: Object.fromEntries(["watch", "watchThread", "watchSession", "loadHops", "loadChatHops", "findRows"]
    .map((name) => [name, (...args) => { calls.push([name, ...args]); }])),
};
const live = createLiveConversation({
  S, world,
  CH: { isChats: (view) => view.startsWith("c:"), open: (view) => calls.push(["open", view]) },
  convThread: (view) => view === "t:thread-1" ? thread : null,
  chatOf: (view) => view === "home" ? "workspace" : "demo",
});

live.follow();
assert.deepEqual(calls.splice(0), [
  ["watchSession", null], ["loadChatHops", "workspace"], ["watch", ["workspace"]], ["watchThread", null],
]);
assert.equal(live.liveReady("home"), false);
world.state.timeline.workspace = [{ id: "already-visible" }];
assert.equal(live.liveReady("home"), true);

S.view = "c:session-1";
live.follow();
assert.deepEqual(calls.splice(0), [
  ["watch", []], ["watchThread", null], ["watchSession", "session-1"], ["open", "c:session-1"],
]);

S.view = "t:thread-1";
live.follow();
assert.deepEqual(calls.splice(0), [
  ["watchSession", null], ["loadHops", "thread-1"], ["watch", ["demo"]], ["watchThread", "thread-1"],
]);
assert.equal(live.liveReady(S.view), false);
thread.loaded = true;
assert.equal(live.liveReady(S.view), true);
world.state.threadHist["thread-1"] = { loaded: true, all: false };
live.ensureRoot();
assert.deepEqual(calls, []);
world.state.threadHist["thread-1"].all = true;
live.ensureRoot();
assert.deepEqual(calls.splice(0), [["findRows", "demo", ["thread-1"], 16]]);
world.state.found.demo = new Set(["thread-1"]);
live.ensureRoot();
assert.deepEqual(calls, []);
