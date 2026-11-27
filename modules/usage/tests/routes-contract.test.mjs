// The Usage page's route is xo-space's, and its reader keeps what it can read of an answer.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { usageApi } from "../../../core/platform/usage-response.js";

const snapshot = JSON.parse(readFileSync(new URL("../../../core/platform/tests/fixtures/openapi-routes.json", import.meta.url), "utf8"));
const tokens = { input: 1, output: 2, reasoning: 0, cache_read: 3, cache_write: 4 };
let answer = {};
const asked = [];
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input), "https://space.invalid");
  asked.push([url.pathname.replace("/claude_code/", "/{name}/"), init?.method || "GET", url.searchParams.get("days")]);
  return Response.json(answer);
};

answer = {
  total_cost: 0, total_tokens: tokens, total_sessions: 1, total_messages: 2,
  daily: [{ date: "2026-11-27", cost: 0, tokens: 3, messages: 2, total_tokens: tokens }],
  by_model: [{ model_id: "claude-opus-5-5", provider_id: "anthropic", total_cost: 0, total_tokens: tokens, message_count: 2 },
    { provider: "google", model: "Gemini", total_tokens: 7 }],
  by_session: [], response_time: {},
};
const usage = await usageApi.runtime("claude_code", 30);
assert.deepEqual(asked, [["/api/chat/runtimes/{name}/usage", "GET", "30"]]);
for (const [path, method] of asked) assert.ok(snapshot.paths[path]?.includes(method), `${method} ${path} must be in OpenAPI`);
assert.equal(usage.by_model.length, 1, "a model row it can't read costs only itself");
assert.equal(usage.by_model[0].model_id, "claude-opus-5-5");
assert.equal(usage.daily[0].total_tokens?.cache_read, 3, "a day's split of its tokens comes through");

answer = { total_cost: 0, total_tokens: tokens, daily: [{ date: "2026-11-27" }], by_model: [] };
await assert.rejects(usageApi.runtime("claude_code", 30), /unexpected answer/, "a day without its tokens is not an answer");
answer = { total_cost: 0, total_tokens: tokens, daily: [{ date: "2026-11-27", tokens: 3, total_tokens: { input: 1 } }], by_model: [] };
await assert.rejects(usageApi.runtime("claude_code", 30), /unexpected answer/, "a day whose split is broken is not an answer");
console.log("usage routes: passed");
