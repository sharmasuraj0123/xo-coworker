// @ts-check
import assert from "node:assert/strict";
import { createBackSteps } from "../back-steps.js";

const S = { view: "t:thread", trail: ["p:open", "p:gone", "p:current"], retrace: false };
let layerOpen = true;
/** @type {string[]} */
const visits = [];
const { canBack, stepBack } = createBackSteps({
  S,
  LAYERS: { open: () => layerOpen, back: () => { const open = layerOpen; layerOpen = false; return open; } },
  placeOk: (view) => view === "p:open",
  back: () => { visits.push("thread back"); S.view = "p:current"; },
  go: (view) => {
    assert.equal(S.retrace, true, "a Back visit never adds a new trail entry");
    visits.push(view);
    S.view = view;
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
assert.equal(S.retrace, false);
assert.equal(stepBack(), true);
assert.deepEqual(visits, ["thread back", "p:open", "home"]);
assert.equal(canBack(), false);
assert.equal(stepBack(), false);
