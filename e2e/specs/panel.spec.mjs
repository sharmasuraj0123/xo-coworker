// @ts-check

/** @import { Case } from "../lib/types.d.ts" */

// The right panel lists the project's threads, changes and map.

/** @type {Omit<Case, "file">[]} */
export const cases = [
  {
    name: "the threads panel lists the finished thread", seed: "basic",
    async run(t) {
      const { page } = t;
      await t.open();
      await page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: "demo" }).click();
      await t.settle();
      await page.getByRole("button", { name: "1 thread. Open them in the panel" }).click();
      await t.settle();
      const panel = page.getByRole("complementary", { name: "Panel: threads, changes and map" });
      await panel.getByRole("button", { name: "Done 1" }).click();
      await t.settle();
      await t.snap("panel", panel);
    },
  },
];
