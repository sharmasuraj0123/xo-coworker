// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { createLru } from "../cache.js";

test("cache evicts the least recently used key and reports it after removal", () => {
  const evicted = [];
  const cache = createLru({ max: 2, onEvict: (value, key) => {
    assert.equal(cache.has(key), false);
    evicted.push([key, value]);
  } });
  cache.set("a", undefined);
  cache.set("b", 2);
  cache.get("a");
  cache.set("c", 3);
  cache.set("a", 1);
  cache.set("d", 4);
  assert.deepEqual(evicted, [["b", 2], ["c", 3]]);
  assert.equal(cache.size, 2);
  assert.equal(cache.get("a"), 1);
  assert.equal(cache.delete("d"), true);
  cache.clear();
  assert.equal(cache.size, 0);
});
