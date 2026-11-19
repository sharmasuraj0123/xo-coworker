// @ts-check

/** @import { Case } from "../lib/types.d.ts" */

// Boot: once the stream's snapshot frame arrives, the app loads and leaves no fallback timer waiting.

/** @type {Omit<Case, "file">[]} */
export const cases = [
  {
    name: "boot settles without waiting out the first-frame fallback", seed: "basic",
    async run(t) {
      await t.page.goto(t.space.base + "/");
      try { await t.settle({ timeout: 3000 }); } catch (e) { t.fail(`boot didn't settle within 3 s: ${/** @type {Error} */ (e).message}`); }
    },
  },
];
