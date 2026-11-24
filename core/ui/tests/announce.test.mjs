// @ts-check

import assert from "node:assert/strict";
import { mock } from "node:test";
import { dom } from "../../../tests/lib/dom.mjs";
import { createAnnouncer } from "../a11y/announce.js";

const { document } = await dom('<div role="status">Previous update</div>');
const region = document.querySelector('[role="status"]');
const announce = createAnnouncer(region);

mock.timers.enable({ apis: ["setTimeout"] });
try {
  let current = true;
  announce("Superseded update", () => current);
  assert.equal(region.textContent, "");
  current = false;
  mock.timers.tick(40);
  assert.equal(region.textContent, "", "a stale announcement stays silent");
  announce("Current update");
  mock.timers.tick(39);
  assert.equal(region.textContent, "");
  mock.timers.tick(1);
  assert.equal(region.textContent, "Current update");
} finally {
  mock.timers.reset();
}
