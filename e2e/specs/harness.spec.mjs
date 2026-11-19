// @ts-check

/** @import { Case, Tools } from "../lib/types.d.ts" */

// The lane's own probe in a real page: what settle waits for, what it names, focus drops and the clock.

/** settle must give up within `ms` naming `what`; returns the message. @param {Tools} t @param {number} ms @param {RegExp} what */
async function stillBusy(t, ms, what) {
  try { await t.settle({ timeout: ms }); } catch (e) {
    const said = String(/** @type {Error} */ (e).message);
    if (!what.test(said)) t.fail(`settle gave up without naming ${what}: ${said}`);
    return said;
  }
  t.fail(`settle returned while ${what} was still pending`);
  return "";
}

const flag = (/** @type {Tools} */ t) => t.page.evaluate(() => /** @type {any} */ (window).__e2eDone === true);

/** @type {Omit<Case, "file">[]} */
export const cases = [
  {
    name: "settle waits for timers and requests, and names a timer that keeps the page busy", seed: "basic",
    async run(t) {
      const { page } = t;
      await t.open();
      await page.evaluate(() => { const w = /** @type {any} */ (window); const tick = () => { document.body.dataset.e2eTick = String(Math.random()); w.__e2eT = setTimeout(tick, 50); }; tick(); });
      await stillBusy(t, 800, /timers waiting: 50 ms from .*tick/);
      await page.evaluate(() => clearTimeout(/** @type {any} */ (window).__e2eT));
      await t.settle();
      await page.evaluate(() => { fetch("api/chat/chats").then(() => { /** @type {any} */ (window).__e2eDone = true; }); });
      await t.settle();
      if (!(await flag(t))) t.fail("settle returned before an open read had answered");
    },
  },
  {
    name: "settle waits for a one-shot timer over a second, but not for a poll that re-arms itself", seed: "basic",
    async run(t) {
      const { page } = t;
      await t.open();
      await page.evaluate(() => { setTimeout(() => { /** @type {any} */ (window).__e2eDone = true; }, 1500); });
      await t.settle();
      if (!(await flag(t))) t.fail("settle returned before a 1.5 s one-shot timer ran");
      await page.evaluate(() => { const w = /** @type {any} */ (window); w.__e2ePolls = 0; const poll = () => { w.__e2ePolls++; w.__e2eP = setTimeout(poll, 1200); }; w.__e2eP = setTimeout(poll, 1200); });
      await t.settle();
      const polls = await page.evaluate(() => /** @type {any} */ (window).__e2ePolls);
      await t.settle();
      if (polls !== 1) t.fail(`a re-arming poll should be waited for once, until it shows it re-arms; it ran ${polls} times`);
      await page.evaluate(() => clearTimeout(/** @type {any} */ (window).__e2eP));
    },
  },
  {
    name: "settle waits for queued animation frames and worker replies", seed: "basic",
    async run(t) {
      const { page } = t;
      await t.open();
      await page.evaluate(() => { let n = 0; const f = () => { if (++n < 30) requestAnimationFrame(f); else /** @type {any} */ (window).__e2eDone = true; }; requestAnimationFrame(f); });
      await t.settle();
      if (!(await flag(t))) t.fail("settle returned while animation frames were still queued");
      await page.evaluate(() => {
        const w = /** @type {any} */ (window);
        w.__e2eDone = false;
        const worker = new Worker(URL.createObjectURL(new Blob(["onmessage = (e) => setTimeout(() => postMessage(e.data + 1), 400)"], { type: "text/javascript" })));
        worker.onmessage = () => { w.__e2eDone = true; worker.terminate(); };
        worker.postMessage(1);
      });
      await t.settle();
      if (!(await flag(t))) t.fail("settle returned before the worker replied");
    },
  },
  {
    name: "settle waits for an event stream's first event", seed: "basic",
    async run(t) {
      const { page, space } = t;
      await t.open();
      const release = space.gate("/api/chat/stream");
      await page.evaluate(() => { fetch("api/chat/stream").then((r) => r.body?.getReader().read()).then(() => { /** @type {any} */ (window).__e2eDone = true; }); });
      await stillBusy(t, 800, /requests open: \/api\/chat\/stream/);
      release();
      await t.settle();
      if (!(await flag(t))) t.fail("settle returned before the stream's first event");
    },
  },
  {
    name: "focus that falls to the page is caught, removed or hidden", seed: "basic",
    async run(t) {
      const { page } = t;
      await t.open();
      const make = (/** @type {string} */ label) => page.evaluate((/** @type {string} */ label) => { const b = document.createElement("button"); b.textContent = label; document.body.append(b); b.focus(); }, label);
      await make("Removed");
      await page.evaluate(() => document.querySelector("body > button:last-child")?.remove());
      await make("Hidden");
      await page.evaluate(() => { /** @type {HTMLElement} */ (document.querySelector("body > button:last-child")).style.display = "none"; });
      await t.settle();
      const drops = await page.evaluate(() => /** @type {any} */ (window).__e2e.drops.splice(0));
      if (drops.length !== 2 || !/Removed/.test(drops[0]) || !/Hidden/.test(drops[1])) t.fail(`expected drops from the removed and the hidden button, got ${JSON.stringify(drops)}`);
    },
  },
  {
    name: "the clock reads the seed's time while timers run in real time", seed: "basic",
    async run(t) {
      const { page } = t;
      await t.open();
      const before = await page.evaluate(() => Date.now());
      await page.evaluate(() => new Promise((ok) => setTimeout(ok, 300)));
      const after = await page.evaluate(() => Date.now());
      if (before !== Date.parse(t.store.now) || after !== before) t.fail(`Date.now() read ${before} then ${after}; the seed's time is ${Date.parse(t.store.now)}`);
    },
  },
];
