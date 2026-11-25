import assert from "node:assert/strict";
import { createIntelView } from "../modules/chats/intel-view.js";
import { dom } from "./lib/dom.mjs";

const { document } = await dom("<aside></aside>");
const pop = document.querySelector("aside");
const state = { open: true, session: "project", more: true };
const picker = createIntelView(state, {
  pop, world: { state: {} }, simple: () => false, place() {}, draftChanged: () => false,
  draftOf: () => ({ model: "model", effort: "low" }),
  catalogState: {
    kindOf: () => "project", scopeWord: () => "Project", current: () => ({}), moving: () => false, running: () => null,
    runtimeChoice: () => ({ multi: true, on: "auto", list: [] }), shown: models => models,
    effortsOf: () => ["low"], modelOf: () => state.models?.[0], effortWord: () => "Low",
  },
});
picker.render();
const part = key => pop.querySelector(`[data-key="${key}"]`);
const route = part("route"), runtime = part("rts"), more = part("more");
assert.ok(part("reading") && route && runtime && more);
const control = route.querySelector("button");
control.focus();
state.models = [{ id: "model", name: "Current" }];
picker.render();
assert.ok(!part("reading") && part("models") && part("depth"));
assert.ok(part("route") === route && part("rts") === runtime && part("more") === more);
assert.ok(document.activeElement === control);
assert.ok([...pop.querySelectorAll(".iq-sec,.iq-list,.iq-moreb,.iq-depth")].every(el => el.id || el.hasAttribute("data-key")));
