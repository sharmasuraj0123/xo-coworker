import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { api } from "../api.js";

const samples = JSON.parse(readFileSync(new URL("./fixtures/runtime-api.json", import.meta.url), "utf8"));
const projectPolicy = { ...samples.policy, project: null };
const unavailableRuntime = {
  name: "unavailable", default: false, cli: null, health: {
    installed: false, logged_in: false, usable: false, account: null, cli_version: null, pool: null,
    limit: null, resets_at: null, windows: {}, error: { code: "not_installed", message: "CLI missing" },
  },
};
const checkingRuntime = {
  name: "cursor", default: false, cli: null, error: { code: "slow", message: "Still checking." },
  lifecycle: { name: "cursor", state: "checking", installed: true, signed_in: null, actions: ["install", "update", "sign_in"] },
};
const nullableModel = {
  id: "catalog-id", name: null, description: null, family: null, family_default: false, efforts: [],
  default_effort: null, context_window: null, is_default: false, takes_effort: true,
};
const routes = [
  ["GET", "/chat/runtimes", () => api.runtimes(),
    { runtimes: [...samples.runtimes.runtimes, unavailableRuntime, checkingRuntime] }, { runtimes: [{ name: "x", health: { installed: "yes" } }] }],
  ["GET", "/chat/runtimes/codex/models", () => api.models("codex"),
    { models: [...samples.models.models, nullableModel] }, { models: [{ ...nullableModel, description: {} }] }],
  ["GET", "/chat/runtime-policy", () => api.runtimePolicy(), samples.policy, {}],
  ["PUT", "/chat/runtime-policy", () => api.setRuntimePolicy({}), samples.policy, { effective: { fallback: [] } }],
  ["GET", "/chat/chats/demo/runtime-policy", () => api.chatRuntimePolicy("demo"), projectPolicy, { effective: null }],
  ["PUT", "/chat/chats/demo/runtime-policy", () => api.setChatRuntimePolicy("demo", {}), projectPolicy, { effective: { allowed: 1 } }],
  ["GET", "/chat/router", () => api.router(), samples.router, { abstain_below: "0.5" }],
  ["PUT", "/chat/router", () => api.setRouter({}), samples.router, { mode: 2 }],
  ["GET", "/chat/router/models", () => api.routerModels(), samples.routerModels, { models: [{ id: "x", connected: true }] }],
  ["POST", "/chat/router/models", () => api.connectRouterModel({}), samples.routerModels, { models: false }],
  ["DELETE", "/chat/router/models/example", () => api.disconnectRouterModel("example"), samples.routerModels, { models: null }],
];

for (const [method, path, read, sample, bad] of routes) {
  await test(`${method} ${path} checks its published response`, async (t) => {
    let body = sample;
    const mock = t.mock.method(globalThis, "fetch", async (url, init) => {
      assert.equal(url, "api" + path);
      assert.equal(init.method, method);
      return Response.json(body);
    });
    assert.deepEqual(await read(), sample);
    body = bad;
    await assert.rejects(read, { code: "bad_answer" });
    assert.equal(mock.mock.callCount(), 2);
  });
}
