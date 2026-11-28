// @ts-check

import assert from "node:assert/strict";

/** @import {Case, Tools} from "../lib/types.d.ts" */

const project = "demo";
const thread = "t-live";
const meta = { chat_id: "chat_demo", thread_ts: thread, session_id: "s-live", turn_id: "turn-map" };
const files = Array.from({ length: 12 }, (_, index) => `folder-${String(index).padStart(2, "0")}/index.js`);
const seed = {
  threads: { chat_demo: [{ ts: thread, session_id: meta.session_id, title: "Map test agent", cwd: "/home/test/demo" }] },
  files: { [project]: { "root.js": "Fixture root\n", ...Object.fromEntries(files.map((name) => [name, "Fixture file\n"])) } },
  routes: { "GET /api/xo-projects/demo/github/issues": { repo: null, issues: [] } },
};

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function openMap(t, phone, theme) {
  const { page } = t;
  page.setDefaultTimeout(3200);
  await page.addInitScript((/** @type {string} */ value) => localStorage.setItem("cv-theme", value), theme);
  await t.open();
  if (phone) await page.locator("#pb-menu, #top-menu").filter({ visible: true }).first().click();
  await page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: "demo" }).click();
  await t.settle();
  await page.locator("[data-stage-toggle]").filter({ visible: true }).click();
  const tree = page.locator("#stage-map-tree");
  if (!(await tree.isVisible())) await page.locator('[data-ghost="map"], [data-fr-fold="map"]').filter({ visible: true }).first().click();
  await page.locator("#fr-body-map .dg-world").waitFor({ state: "attached" });
  await page.locator('#fr-body-map [data-dg="fit"]').waitFor();
  await tree.click();
  await t.settle();
}

/** @param {Tools} t @param {string} selector */
async function focus(t, selector) {
  try {
    await t.page.waitForFunction((/** @type {string} */ target) => !!document.activeElement?.matches(target), selector, { timeout: 2500 });
  } catch (error) {
    const active = await t.page.evaluate(() => ({
      id: document.activeElement?.id,
      selected: document.activeElement?.getAttribute("aria-selected"),
      drawing: document.querySelector(".dg-world")?.className,
    }));
    throw new Error(`Map tab ${selector} did not receive selected focus: ${JSON.stringify(active)}`, { cause: error });
  }
}

/** @param {Tools} t */
async function mapTabs(t) {
  const { page } = t;
  const tree = page.locator("#stage-map-tree");
  await tree.press("ArrowRight");
  await focus(t, '#stage-map-graph[aria-selected="true"]');
  await page.keyboard.press("ArrowLeft");
  await focus(t, '#stage-map-tree[aria-selected="true"]');
}

/** @param {Tools} t @param {number} index */
async function pushEdit(t, index) {
  const current = t.page.locator(`.dg-cur:has(.dg-tag[data-mp-go="t:${thread}"])`);
  const before = await current.count()
    ? await current.evaluate((/** @type {HTMLElement} */ node) => node.style.transform)
    : "";
  const file = files[index];
  t.space.push("block.finished", {
    block: { id: `fixture-${index}`, type: "activity", rows: [
      { call_id: `edit-${index}`, kind: "edit_file", status: "running", target: file },
    ] },
  }, meta);
  await t.page.waitForFunction((/** @type {{thread: string, before: string}} */ state) => {
    const tag = document.querySelector(`.dg-tag[data-mp-go="t:${state.thread}"]`);
    const cursor = tag?.closest(".dg-cur");
    return cursor instanceof HTMLElement && cursor.style.transform !== state.before;
  }, { thread, before }, { timeout: 2500 });
}

/** @param {Tools} t @param {"tree" | "graph"} mode @param {number} offset */
async function keepsZoom(t, mode, offset) {
  const { page } = t;
  await page.locator(`#stage-map-${mode}`).click();
  const drawing = page.locator(`.dg-world.k-${mode}`);
  await drawing.locator("[data-node]").first().waitFor({ state: "attached" });
  await t.settle();
  await page.locator('[data-dg="fit"]').click();
  const zoom = page.locator('[data-dg="in"]');
  const scale = () => drawing.evaluate((/** @type {HTMLElement} */ node) => Number(node.style.getPropertyValue("--dg-s")));
  for (let count = 0; count < 16 && await scale() < 2.399; count++) await zoom.click();
  const chosen = await scale();
  assert.ok(chosen > 2.39);
  const follow = page.locator('[data-dg="follow"]');
  if (await follow.getAttribute("aria-pressed") === "true") await follow.click();
  await follow.focus();
  await page.keyboard.press("Enter");
  assert.equal(await follow.getAttribute("aria-pressed"), "true", `Follow activates in ${mode}`);
  for (const index of [offset, offset + 1, offset + 2]) {
    await pushEdit(t, index);
    await t.settle();
    assert.equal(await scale(), chosen);
  }
  await follow.click();
  assert.equal(await follow.getAttribute("aria-pressed"), "false", `Follow deactivates in ${mode}`);
  await t.settle();
  const transform = () => drawing.evaluate((/** @type {HTMLElement} */ node) => node.style.transform);
  const before = await transform();
  for (const index of [offset + 3, offset + 4, offset + 5]) {
    await pushEdit(t, index);
    await t.settle();
    assert.equal(await transform(), before);
  }
}

const viewports = /** @type {const} */ (["desktop", "phone"]);

const modes = /** @type {const} */ (["tree", "graph"]);

/** @type {Omit<Case, "file">[]} */
export const cases = viewports.flatMap((viewport) => ["dark", "light"].flatMap((theme) => [
  {
    name: `Map keyboard tab activation at ${viewport} ${theme}`, viewport, seed,
    async run(/** @type {Tools} */ t) {
      await openMap(t, viewport === "phone", theme);
      await mapTabs(t);
    },
  },
  ...modes.map((mode) => ({
    name: `Map ${mode} Follow through live edits at ${viewport} ${theme}`, viewport, seed,
    async run(/** @type {Tools} */ t) {
      await openMap(t, viewport === "phone", theme);
      t.space.push("session", { status: "running", reason: "started" }, meta);
      t.space.push("turn.started", {}, meta);
      await keepsZoom(t, mode, mode === "tree" ? 0 : 6);
    },
  })),
]));
