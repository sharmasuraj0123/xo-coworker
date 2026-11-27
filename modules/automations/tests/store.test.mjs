// @ts-check

import assert from "node:assert/strict";
import { createAutomationsStore, UNDO_MS } from "../store.js";
import { fakeApi, fakeTimers, job } from "./fakes.mjs";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
let passed = 0;
/** @param {string} name @param {() => Promise<void>} fn */
const t = async (name, fn) => {
  try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e); process.exitCode = 1; }
};

/** @param {Record<string, unknown>[]} jobs */
async function setup(jobs = [job(), job({ id: "j2", name: "Nightly" })]) {
  const fake = fakeApi(jobs), timers = fakeTimers(), errors = /** @type {unknown[]} */ ([]);
  const store = createAutomationsStore({ api: fake.api, report: (e) => { errors.push(e); }, timeout: timers.timeout, now: () => 1000 });
  await store.refresh();
  return { store, timers, errors, ...fake };
}

await t("a delete waits for its undo to run out, and an undo keeps it", async () => {
  const { store, timers, calls } = await setup();
  store.removeLater("j1");
  assert.equal(store.state.deleting.get("j1"), 1000 + UNDO_MS);
  assert.equal(timers.size, 1);
  store.undoRemove("j1");
  assert.equal(timers.size, 0, "the undo cancels the timer");
  assert.equal(store.state.deleting.size, 0);
  timers.fire();
  await settle();
  assert.ok(!calls.some((c) => c.name === "deleteSchedule"), "nothing was deleted");
  assert.equal(store.state.list.length, 2);
});

await t("once the undo runs out the job is deleted for real and leaves the list", async () => {
  const { store, timers, calls } = await setup();
  store.removeLater("j1");
  timers.fire();
  await settle();
  assert.deepEqual(calls.filter((c) => c.name === "deleteSchedule").map((c) => c.args[0]), ["j1"]);
  assert.deepEqual(store.state.list.map((a) => a.id), ["j2"]);
  assert.equal(store.state.deleting.size, 0);
});

await t("a delete that fails keeps the automation and reports why", async () => {
  const { store, timers, errors, failDeletes } = await setup();
  failDeletes();
  store.removeLater("j1");
  timers.fire();
  await settle();
  assert.deepEqual(store.state.list.map((a) => a.id), ["j1", "j2"]);
  assert.equal(store.state.deleting.size, 0, "it shows again");
  assert.equal(errors.length, 1);
});

await t("closing the app deletes what was waiting for its undo", async () => {
  const { store, timers, calls } = await setup();
  store.removeLater("j2");
  store.dispose();
  await settle();
  assert.equal(timers.size, 0);
  assert.deepEqual(calls.filter((c) => c.name === "deleteSchedule").map((c) => c.args[0]), ["j2"]);
});

await t("turning one off sends its whole definition back, only enabled changed", async () => {
  const { store, calls } = await setup();
  const a = store.find("j1");
  assert.ok(a);
  await store.setOn(a, false);
  const put = calls.find((c) => c.name === "updateSchedule");
  assert.deepEqual(put?.args, ["j1", { kind: "agent", name: "Morning check", description: "Checks", chat: "chat_a", prompt: "Look",
    agent: "claude", model: "opus", effort: "high", every_seconds: 86400, first_run_at: "2026-11-20T09:00:00+00:00", enabled: false,
    persona: null, icon: null }]);
  assert.equal(store.find("j1")?.on, false);
  assert.equal(store.find("j1")?.offReason, "Turned off by you");
});

await t("a calendar job keeps its rule, without an interval or a start, and the list asks for a fortnight", async () => {
  const rule = { days: "weekdays", time: "09:00", tz: "Asia/Kolkata" };
  const { store, calls } = await setup([job({ every_seconds: null, first_run_at: null, schedule: rule, persona: { name: "triage", level: "project" },
    icon: "sunrise" })]);
  assert.deepEqual(calls.find((c) => c.name === "schedules")?.args, [14]);
  const a = store.find("j1");
  assert.ok(a);
  await store.setOn(a, false);
  const body = /** @type {Record<string, unknown>} */ (calls.find((c) => c.name === "updateSchedule")?.args[1]);
  assert.deepEqual([body.schedule, body.every_seconds, body.first_run_at], [rule, null, null]);
  assert.deepEqual([body.persona, body.icon], [{ name: "triage", level: "project" }, "sunrise"], "its agent and icon stay");
});

await t("run now shows it running from XO Space's answer", async () => {
  const { store } = await setup();
  const a = store.find("j2");
  assert.ok(a);
  await store.runNow(a);
  assert.equal(store.find("j2")?.running, true);
});

await t("a list that can't be read says so, and keeps what it had", async () => {
  const { store, api, errors } = await setup();
  Object.assign(api, { schedules: async () => { throw new Error("down"); } });
  await store.refresh();
  assert.equal(store.state.failed, true);
  assert.equal(store.state.list.length, 2);
  assert.equal(errors.length, 1);
});

console.log(`\n${passed} passed`);
