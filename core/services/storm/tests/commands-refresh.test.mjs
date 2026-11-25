import assert from "node:assert/strict";
import { test } from "node:test";
import { createScope } from "../../../kernel/scope.js";
import { ApiError } from "../../../platform/http.js";
import { createCommands } from "../commands.js";

const failure = (status, code) => Response.json({ detail: { code, message: code } }, { status });

test("a policy refresh keeps failed projects and reports unexpected errors once", async (t) => {
  const retained = { effective: { default: "codex" } };
  const updated = { effective: { default: "claude" } };
  const state = { chatPolicy: { missing: retained, failed: retained, current: retained } };
  const reported = [];
  t.mock.method(console, "error", (error) => reported.push(error));
  t.mock.method(globalThis, "fetch", async (route) => {
    switch (String(route)) {
      case "api/chat/runtime-policy": return Response.json(updated);
      case "api/chat/chats/missing/runtime-policy": return failure(404, "http_404");
      case "api/chat/chats/failed/runtime-policy": return failure(500, "refresh_failed");
      case "api/chat/chats/current/runtime-policy": return Response.json(updated);
      default: throw new Error(`Unexpected fixture route ${route}`);
    }
  });
  const commands = createCommands({ state, scope: createScope(), emit() {} });
  assert.deepEqual(await commands.setPolicy(null, updated.effective), updated);
  assert.deepEqual(state.chatPolicy, { missing: retained, failed: retained, current: updated });
  assert.deepEqual(reported.map(({ code }) => code), ["refresh_failed"], "only unexpected policy refresh failures are reported");
});

test("decision failure keeps its receipt while refreshing the review", async (t) => {
  const review = new Map([["missing", { state: "open" }], ["failed", { state: "open" }]]);
  const state = { review };
  const reported = [];
  t.mock.method(console, "error", (error) => reported.push(error));
  t.mock.method(globalThis, "fetch", async (route) => {
    switch (String(route)) {
      case "api/chat/review/missing/decision": return failure(404, "review_not_found");
      case "api/chat/review/missing": return failure(404, "review_not_found");
      case "api/chat/review/failed/decision": return failure(409, "write_conflict");
      case "api/chat/review/failed": return failure(500, "refresh_failed");
      default: throw new Error(`Unexpected fixture route ${route}`);
    }
  });
  const commands = createCommands({ state, scope: createScope(), soon() {} });
  await assert.rejects(commands.decideItem("missing", {}), {
    code: "review_not_found", item: null, gone: "review_not_found",
  });
  assert.equal(review.has("missing"), false);
  await assert.rejects(commands.decideItem("failed", {}), { code: "write_conflict", item: null });
  assert.deepEqual(review.get("failed"), { state: "open" });
  assert.ok(reported.every((error) => error instanceof ApiError));
  assert.deepEqual(reported.map(({ code }) => code), ["refresh_failed"], "only unexpected review refresh failures are reported");
});
