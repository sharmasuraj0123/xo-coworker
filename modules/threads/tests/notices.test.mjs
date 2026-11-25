// @ts-check

import assert from "node:assert/strict";
import { threadNotices } from "../notices.js";

const item = { id: "thread", title: "Check tests", state: "working" };
const seen = [], waitSince = new Map();
const notice = threadNotices({
  find: (id) => id === item.id ? item : undefined,
  projectName: () => "Demo",
  movedHere: () => localMove,
  show: (message, duration) => seen.push([message, duration]),
  waitSince,
});
let localMove = true;
const event = (kind, fields = {}) => ({ kind, thread: "thread", project: "demo", ...fields });
notice(event("ask", { project: "workspace" }));
const first = waitSince.get(item.id);
assert.ok(first > 0);
notice(event("ask"));
assert.equal(waitSince.get(item.id), first);
notice(event("resumed"));
assert.equal(waitSince.has(item.id), false);

notice(event("moved", { to: "next" }));
assert.deepEqual(seen, [], "the local move already announced its destination");
localMove = false;
notice(event("moved", { to: "next" }));
notice(event("done", { project: "workspace" }));
notice(event("done"));
item.state = "failed";
notice(event("state"));
assert.deepEqual(seen, [
  [{ kind: "done", text: "Check tests continues on The agent", sub: "Demo", open: "t:next" }, 5200],
  [{ kind: "done", text: "Check tests finished", sub: "Demo", open: "t:thread" }, 5200],
  [{ kind: "stopped", text: "Check tests stopped", sub: "Demo", open: "t:thread" }, 5200],
]);
