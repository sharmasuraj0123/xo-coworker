import assert from "node:assert/strict";
import { createScope } from "../../../core/kernel/scope.js";
import { deferred } from "../../../tests/lib/dom.mjs";
import { createConversationDecisionActions } from "../conversation-actions.js";

const scope = createScope();
const request = deferred();
const calls = [];
const announcements = [];
let draws = 0;
const actions = createConversationDecisionActions({
  scope, world: { act: { decideItem(id, decision) { calls.push([id, decision]); return request.promise; } } },
  announce: (text) => announcements.push(text), schedule: () => draws++,
});
const pending = actions.decideLimit("limit", "move");
assert.deepEqual(actions.limitStatus("limit"), { busy: true });
await actions.decideLimit("limit", "wait");
assert.deepEqual(calls, [["limit", { decision: "move" }]], "a pending decision cannot submit a competing choice");
scope.dispose();
request.resolve();
await pending;
assert.equal(draws, 1, "a retired decision cannot schedule a redraw");
assert.deepEqual(announcements, [], "a retired decision cannot announce after it settles");
await actions.decideLimit("another", "move");
assert.equal(calls.length, 1);
