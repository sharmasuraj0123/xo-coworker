// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { installSessions } from "../selectors/sessions.js";

const runtimes = [
  { name: "claude_code", default: true, cli: { logged_in: true, account: "a" }, health: { pool: "claude_code:a" } },
  { name: "codex", cli: { logged_in: true, account: "b" }, health: { pool: "codex:b" } },
];
const sessions = {
  thr: { id: "thr", agent: "codex", pool: "codex:b" },
  co: { id: "co", chat_id: "chat_x", role: "project-coordinator", agent: "codex", seq: 2 },
};
const projects = [{ id: "x", chatId: "chat_x" }, { id: "y", chatId: "chat_y" }];
const state = { runtimes, sessions, projects, chatPolicy: { chat_y: { effective: { default: "codex" } } }, policy: null };
const ctx = /** @type {import("../types").Ctx} */ (/** @type {unknown} */ ({ state, chatProject: new Map(), watched: {} }));
installSessions(ctx);

test("the pool a message runs in: its thread's, its project's coordinator's or default runtime's, else the main runtime's", () => {
  assert.equal(ctx.poolOf({ sessionId: "thr" }), "codex:b");
  assert.equal(ctx.poolOf({ project: "x" }), "codex:b");
  assert.equal(ctx.poolOf({ project: "y" }), "codex:b");
  assert.equal(ctx.poolOf({ sessionId: null }), "claude_code:a");
});
