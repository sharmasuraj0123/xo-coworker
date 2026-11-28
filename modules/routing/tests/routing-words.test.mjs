// Routing describes the models that chats currently name.
import assert from "node:assert/strict";
import { settle } from "../../../tests/lib/dom.mjs";
import { openSettingsModule } from "../../../tests/lib/settings-page.mjs";
import { routingModule } from "../module.js";

const { api } = await import("../../../core/platform/api.js");
let passed = 0;
let dispose;
const t = async (name, fn) => {
  try { await fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
  finally { await dispose?.(); dispose = null; }
};

/** A Space with these models and chats; api answers from it, refusing each chat in patchFails once. */
async function space(models, chats, { patchFails = new Set() } = {}) {
  const said = [];
  const world = {
    state: { router: null, projects: chats.map(([id, dm]) => ({ id, name: id, chatId: `c-${id}`, routing: dm ? { mode: "decision", decision_model: dm } : null })) },
    project: (id) => world.state.projects.find((p) => p.id === id),
  };
  api.router = async () => ({ mode: "agent", abstain_below: 0.5 });
  api.routerModels = async () => ({ models: models.map((m) => ({ ...m })) });
  api.disconnectRouterModel = async (id) => ({ models: models.map((m) => (m.id === id ? { ...m, connected: false } : { ...m })) });
  api.patchChat = async (id) => { if (patchFails.delete(id)) throw new Error("refused"); return { routing: null }; };
  dispose = await openSettingsModule("routing", routingModule, { world, announce: (s) => said.push(s), projectName: (id) => id });
  await settle();
  return { world, said };
}
const live = () => document.querySelector('[data-page="routing"] .set-live');
const orphans = () => [...live().querySelectorAll("[data-orphans]")].map((p) => p.textContent);
const press = async (sel) => { const b = live().querySelector(sel); assert.ok(b, sel); b.dispatchEvent(new Event("click", { bubbles: true })); await settle(); };
const SAGE = { id: "sage", label: "Levanto Sage", connected: false, model: "s1" };

await t("the page says, per model, which chats name a model that isn't connected, in the page's own words", async () => {
  await space([SAGE], [["demo", "sage"], ["docs", "sage"]]);
  assert.deepEqual(orphans(), ["Levanto Sage isn't connected, and demo and docs still name it: use the Space's routing for them below."]);
});

await t("a chat routed by a connected model is fine: no words about it", async () => {
  await space([SAGE, { id: "x", label: "Model X", connected: true, model: "m" }], [["demo", "x"], ["docs", "sage"]]);
  assert.deepEqual(orphans(), ["Levanto Sage isn't connected, and docs still names it: use the Space's routing for it below."]);
});

await t("the words follow the routing as it is: one chat back on the Space's, then none", async () => {
  await space([SAGE], [["demo", "sage"], ["docs", "sage"]]);
  await press('[data-ov-clear="c-demo"]');
  assert.deepEqual(orphans(), ["Levanto Sage isn't connected, and docs still names it: use the Space's routing for it below."]);
  await press('[data-ov-clear="c-docs"]');
  assert.deepEqual(orphans(), [], "the last one back: the words go, whichever way that happened");
});

await t("Disconnect says once, aloud, which chats still name it; the page's words come from their routing and leave with it", async () => {
  const { said } = await space([{ id: "x", label: "Model X", connected: true, model: "m" }], [["demo", "x"], ["docs", "x"]], { patchFails: new Set(["c-demo"]) });
  await press('[data-dm-off="x"]');
  await press('[data-dm-yes="x"]');
  assert.equal(said.at(-1), "Disconnected. Its key is removed. demo still names it: use the Space's routing for it.");
  assert.deepEqual(orphans(), ["Model X isn't connected, and demo still names it: use the Space's routing for it below."]);
  await press('[data-ov-clear="c-demo"]');
  assert.deepEqual(orphans(), []);
  assert.equal(live().querySelectorAll(".set-err").length, 0, "no words outlive the routing they were about (S113)");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
process.exit();
