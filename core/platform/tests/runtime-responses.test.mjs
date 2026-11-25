import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { api, request } from "../api.js";

const samples = JSON.parse(readFileSync(new URL("./fixtures/runtime-api.json", import.meta.url), "utf8"));
const projectPolicy = { ...samples.policy, project: null };
const routes = [
  ["GET", "/chat/runtimes", () => api.runtimes(), samples.runtimes, { runtimes: [{ name: "x", health: { installed: "yes" } }] }],
  ["GET", "/chat/runtimes/codex/models", () => api.models("codex"), samples.models, { models: [{ name: "missing id" }] }],
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
    await assert.rejects(request(path + "?probe=1", { method }), TypeError);
    assert.equal(mock.mock.callCount(), 2);
  });
}
