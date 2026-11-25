// @ts-check

import assert from "node:assert/strict";

/** @import { Case } from "../lib/types.d.ts" */

/** @type {Omit<Case, 'file'>[]} */
export const cases = /** @type {const} */ (["desktop", "phone"]).flatMap((viewport) => ["dark", "light"].map((theme) => ({
  name: `shortcuts inert, close and focus return at ${viewport} ${theme}`, viewport, seed: "basic",
  async run(t) {
    const { page } = t;
    await page.addInitScript((/** @type {string} */ value) => localStorage.setItem("cv-theme", value), theme);
    await t.open();
    const sheet = page.locator("#keys");
    const opener = page.locator(viewport === "phone" ? "#pb-menu" : "#set-side");
    await opener.focus();
    const open = async () => {
      await page.keyboard.press("Shift+Slash");
      await sheet.waitFor();
      await page.locator("#app[inert]").waitFor({ state: "attached" });
    };
    await open();
    await sheet.getByRole("button", { name: "Close" }).click();
    await sheet.waitFor({ state: "hidden" });
    await page.locator("#app:not([inert])").waitFor({ state: "attached" });
    assert.equal(await opener.evaluate((/** @type {Element} */ el) => el === document.activeElement), true);
    await open();
    await sheet.getByRole("button", { name: "Close" }).evaluate((/** @type {HTMLElement} */ el) => el.blur());
    await sheet.evaluate((/** @type {HTMLElement} */ el) => { el.hidden = true; });
    await page.locator("#app:not([inert])").waitFor({ state: "attached" });
    await opener.focus();
  },
})));
