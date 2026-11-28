// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { erase, read, write } from "../storage.js";

test("storage distinguishes stores, missing values, corrupt values and refusal", () => {
  const local = new Map(), session = new Map();
  const store = (entries) => ({ getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: store(local) });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: store(session) });
  assert.equal(read("key", JSON.parse, 9), 9);
  assert.deepEqual(write("key", "0"), { kept: true });
  assert.deepEqual(write("key", "false", "session"), { kept: true });
  assert.equal(read("key", JSON.parse, 9), 0);
  assert.equal(read("key", JSON.parse, 9, "session"), false);
  assert.deepEqual(write("key", "oops"), { kept: true });
  assert.equal(read("key", JSON.parse, 9), 9);
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get: () => { throw new Error("denied"); } });
  assert.deepEqual(write("key", "1"), { kept: false });
  assert.equal(read("key", JSON.parse, 9), 9);
});

test("an optional observer receives the failure while the storage return value stays the same", () => {
  const refused = new Error("test storage failure");
  const store = { getItem() { throw refused; }, setItem() { throw refused; } };
  const reports = [];
  assert.equal(read("key", JSON.parse, 9, store), 9);
  assert.deepEqual(write("key", "1", store), { kept: false });
  assert.equal(read("key", JSON.parse, 9, store, (error) => reports.push(error)), 9);
  assert.deepEqual(write("key", "1", store, (error) => reports.push(error)), { kept: false });
  assert.deepEqual(reports, [refused, refused]);
});

test("erase reports an unexpected failure and treats denied storage as an expected refusal", (t) => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const reporter = Object.getOwnPropertyDescriptor(globalThis, "reportError");
  t.after(() => {
    if (storage) Object.defineProperty(globalThis, "localStorage", storage);
    else Reflect.deleteProperty(globalThis, "localStorage");
    if (reporter) Object.defineProperty(globalThis, "reportError", reporter);
    else Reflect.deleteProperty(globalThis, "reportError");
  });
  const reports = [];
  Object.defineProperty(globalThis, "reportError", { configurable: true, value: (error) => reports.push(error) });
  const broken = new Error("broken storage");
  for (const error of [new DOMException("denied", "SecurityError"), broken]) {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw error; } });
    assert.deepEqual(erase("key"), { kept: false });
  }
  assert.deepEqual(reports, [broken]);
});
