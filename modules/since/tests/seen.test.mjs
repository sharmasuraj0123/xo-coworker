// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { createSeen } from "../model.js";

test("failed writes keep each place in memory and the next write merges both stores", () => {
  const key = "xo-seen";
  const data = new Map([[key, JSON.stringify({ home: 1, "p:external": 2 })]]);
  let refuses = true;
  const seen = createSeen({
    getItem: (name) => data.get(name) ?? null,
    setItem(name, value) {
      if (refuses) throw new Error("quota exceeded");
      data.set(name, value);
    },
  });

  seen.mark("home", 3);
  seen.mark("p:offline", 4);
  assert.equal(seen.get("home"), 3);
  assert.equal(seen.get("p:offline"), 4);
  assert.equal(data.get(key), JSON.stringify({ home: 1, "p:external": 2 }));

  data.set(key, JSON.stringify({ home: 1, "p:external": 5 }));
  refuses = false;
  seen.mark("p:recovered", 6);
  assert.deepEqual(JSON.parse(data.get(key)), { home: 3, "p:external": 5, "p:offline": 4, "p:recovered": 6 });
});
