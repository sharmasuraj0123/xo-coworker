// @ts-check
import assert from "node:assert/strict";
import { createThreadRuntime } from "../thread.js";

const now = Date.now;
Date.now = () => Date.parse("2026-11-23T16:00:00Z");
try {
  const codex = { name: "codex", health: { limit: "closed" }, features: { features: { send_while_running: { behaviour: "steered" } } } };
  const world = { state: { sessions: { session: { agent: "codex" } }, runtimes: [codex] }, act: {} };
  const { rtTag, sendWhileRunning, threadMark } = createThreadRuntime({ world, SHAPE: { on: () => false }, isHeld: (thread) => !!thread.held });
  const thread = { project: "project", sessionId: "session", held: { for: "limit", until: "2026-11-23T16:20:00Z" } };
  assert.match(rtTag(thread), /Your agent reached its usage limit.*Usage limit · starts/);
  assert.equal(rtTag(thread, "ar"), "");
  assert.equal(threadMark(thread), "");
  assert.equal(sendWhileRunning(thread), "steered");
  world.state.runtimes.push({ ...codex, name: "claude_code" });
  assert.match(rtTag(thread), /Codex reached its usage limit.*Codex limit · starts/);
  assert.match(threadMark(thread), /aria-label="Codex"/);
  assert.match(rtTag({ ...thread, held: { for: "memory" } }), /tw-rt is-warn.*At its limit/);
} finally {
  Date.now = now;
}
