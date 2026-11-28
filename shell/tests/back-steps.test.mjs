// @ts-check
import assert from "node:assert/strict";
import { createBackSteps } from "../back-steps.js";
import { createNavigationState } from "../navigation-state.js";

const location = createNavigationState("p:open");
for (const view of ["p:gone", "p:current", "p:nearby", "t:thread"]) location.visit(view, {});
let layerOpen = true;
/** @type {string[]} */
const visits = [];
const { canBack, stepBack } = createBackSteps({
  location,
  LAYERS: { open: () => layerOpen, back: () => { const open = layerOpen; layerOpen = false; return open; } },
  placeOk: (view) => view === "p:open",
  back: () => { visits.push("thread back"); location.visit("p:current", { remember: false }); },
  go: (view, options) => {
    assert.equal(options.remember, false, "a Back visit never adds a new trail entry");
    visits.push(view);
    location.visit(view, options);
  },
});

assert.equal(canBack(), true);
assert.equal(stepBack(), true);
assert.equal(layerOpen, false);
assert.deepEqual(visits, [], "Back closes the open layer before leaving a thread");
assert.equal(stepBack(), true);
assert.deepEqual(visits, ["thread back"]);
assert.equal(stepBack(), true);
assert.deepEqual(visits, ["thread back", "p:open"], "Back skips the current and unavailable places");
assert.equal(stepBack(), true);
assert.deepEqual(visits, ["thread back", "p:open", "home"]);
assert.equal(canBack(), false);
assert.equal(stepBack(), false);

const seen = createNavigationState("p:a");
for (const view of ["p:b", "t:x", "automations"]) seen.visit(view, {});
assert.deepEqual(seen.recent(), ["automations", "t:x", "p:a"], "where the owner is, then where they were, newest first");
