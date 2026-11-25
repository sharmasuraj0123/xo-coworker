// @ts-check

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** @import { Case, Seed, Tools } from "../lib/types.d.ts" */

const basic = /** @type {Seed} */ (JSON.parse(readFileSync(new URL("../seeds/basic.json", import.meta.url), "utf8")));
const seed = { ...basic, routes: { ...basic.routes,
  "GET /api/coworker/xo-projects/demo/paths": { root: "/home/test/demo", paths: ["README.md", "src/app.js", "notes.txt"],
    dirs: ["src"], truncated: false, stamp: "smoke" },
  "GET /api/xo-projects/demo/versions": { versions: [], head: null, more: false },
} };

const profiles = /** @type {const} */ ([
  ["desktop", "dark", 1440, 900], ["desktop", "light", 1440, 900],
  ["phone", "dark", 390, 844], ["phone", "light", 390, 844],
]);

/** @param {Tools} t @param {typeof profiles[number]} profile */
async function open(t, [device, theme, width, height]) {
  await t.page.addInitScript((/** @type {string} */ value) => {
    if (!localStorage.getItem("cv-theme")) localStorage.setItem("cv-theme", value);
  }, theme);
  await t.open();
  const actual = await t.page.evaluate(() => [innerWidth, innerHeight, devicePixelRatio, document.documentElement.dataset.theme || "dark"]);
  assert.deepEqual(actual, [width, height, 1, theme], `${device} environment`);
}

/** @param {Tools['page']} page @param {string} selector */
const visible = (page, selector) => page.locator(selector).filter({ visible: true }).first();

/** @param {Tools} t @param {boolean} phone */
async function project(t, phone) {
  if (phone) await visible(t.page, "#pb-menu, #top-menu").click();
  await visible(t.page, '[data-go="p:demo"]').click();
  await t.settle();
}

/** @param {Tools} t @param {string} text */
async function send(t, text) {
  const box = t.page.locator("#say");
  const usable = await box.evaluate((/** @type {HTMLElement} */ input) => {
    const on = document.getElementById("send");
    if (!on || input.closest("[inert]")) return false;
    const sendRect = on.getBoundingClientRect();
    const chip = document.getElementById("iq");
    const chipRect = chip?.getClientRects().length ? chip.getBoundingClientRect() : null;
    const chipFits = !chipRect || (chipRect.right <= sendRect.left + 1 && chipRect.width >= 24);
    return sendRect.right <= innerWidth && sendRect.width >= 30 && chipFits;
  });
  assert.equal(usable, true, "Send and the model chip fit, and the composer is reachable");
  await box.click();
  await t.page.keyboard.insertText(text);
  assert.equal(await box.inputValue(), text);
  await box.press("Enter");
  await t.page.getByRole("log", { name: "Messages" }).getByText(text, { exact: true }).waitFor();
  await t.settle();
  assert.equal(await box.inputValue(), "");
  const posts = t.store.writes.filter((write) => write.method === "POST" && write.path.endsWith("/messages"));
  assert.equal(posts.filter((write) => /** @type {{ text?: string }} */ (write.body)?.text === text).length, 1);
}

/** @param {Tools} t */
async function showStage(t) {
  await visible(t.page, "[data-stage-toggle]").click();
  await t.page.locator("#stage:not([hidden])").waitFor();
}

/** @param {Tools} t */
async function hideStage(t) {
  await visible(t.page, "[data-stg-close]").click();
  await t.page.locator("#stage").waitFor({ state: "hidden" });
  assert.equal(await t.page.locator("[data-stage-inert]").count(), 0);
  assert.equal(await t.page.locator("#say").evaluate((/** @type {Element} */ el) => !!el.closest("[inert]")), false);
}

/** @type {Omit<Case, 'file'>[]} */
export const cases = profiles.flatMap((profile) => {
  const [viewport, theme] = profile;
  const phone = viewport === "phone";
  return [
    { name: `composer, Stage and Files at ${viewport} ${theme}`, viewport, seed, async run(t) {
      await open(t, profile);
      await project(t, phone);
      await send(t, "Smoke: sent with the composer in reach");
      await showStage(t);
      await hideStage(t);
      await send(t, "Smoke: after closing the panel");
      const url = t.page.url();
      await showStage(t);
      const changes = visible(t.page, '[data-ghost="changes"]');
      if (await changes.count()) await changes.click();
      await visible(t.page, "[data-open-files]").click();
      await visible(t.page, '[data-fl-file="notes.txt"]').click();
      await t.page.locator("#viewer .cm-content").waitFor();
      assert.equal(await t.page.locator("#stage [data-open-files]").getAttribute("aria-pressed"), "true");
      if (phone) await hideStage(t);
      assert.equal(t.page.url(), url, "opening a file keeps the current conversation");
      await send(t, "Smoke: chat is still available after opening a file");
    } },
    { name: `theme round trip and Keyboard wheel at ${viewport} ${theme}`, viewport, seed, async run(t) {
      await open(t, profile);
      for (const expected of [theme === "dark" ? "light" : "dark", theme]) {
        if (phone) {
          await visible(t.page, "#pb-menu, #top-menu").click();
          await t.page.locator("#app.drawer").waitFor();
        }
        await t.page.locator("#theme").click();
        await t.page.waitForFunction((/** @type {string} */ value) => {
          return (document.documentElement.dataset.theme || "dark") === value;
        }, expected);
        if (phone) {
          if (await t.page.locator("#app.drawer").count()) await t.page.keyboard.press("Escape");
          await t.page.locator("#app:not(.drawer)").waitFor();
        }
      }
      await t.page.locator(phone ? "#set-phone" : "#set-side").click();
      await t.page.getByRole("tab", { name: "Keyboard" }).click();
      await t.page.mouse.move(profile[2] / 2, 400);
      const reset = t.page.locator("#keys-reset-all");
      for (let tick = 0; tick < 12; tick++) await t.page.mouse.wheel(0, 600);
      await t.page.waitForFunction(() => {
        const rect = document.querySelector("#keys-reset-all")?.getBoundingClientRect();
        return !!rect && rect.top < innerHeight && rect.bottom > 0;
      });
      assert.ok(await reset.isVisible());
      assert.equal(await t.page.locator("#main").evaluate((/** @type {Element} */ el) => el.scrollTop), 0);
    } },
  ];
});
