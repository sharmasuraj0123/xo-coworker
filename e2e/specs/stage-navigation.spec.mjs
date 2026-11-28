// @ts-check

import assert from "node:assert/strict";

/** @import {Case, Tools} from "../lib/types.d.ts" */

const viewports = /** @type {const} */ (["desktop", "phone"]);
const phoneSize = { width: 390, height: 844 };
const desktopSize = { width: 1440, height: 900 };
const opener = "[data-stage-toggle]";
const closer = "[data-stg-close]";
const menu = "#pb-menu, #top-menu";

/** @param {Tools["page"]} page @param {string} selector */
const visible = (page, selector) => page.locator(selector).filter({ visible: true }).first();

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function project(t, phone, theme) {
  const { page } = t;
  await page.addInitScript((/** @type {string} */ value) => localStorage.setItem("cv-theme", value), theme);
  await t.open();
  if (phone) await visible(page, menu).click();
  await page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: "demo" }).click();
  await t.settle();
}

/** @param {Tools} t @param {string} selector */
async function focus(t, selector) {
  try {
    await t.page.waitForFunction((/** @type {string} */ target) => !!document.activeElement?.matches(target), selector, { timeout: 2500 });
  } catch (error) {
    const active = await t.page.evaluate(() => ({
      id: document.activeElement?.id,
      tag: document.activeElement?.tagName,
      classes: document.activeElement?.className,
      stage: document.getElementById("stage")?.hidden,
    }));
    throw new Error(`Expected focus on ${selector}, saw ${JSON.stringify(active)}`, { cause: error });
  }
}

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function resize(t, phone, theme) {
  const { page } = t;
  await project(t, phone, theme);
  const trigger = visible(page, opener);
  await trigger.press("Enter");
  await page.locator("#stage").waitFor();
  if (phone) {
    const close = visible(page, closer);
    await close.focus();
    await focus(t, closer);
    await page.setViewportSize(desktopSize);
    await t.settle();
    await focus(t, "#stage:focus, #stage :focus");
    assert.equal(await page.locator("#main [data-stage-inert]").count(), 0);
  } else {
    await trigger.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await focus(t, opener);
    await page.setViewportSize(phoneSize);
    await focus(t, "#stage:focus, #stage :focus");
    assert.equal(await page.evaluate(() => !!document.activeElement?.closest("[inert]")), false);
  }
  await visible(page, closer).press("Enter");
  await page.locator("#stage").waitFor({ state: "hidden" });
  await focus(t, opener);
  assert.equal(await page.locator("[data-stage-inert]").count(), 0);
}

/** @param {Tools} t @param {string} theme */
async function drawer(t, theme) {
  const { page } = t;
  await project(t, true, theme);
  await visible(page, menu).press("Enter");
  await page.locator("#app.drawer").waitFor();
  await focus(t, "#side :focus");
  const count = await page.locator("#side").evaluate((/** @type {HTMLElement} */ side) =>
    [...side.querySelectorAll("*")].filter((node) => node instanceof HTMLElement
      && node.tabIndex >= 0 && !node.matches(":disabled") && node.getClientRects().length > 0).length);
  assert.ok(count > 2);
  for (const key of ["Tab", "Shift+Tab"]) {
    for (let step = 0; step < count + 2; step++) {
      await page.keyboard.press(key);
      assert.equal(await page.evaluate(() => !!document.activeElement?.closest("#side")), true, `${key} from drawer stop ${step}`);
    }
  }
  await page.keyboard.press("Escape");
  await page.locator("#app:not(.drawer)").waitFor();
  await focus(t, menu);
}

/** @type {Omit<Case, "file">[]} */
export const cases = viewports.flatMap((viewport) => ["dark", "light"].flatMap((theme) => [
  { name: `Stage focus across resize and close at ${viewport} ${theme}`, viewport, seed: "basic",
    run: (/** @type {Tools} */ t) => resize(t, viewport === "phone", theme) },
  ...viewport === "phone" ? [{ name: `Drawer traps keyboard focus at ${theme}`, viewport, seed: "basic",
    run: (/** @type {Tools} */ t) => drawer(t, theme) }] : [],
]));
