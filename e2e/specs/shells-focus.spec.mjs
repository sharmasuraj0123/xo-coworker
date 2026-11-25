// @ts-check

import assert from "node:assert/strict";
import { announced, attach, focus, installShells, openDock } from "./shells-dock.spec.mjs";

/** @import {Case, Tools} from "../lib/types.d.ts" */

const project = "demo";
const dock = "#shd";

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function projectAndFilter(t, phone, theme) {
  const { page } = t;
  const state = fixture();
  await installShells(t, state, false);
  t.store.routes[`GET /api/xo-projects/${project}/github/issues`] = { repo: null, issues: [] };
  await page.addInitScript((/** @type {string} */ filter) =>
    sessionStorage.setItem("xo-shells", JSON.stringify({ tabs: [], active: "list", open: true, filter })), project);
  await page.addInitScript((/** @type {string} */ value) => localStorage.setItem("cv-theme", value), theme);
  await t.open();
  await page.locator(dock).waitFor();
  const all = page.getByRole("button", { name: "Show every shell" });
  await all.press("Enter");
  await page.locator('[data-sh-open="sh_1"]').waitFor();
  await focus(t, "[data-sh-new]");
  state.refuse = true;
  await page.keyboard.press("Enter");
  await announced(t, /Couldn't open a shell/);
  await focus(t, "[data-sh-new]");
  assert.equal(state.creates, 1);
  await page.locator("[data-sh-hide]").press("Enter");
  await focus(t, "#home");
  if (phone) await page.locator("#pb-menu, #top-menu").filter({ visible: true }).first().click();
  await page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: project }).click();
  if (phone) await page.locator("#pb-menu, #top-menu").filter({ visible: true }).first().click();
  await page.locator("#nv-shells").click();
  await page.locator("[data-sh-hide]").press("Enter");
  await page.locator(dock).waitFor({ state: "hidden" });
  await focus(t, "#scroller");
  assert.equal(await page.locator("#scroller").isVisible(), true);
}

/** @returns {Parameters<typeof installShells>[1]} */
function fixture() {
  return { refuse: false, creates: 0, closed: [], mode: "ready" };
}

/** @param {Tools} t @param {boolean} phone @param {string} theme @param {boolean} allow */
async function copySelection(t, phone, theme, allow) {
  const { page } = t;
  /** @type {string[]} */
  const copied = [];

  /** @param {string} value */
  const recordCopy = (value) => copied.push(value);

  /** @param {boolean} allowed */
  const installClipboard = (allowed) => {

    const { receiveFixtureCopy } = /** @type {Window & {receiveFixtureCopy?: (value: string) => Promise<void>}} */ (window);
    Object.defineProperty(navigator.clipboard, "writeText", {
      value: (/** @type {string} */ value) => allowed ? receiveFixtureCopy?.(value) : Promise.reject(new Error("Copy denied")),
    });
    document.execCommand = () => false;
  };
  await page.exposeFunction("receiveFixtureCopy", recordCopy);
  await page.addInitScript(installClipboard, allow);
  await installShells(t, fixture(), false);
  await openDock(t, phone, theme);
  await attach(t, "sh_1");
  const screen = page.locator('.shd-term[data-pane="sh_1"] .xterm-screen');
  const box = await screen.boundingBox();
  assert.ok(box);
  const y = box.y + 6;
  await page.mouse.move(box.x + 1, y);
  await page.mouse.down();
  await page.mouse.move(box.x + Math.min(195, box.width - 1), y, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.press("Control+Shift+C");
  await announced(t, allow ? /Copied the selection/ : /Couldn't copy/);
  if (allow) {
    assert.equal(copied.length, 1);
    assert.match(copied[0], /Fixture shell ready/);
  } else {
    assert.deepEqual(copied, []);
    await focus(t, "#shd .xterm-helper-textarea");
  }
}

const viewports = /** @type {const} */ (["desktop", "phone"]);

/** @type {Omit<Case, "file">[]} */
export const cases = viewports.flatMap((viewport) => ["dark", "light"].flatMap((theme) => [
  {
    name: `Restored Shell filter and project Hide focus at ${viewport} ${theme}`, viewport, seed: "basic",
    run: (/** @type {Tools} */ t) => projectAndFilter(t, viewport === "phone", theme),
  },
  ...[true, false].map((allow) => ({
    name: `Shell terminal clipboard ${allow ? "accepted" : "refused"} at ${viewport} ${theme}`, viewport, seed: "basic",
    run: (/** @type {Tools} */ t) => copySelection(t, viewport === "phone", theme, allow),
  })),
]));
