// @ts-check

import assert from "node:assert/strict";
import { mock } from "node:test";
import { dom } from "../../../tests/lib/dom.mjs";
import { createAnnouncer } from "../a11y/announce.js";
import { createScope } from "../../kernel/scope.js";

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

  const scope = createScope();
  const announceInScope = createAnnouncer(region, scope);
  announceInScope("Retired update");
  assert.equal(region.textContent, "", "scoped announcements clear the old announcement synchronously");
  scope.dispose();
  mock.timers.tick(40);
  assert.equal(region.textContent, "", "disposing the owner cancels a queued announcement");
  announceInScope("Ignored update");
  mock.timers.tick(40);
  assert.equal(region.textContent, "", "the retired announcer cannot change the region");
} finally {
  mock.timers.reset();
}
