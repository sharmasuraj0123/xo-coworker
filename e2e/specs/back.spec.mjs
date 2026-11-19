// @ts-check

/** @import { Case } from "../lib/types.d.ts" */

// The phone's own Back closes the top-most layer first: the drawer, then a sheet over it; the page stays where it was.

/** @type {Omit<Case, "file">[]} */
export const cases = [
  {
    name: "phone Back closes the drawer and keeps the page", seed: "basic", viewport: "phone",
    async run(t) {
      const { page } = t;
      await t.open();
      const app = page.locator("#app");
      await page.locator("#pb-menu").click();
      await t.settle();
      if (!(await app.evaluate((/** @type {Element} */ el) => el.classList.contains("drawer")))) t.fail("the menu didn't open the drawer");
      await page.goBack();
      await t.settle();
      if (await app.evaluate((/** @type {Element} */ el) => el.classList.contains("drawer"))) t.fail("Back left the drawer open");
      if (!page.url().startsWith(t.space.base)) t.fail(`Back left the app: ${page.url()}`);
    },
  },
  {
    name: "phone Back closes Settings before the page", seed: "basic", viewport: "phone",
    async run(t) {
      const { page } = t;
      await t.open();
      await page.locator("#pb-menu").click();
      await t.settle();
      await page.getByRole("complementary", { name: "Navigation" }).getByRole("button", { name: "Settings" }).click();
      await t.settle();
      if (!(await page.getByRole("dialog").count())) t.fail("Settings didn't open");
      await page.goBack();
      await t.settle();
      if (await page.getByRole("dialog").count()) t.fail("Back left Settings open");
      if (!page.url().startsWith(t.space.base)) t.fail(`Back left the app: ${page.url()}`);
    },
  },
];
