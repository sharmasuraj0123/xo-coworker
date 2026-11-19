// @ts-check

/** @import { Case } from "../lib/types.d.ts" */

// The lane's own probe in a real page: settle waits out work and names it; a focus drop is caught.

/** @type {Omit<Case, "file">[]} */
export const cases = [
  {
    name: "settle waits out work in progress and names it", seed: "basic",
    async run(t) {
      const { page } = t;
      await t.open();
      await page.evaluate(() => { const w = /** @type {any} */ (window); const tick = () => { document.body.dataset.e2eTick = String(Date.now() + Math.random()); w.__e2eT = setTimeout(tick, 50); }; tick(); });
      let said = null;
      try { await t.settle({ timeout: 800 }); } catch (e) { said = String(/** @type {Error} */ (e).message); }
      if (!said) t.fail("settle returned while a timer kept changing the page");
      else if (!/timers waiting: 50 ms tick/.test(said)) t.fail(`settle gave up without naming the timer: ${said}`);
      await page.evaluate(() => clearTimeout(/** @type {any} */ (window).__e2eT));
      await t.settle();
      await page.evaluate(() => { const w = /** @type {any} */ (window); w.__e2eGot = false; fetch("api/chat/chats").then(() => { w.__e2eGot = true; }); });
      await t.settle();
      if (!(await page.evaluate(() => /** @type {any} */ (window).__e2eGot))) t.fail("settle returned before an open read had answered");
    },
  },
  {
    name: "focus that falls to the page is caught", seed: "basic",
    async run(t) {
      const { page } = t;
      await t.open();
      await page.evaluate(() => { const b = document.createElement("button"); b.textContent = "Doomed"; document.body.append(b); b.focus(); });
      await page.evaluate(() => document.querySelector("body > button:last-child")?.remove());
      await t.settle();
      const drops = await page.evaluate(() => /** @type {any} */ (window).__e2e.drops.splice(0));
      if (drops.length !== 1 || !/Doomed/.test(drops[0])) t.fail(`expected one drop from the removed button, got ${JSON.stringify(drops)}`);
    },
  },
];
