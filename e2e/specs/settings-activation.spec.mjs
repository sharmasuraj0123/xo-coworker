// @ts-check

import assert from "node:assert/strict";

/** @import { Case } from "../lib/types.d.ts" */

/** @type {Omit<Case, 'file'>[]} */
export const cases = /** @type {const} */ (["desktop", "phone"]).flatMap((viewport) => ["dark", "light"].map((theme) => ({
  name: `Settings close activation and focus return at ${viewport} ${theme}`, viewport, seed: "basic",
  async run(t) {
    const { page } = t;
    const phone = viewport === "phone";
    await page.addInitScript((/** @type {string} */ value) => localStorage.setItem("cv-theme", value), theme);
    await t.open();
    const opener = page.locator(phone ? "#set-phone" : "#set-side");
    const dialog = page.locator("#settings");
    const close = page.locator("#set-x");
    for (const how of ["Enter", "Space", "click", "Escape"]) {
      await opener.press("Enter");
      await dialog.waitFor();
      if (how === "click") await close.click();
      else if (how === "Escape") await page.keyboard.press(how);
      else await close.press(how);
      await dialog.waitFor({ state: "hidden" });
      assert.equal(await opener.evaluate((/** @type {Element} */ el) => el === document.activeElement), true, how);
    }
    if (phone) {
      const menu = page.locator("#pb-menu, #top-menu").filter({ visible: true }).first();
      await menu.press("Enter");
      await page.locator("#app.drawer").waitFor();
      await page.locator("#set-side").press("Enter");
      await dialog.waitFor();
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      assert.equal(await menu.evaluate((/** @type {Element} */ el) => el === document.activeElement && el.matches(":focus-visible")), true);
    }
  },
})));
