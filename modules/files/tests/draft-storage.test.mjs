// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { dropDraft, getDraft, putDraft } from "../drafts.js";

test("drafts retain fallback behavior and report unexpected storage failures", ({ mock }) => {
  const reports = mock.method(console, "error", () => {});
  const key = "project|file.md";
  const unavailable = new DOMException("Storage is unavailable", "SecurityError");
  const broken = new Error("Storage adapter failed");
  const store = { getItem: () => "{", setItem() {}, removeItem() {} };
  assert.equal(getDraft(store, key), null);
  assert.equal(getDraft({ ...store, getItem() { throw unavailable; } }, key), null);
  assert.equal(reports.mock.callCount(), 0);
  assert.equal(getDraft({ ...store, getItem() { throw broken; } }, key), null);
  assert.equal(putDraft({ ...store, setItem() { throw broken; } }, key, { text: "next", base: "first" }), false);
  dropDraft({ ...store, removeItem() { throw broken; } }, key);
  assert.deepEqual(reports.mock.calls.map(({ arguments: args }) => args[0]), [broken, broken, broken]);
});
