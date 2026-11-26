// "Saved" means XO holds what the field shows: Settings › Runtimes driven on a DOM, its saves answered when the test says.
import assert from "node:assert/strict";
import { createScope } from "../../../core/kernel/scope.js";
import { receipts } from "../receipts.js";
import { dom, settle, deferred } from "../../../tests/lib/dom.mjs";

const PAGE = `<section id="settings"><div data-page="runtimes"><div class="set-live"></div></div></section>`;
await dom(PAGE);
const RT = await import("../settings.js");
let passed = 0;
const scope = createScope();
const { createLifecycle } = await import("../lifecycle.js");
const { api } = await import("../../../core/platform/api.js");
const life = createLifecycle({ api, refresh() {}, announce() {}, scope });
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };

await t("a receipt says Saved only beside what XO took", () => {
  const R = receipts(scope, 60_000, () => {});
  R.set("preferences", "Preference A");
  assert.equal(R.says("preferences", "Preference A"), true, "the field shows what XO holds");
  assert.equal(R.says("preferences", "Preference B"), false, "a newer draft is not what XO holds");
  assert.equal(R.says("default", "Preference A"), false, "another field");
  R.set("allowed", ["codex", "claude_code"]);
  assert.equal(R.says("allowed", ["codex", "claude_code"]), true, "a list, by its value");
  assert.equal(R.says("allowed", ["codex"]), false);
  R.set("preferences", null);
  assert.equal(R.says("preferences", null), true, "cleared: Saved beside the empty field");
});

/** A Space whose policy saves wait until the test answers them, as storm's setPolicy stores the server's answer. */
async function space() {
  await dom(PAGE);
  /** @type {{ next: import("../../../core/services/runtime-types").RuntimePolicy, d: ReturnType<typeof deferred> }[]} */
  const saves = [];
  const world = {
    state: { runtimes: [{ name: "claude_code", health: {} }, { name: "codex", health: {} }], policy: { space: { allowed: null, default: null, preferences: null, fallback: false } }, paidOk: false },
    act: {
      setPolicy: (/** @type {null} */ _chat, next) => {
        const d = deferred();
        saves.push({ next, d });
        return d.promise.then(() => { world.state.policy = { space: { ...next } }; });
      },
      loadRuntimes: async () => {}, loadPolicies: async () => {}, loadPaid: async () => {},
    },
  };
  return { world, saves };
}
const page = () => document.querySelector('[data-page="runtimes"] .set-live');
const mount = (world) => RT.createRuntimeSettings({ world, announce() {}, scope, root: document.querySelector("#settings"), life, uninstall() {} }).open();
const pref = () => page().querySelector("[data-rtd-pref]");
const note = () => page().querySelector("#rtd-preferences").closest(".set-l").querySelector(".rt-saved");
const type = (/** @type {string} */ text) => { const f = pref(); f.value = text; f.dispatchEvent(new Event("input", { bubbles: true })); };
const leave = async () => { const f = pref(); f.focus(); f.blur(); await settle(); };

await t("S098: B typed and left while A saves; A lands: no Saved beside B, then B goes in its turn and only then says Saved", async () => {
  const { world, saves } = await space();
  mount(world);
  await settle();
  type("Preference A"); await leave();
  assert.equal(saves.length, 1, "leaving the field saves A");
  assert.equal(saves[0].next.preferences, "Preference A");
  type("Preference B"); await leave();
  assert.equal(saves.length, 1, "while A is out, B waits: nothing new is sent");
  saves[0].d.resolve(); await settle();
  assert.equal(world.state.policy.space.preferences, "Preference A", "XO holds A");
  assert.equal(saves.length, 2, "B, still a different draft and not being typed, goes as A settles");
  assert.equal(saves[1].next.preferences, "Preference B");
  assert.equal(pref().value, "Preference B", "the field still shows B");
  assert.notEqual(note()?.textContent, "Saved", "never Saved beside B while XO holds A");
  saves[1].d.resolve(); await settle();
  assert.equal(note()?.textContent, "Saved", "B saved: now it says so");
});

await t("a draft typed back to what the save sent goes nowhere; one being typed when the save lands waits for you to leave", async () => {
  const { world, saves } = await space();
  mount(world);
  await settle();
  type("Preference A"); await leave();
  type("Preference B"); await leave();
  type("Preference A"); pref().focus();
  saves[0].d.resolve(); await settle();
  assert.equal(saves.length, 1, "A typed back is what was sent: nothing more goes (S098 on e55c2d8 sent a refused A again)");
  type("Preference C"); await settle();
  assert.equal(saves.length, 1, "typing never saves by itself");
  pref().blur(); await settle();
  assert.equal(saves.length, 2, "leaving the field saves what it holds");
  assert.equal(saves[1].next.preferences, "Preference C");
  saves[1].d.resolve(); await settle();
});

await t("S098: A lands while B is being typed: Saved stands beside nothing, since the field shows B and XO holds A", async () => {
  const { world, saves } = await space();
  mount(world);
  await settle();
  type("Preference A"); await leave();
  pref().focus(); type("Preference B");
  saves[0].d.resolve(); await settle();
  assert.equal(world.state.policy.space.preferences, "Preference A");
  assert.equal(saves.length, 1, "B is still being typed: nothing more is sent");
  assert.equal(pref().value, "Preference B");
  assert.notEqual(note()?.textContent, "Saved", "Saved never stands beside B");
  pref().blur(); await settle();
  saves[1].d.resolve(); await settle();
  assert.equal(note()?.textContent, "Saved", "B saved: now it says so");
});

await t("S098 on e55c2d8: A out, B left, A typed back and left, A refused: A is never sent again", async () => {
  const { world, saves } = await space();
  mount(world);
  await settle();
  type("Preference A"); await leave();
  type("Preference B"); await leave();
  type("Preference A"); await leave();
  saves[0].d.reject(Object.assign(new Error("Too long."), { field: "preferences" })); await settle();
  assert.equal(saves.length, 1, "the draft on the page is what was sent: nothing goes again");
});

await t("a refused save keeps the draft on screen and says why beside the field", async () => {
  const { world, saves } = await space();
  mount(world);
  await settle();
  type("Preference A"); await leave();
  saves[0].d.reject(Object.assign(new Error("Too long."), { field: "preferences" })); await settle();
  assert.equal(pref().value, "Preference A", "the draft stays to try again");
  assert.equal(world.state.policy.space.preferences, null, "XO holds what it held");
  assert.notEqual(note()?.textContent, "Saved");
  assert.equal(page().querySelector("#rtd-preferences").closest(".set-l").querySelector(".rt-ferr")?.textContent, "Too long.", "why, beside the field");
});
scope.dispose();
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
process.exit();
