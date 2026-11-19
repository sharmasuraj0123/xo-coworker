// What Settings › Routing says about chats is read from the routing as it is, never kept from an action (S113): driven on a DOM.
import assert from "node:assert/strict";
import { dom, settle } from "../../../tests/lib/dom.mjs";

const PAGE = `<section id="settings"><nav><button data-set="routing">Routing</button></nav><div data-page="routing"><div class="set-live"></div></div></section>`;
await dom(PAGE);
const { api } = await import("../../../core/platform/api.js");
const { createSettings } = await import("../../../js/settings.js");
let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

/** A Space with these models and chats; api answers from it, refusing each chat in patchFails once. */
async function space(models, chats, { patchFails = new Set() } = {}) {
  await dom(PAGE);
  const said = [];
  const world = {
    state: { router: null, projects: chats.map(([id, dm]) => ({ id, name: id, chatId: `c-${id}`, routing: dm ? { mode: "decision", decision_model: dm } : null })) },
    project: (id) => world.state.projects.find((p) => p.id === id),
  };
  api.router = async () => ({ mode: "agent", abstain_below: 0.5 });
  api.routerModels = async () => ({ models: models.map((m) => ({ ...m })) });
  api.disconnectRouterModel = async (id) => ({ models: models.map((m) => (m.id === id ? { ...m, connected: false } : { ...m })) });
  api.patchChat = async (id) => { if (patchFails.delete(id)) throw new Error("refused"); return { routing: null }; };
  const S = createSettings({ world, announce: (s) => said.push(s), PROJ: (id) => id, onChange: () => {} });
  S.open("routing");
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
