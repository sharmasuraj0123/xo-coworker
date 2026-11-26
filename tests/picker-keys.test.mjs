import assert from "node:assert/strict";
import { createIntelView } from "../modules/chats/intel-view.js";
import { dom } from "./lib/dom.mjs";

const { document } = await dom("<aside></aside>");
const pop = document.querySelector("aside");
const state = { open: true, session: "project", page: "root" };
const picker = createIntelView(state, {
  pop, world: { state: {} }, simple: () => false, place() {}, draftChanged: () => false,
  draftOf: () => ({ model: "model", effort: "low" }),
  catalogState: {
    kindOf: () => "project", scopeWord: () => "Project", current: () => ({}), moving: () => false, running: () => null,
    runtimeChoice: () => ({ multi: true, on: "auto", list: [] }), shown: models => models, runtimeOf: () => null,
    effortsOf: () => ["low"], modelOf: () => state.models?.[0], effortWord: () => "Low", nameOf: () => "Current",
  },
});
picker.render();
const part = key => pop.querySelector(`[data-key="${key}"]`);
const items = part("items"), project = part("proj");
assert.ok(items && project && pop.querySelector('[data-lpage="rt"]'));
const control = pop.querySelector('[data-lpage="rt"]');
control.focus();
state.models = [{ id: "model", name: "Current" }];
picker.render();
assert.ok(part("items") === items && part("proj") === project, "the rows survive the models arriving");
assert.ok(pop.querySelector('[data-lpage="think"]'), "a model that thinks gets its Thinking row");
assert.ok(document.activeElement === control);
state.page = "model";
picker.render();
assert.ok(part("opts-model") && !part("items"), "a page replaces the rows");
assert.ok([...pop.querySelectorAll(".iq-sec,.iq-items,.iq-opts,.iq-depth")].every(el => el.id || el.hasAttribute("data-key")));
