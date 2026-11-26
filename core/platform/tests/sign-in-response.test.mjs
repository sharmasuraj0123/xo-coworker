// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { api } from "../api.js";

const session_id = "fixture-login";
const claude = { type: "session", session_id };
const codex = { type: "stdout", line: "Enter ABCD-EFGH at https://auth.openai.com/device" };
const antigravity = { type: "done", returncode: 0, ok: true };

/** @type {[string, object, object][]} */
const streams = [
  ["claude_code", claude, { ...claude, session_id: false }],
  ["codex", codex, { ...codex, line: 2 }],
  ["antigravity", antigravity, { ...antigravity, returncode: false }],
];

for (const [route, good, malformed] of streams) {
  test(`only checked ${route} events reach sign-in controls`, async ({ mock }) => {
    const reports = mock.method(console, "error", () => {});
    const frames = [good, malformed].map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join("");
    const fetches = mock.method(globalThis, "fetch", async (url, options) => {
      assert.equal(url, `api/chat/runtimes/${route}/sign-in`);
      assert.equal(options.method, "POST");
      return new Response(frames, { headers: { "Content-Type": "text/event-stream" } });
    });
    const seen = [];
    await api.signInStream(route, { signal: new AbortController().signal, on: (frame) => seen.push(frame) });
    assert.deepEqual(seen, [good]);
    assert.equal(reports.mock.callCount(), 1);
    assert.equal(reports.mock.calls[0].arguments[0].code, "bad_answer");
    assert.equal(fetches.mock.callCount(), 1);
  });
}

/** @type {[string, string, () => Promise<unknown>, object, object][]} */
const writes = [
  ["POST", "api/chat/runtimes/claude_code/sign-in/callback", () => api.signInCode("claude_code", session_id, "sample-code"),
    { ok: true, message: "Code sent to CLI", session_id }, { ok: true, message: "Code sent to CLI", session_id: null }],
  ["POST", "api/chat/runtimes/antigravity/sign-in/callback", () => api.signInCode("antigravity", session_id, "sample-code"),
    { ok: true, message: "Code sent", session_id }, { ok: "true", message: "Code sent", session_id }],
  ["DELETE", "api/chat/runtimes/claude_code/sign-in", () => api.signInCancel("claude_code"),
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
    assert.equal(fetches.mock.callCount(), 2);
  });
}
