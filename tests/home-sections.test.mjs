// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { createKernel } from "../core/kernel/index.js";
import { createScope } from "../core/kernel/scope.js";
import { definePlaces } from "../shell/places.js";
import { createHomeSections } from "../modules/home/sections.js";
import { sinceSection } from "../modules/since/section.js";
import { madeSection } from "../modules/artifacts/section.js";
import { dom } from "./lib/dom.mjs";

async function setup(markup) {
  const { document } = await dom(`<main id="home">${markup}</main>`);
  const kernel = createKernel();
  const scope = createScope();
  definePlaces(kernel);
  const calls = [];
  const rec = {
    homeSinceLines: (needs) => { calls.push("since"); return `<p>${needs.length} moved</p>`; },
    homeMade: (box) => { calls.push("made"); box.innerHTML = "<p>Made</p>"; },
  };
  kernel.places.contribute("home.section", sinceSection(rec), "xo.since");
  kernel.places.contribute("home.section", madeSection(rec), "xo.artifacts");
  const main = document.getElementById("home");
  const draw = createHomeSections(kernel.places, scope, () => {});
  const patch = (el, html) => { el.innerHTML = html; return true; };
  return { calls, main, draw, patch, dispose: scope.dispose };
}

test("Home draws Since then Recently made regardless of markup order", async (t) => {
  const { calls, main, draw, patch, dispose } = await setup('<div id="hm-made"></div><div id="hm-next"></div><div id="hm-since"></div>');
  t.after(dispose);
  draw(main, { needs: [1, 2], patch });
  assert.deepEqual(calls, ["since", "made"]);
  assert.equal(main.querySelector("#hm-since").innerHTML, "<p>2 moved</p>");
  assert.equal(main.querySelector("#hm-made").innerHTML, "<p>Made</p>");
});

test("Home skips a section without a host and draws nothing without the Home body", async (t) => {
  const { calls, main, draw, patch, dispose } = await setup('<div id="hm-since"></div>');
  t.after(dispose);
  draw(main, { needs: [], patch });
  assert.deepEqual(calls, ["since"]);
  draw(null, { needs: [], patch });
  assert.deepEqual(calls, ["since"]);
});
