// @ts-check

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** @import { Case, Seed } from "../lib/types.d.ts" */

const basic = /** @type {Seed} */ (JSON.parse(readFileSync(new URL("../seeds/basic.json", import.meta.url), "utf8")));

/** @typedef {{url(): string, request(): {method(): string}}} StopResponse */

const session = (/** @type {string} */ id, /** @type {number} */ seq, extra = {}) => ({
  id, seq, chat_id: "chat_demo", role: "project-coordinator", agent: "claude_code", state: "warm", retired_at: null, ...extra,
});
const sessions = [
  session("old", 1, { state: "queued", retired_at: basic.now }), session("stale", 2), session("current", 3),
  session("ws-old", 4, { chat_id: "chat_ws", role: "workspace-coordinator", state: "running", retired_at: basic.now }),
  session("ws-current", 5, { chat_id: "chat_ws", role: "workspace-coordinator" }),
];
const seed = { ...basic, routes: { ...basic.routes,
  "GET /api/chat/sessions": { sessions, next_after_seq: null }, "POST /api/chat/abort": { stopped: true },
} };

/** @type {Omit<Case, 'file'>[]} */
export const cases = [{ name: "coordinator replacement, Stop and retirement", seed, async run(t) {
  await t.open();
  const row = t.page.locator('#projects [data-go="p:demo"]');
  const send = t.page.locator("#send");
  await t.page.locator("#nv-chats").click();
  await t.page.locator('#msgs .chl-row[data-go="ws"]').click();
  await t.settle();
  assert.equal(await send.getAttribute("title"), "Send (Enter)");
  await row.click();
  await t.settle();
  const idle = async () => {
    assert.doesNotMatch(await row.innerText(), /working/i);
    assert.doesNotMatch((await row.getAttribute("class")) ?? "", /\bbusy\b/);
    assert.equal(await send.getAttribute("title"), "Send (Enter)");
  };
  await idle();
  t.space.push("session", { status: "running" }, { session_id: "stale", chat_id: "chat_demo" });
  await t.settle();
  await idle();
  t.space.push("session", { status: "running" }, { session_id: "current", chat_id: "chat_demo" });
  await t.page.locator('#send[title="Stop the coordinator"]').waitFor();
  assert.match(await row.innerText(), /Coordinator working/);
  assert.match((await row.getAttribute("class")) ?? "", /\bbusy\b/);
  const stopped = t.page.waitForResponse((/** @type {StopResponse} */ response) => response.request().method() === "POST"
    && new URL(response.url()).pathname === "/api/chat/abort");
  const [, response] = await Promise.all([send.click(), stopped]);
  assert.equal(response.ok(), true);
  await t.settle();
  const aborts = t.store.writes.filter((write) => write.method === "POST" && write.path === "/api/chat/abort");
  assert.deepEqual(aborts.map((write) => write.body), [{ session_id: "current" }]);
  t.space.push("session", { status: "cold", reason: "retired" }, { session_id: "stale", chat_id: "chat_demo" });
  t.space.push("session", { status: "queued", reason: "retired" }, { session_id: "current", chat_id: "chat_demo" });
  await t.page.locator('#send[title="Send (Enter)"]').waitFor();
  await idle();
} }];
