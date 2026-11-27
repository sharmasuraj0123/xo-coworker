// @ts-check

import assert from "node:assert/strict";
import test from "node:test";
import { keepZone } from "../zone.js";

/** @param {string} server */
function fake(server) {
  /** @type {string[]} */
  const calls = [];
  const api = {
    scheduleZone: async () => { calls.push("get"); return { tz: server }; },
    /** @param {string} tz */
    setScheduleZone: async (tz) => { calls.push(`put ${tz}`); server = tz; return { tz }; },
  };
  return { api, calls };
}

test("the browser's zone is saved when XO Space has another, once", async () => {
  const { api, calls } = fake("UTC");
  let zone = "Asia/Kolkata";
  const sync = keepZone({ api, zone: () => zone, report: assert.fail });
  await sync();
  await sync();
  assert.deepEqual(calls, ["get", "put Asia/Kolkata"]);
  zone = "Europe/London";
  await sync();
  assert.deepEqual(calls.slice(2), ["get", "put Europe/London"], "a move to another zone is saved too");
});

test("the same zone isn't written again", async () => {
  const { api, calls } = fake("Asia/Kolkata");
  await keepZone({ api, zone: () => "Asia/Kolkata", report: assert.fail })();
  assert.deepEqual(calls, ["get"]);
});

test("a failed read is reported and tried again next time", async () => {
  /** @type {unknown[]} */
  const errors = [];
  let fail = true;
  const api = { scheduleZone: async () => { if (fail) throw new Error("down"); return { tz: "UTC" }; }, setScheduleZone: async (/** @type {string} */ tz) => ({ tz }) };
  const sync = keepZone({ api, zone: () => "UTC", report: (e) => { errors.push(e); } });
  await sync();
  assert.equal(errors.length, 1);
  fail = false;
  await sync();
  assert.equal(errors.length, 1);
});
