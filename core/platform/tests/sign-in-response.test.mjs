// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { api, request } from "../api.js";

const session_id = "fixture-login";
const claude = { type: "session", session_id };
const codex = { type: "installing", package: "@openai/codex" };
const antigravity = { type: "done", returncode: 0, ok: true };

/** @type {[import("../sign-in-types.d.ts").SignInRoute, object, object][]} */
const streams = [
  ["claude-code", claude, { ...claude, session_id: false }],
  ["codex", codex, { ...codex, package: 2 }],
  ["antigravity", antigravity, { ...antigravity, returncode: false }],
];

for (const [route, good, malformed] of streams) {
  test(`only checked ${route} events reach sign-in controls`, async ({ mock }) => {
    const reports = mock.method(console, "error", () => {});
    const frames = [good, malformed].map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join("");
    const fetches = mock.method(globalThis, "fetch", async (url, options) => {
      assert.equal(url, `connect/${route}?force=1`);
      assert.equal(options.method, "POST");
      return new Response(frames, { headers: { "Content-Type": "text/event-stream" } });
    });
    const seen = [];
    await api.signInStream(route, { signal: new AbortController().signal, force: true, on: (frame) => seen.push(frame) });
    assert.deepEqual(seen, [good]);
    assert.equal(reports.mock.callCount(), 1);
    assert.equal(reports.mock.calls[0].arguments[0].code, "bad_answer");
    await assert.rejects(request(`/connect/${route}`, { method: "POST" }), TypeError);
    assert.equal(fetches.mock.callCount(), 1);
  });
}

/** @type {[string, string, () => Promise<unknown>, object, object][]} */
const writes = [
  ["POST", "connect/claude-code/callback", () => api.signInCode("claude-code", session_id, "sample-code"),
    { ok: true, message: "Code sent to CLI", session_id }, { ok: true, message: "Code sent to CLI", session_id: null }],
  ["POST", "connect/antigravity/callback", () => api.signInCode("antigravity", session_id, "sample-code"),
    { ok: true, message: "Code sent", session_id }, { ok: "true", message: "Code sent", session_id }],
  ["DELETE", "connect/claude-code", () => api.signInCancel("claude-code"),
    { ok: true, message: "No active session", session_id: null }, { ok: true, message: "No active session", session_id: {} }],
];

for (const [method, path, call, good, bad] of writes) {
  test(`${method} /${path} rejects an invalid sign-in answer`, async ({ mock }) => {
    let reply = good;
    const fetches = mock.method(globalThis, "fetch", async (url, options) => {
      assert.equal(url, path);
      assert.equal(options.method, method);
      return Response.json(reply);
    });
    assert.deepEqual(await call(), good);
    reply = bad;
    await assert.rejects(call(), { code: "bad_answer" });
    await assert.rejects(request("/" + path, { method }), TypeError);
    assert.equal(fetches.mock.callCount(), 2);
  });
}
