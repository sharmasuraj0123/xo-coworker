import assert from "node:assert/strict";
import { test } from "node:test";
import { boot, fail, fakeBackend, until } from "../../../../tests/storm-harness.mjs";

test("a failed chat policy warm can retry without discarding its last good value", async (t) => {
  const endpoint = "/chat/chats/chat_p/runtime-policy";
  const read = "GET " + endpoint;
  const refusal = fail(500, { code: "policy_failure", message: "Policy storage failed." });
  const reported = [];
  t.mock.method(console, "error", (error) => reported.push(error.code));
  const backend = fakeBackend({ [read]: refusal, "GET /chat/runtime-policy": { effective: { active: "default" } } });
  const { world } = await boot(backend);
  t.after(world.dispose);
  await until(() => reported.length);
  assert.deepEqual(reported, ["policy_failure"]);
  assert.deepEqual(world.act.policyFor("demo"), { active: "default" });
  backend.routes[read] = { effective: { active: "project" } };
  await Promise.all([world.act.loadChatPolicy("chat_p"), world.act.loadChatPolicy("chat_p")]);
  assert.equal(backend.count("GET", endpoint), 2, "the successful retry is shared");
  assert.deepEqual(world.act.policyFor("demo"), { active: "project" });
  backend.routes[read] = refusal;
  await world.act.loadPolicies();
  assert.deepEqual(world.act.policyFor("demo"), { active: "project" });
  assert.deepEqual(reported, ["policy_failure", "policy_failure"]);
});
