// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { read, write } from "../storage.js";

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
