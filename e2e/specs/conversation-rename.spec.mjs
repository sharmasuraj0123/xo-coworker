// @ts-check

import assert from "node:assert/strict";

/** @import { Case, Tools } from "../lib/types.d.ts" */

/** @typedef {{status: number, json: unknown}} RefusalResponse */

/** @typedef {{request(): {method(): string}, fallback(): Promise<void>, fulfill(options: RefusalResponse): Promise<void>}} RenameRoute */

const thread = "cmsg_e2e_readme";
const patchPath = `/api/chat/chats/chat_demo/threads/${thread}`;
const before = "Tidy the README";
const after = "Clarify how to use the README";

/** @param {Tools} t @param {boolean} phone */
async function openThread(t, phone) {
  const { page } = t;
  await t.open();
  if (phone) await page.locator("#pb-menu").click();
  await page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: "demo" }).click();
  await page.locator("[data-stage-open]").click();
  const row = page.locator(`#stage [data-go="t:${thread}"]`);
  if (!(await row.isVisible())) await page.locator('#stage [data-tg-fold="done"]').click();
  await row.click();
  await page.getByRole("button", { name: "Open in main chat" }).click();
  const close = page.locator("#stage [data-stg-close]").filter({ visible: true });
  if (await close.count()) await close.click();
  await page.getByRole("heading", { name: before }).waitFor();
  await t.settle();
}

/** @param {Tools} t */
async function rename(t) {
  await t.page.locator("#top-who [data-tmenu]").press("Enter");
  await t.page.getByRole("menuitem", { name: /Rename/ }).press("Enter");
  const field = t.page.locator("#tw-edit");
  await field.waitFor();
  return field;
}

/** @param {Tools['page']} page @param {string} selector */
async function focused(page, selector) {
  await page.waitForFunction((/** @type {string} */ match) => document.activeElement?.matches(match), selector);
}

/** @param {Tools} t */
async function menuKeys(t) {
  const { page } = t;
  const opener = "#top-who [data-tmenu]";
  const menu = page.locator("#top-who .tw-menu");
  const items = menu.locator('[role="menuitem"]:not([aria-disabled="true"]):not(:disabled)').filter({ visible: true });
  await page.locator(opener).press("Enter");
  await menu.waitFor();
  const last = (await items.count()) - 1;
  assert.ok(last >= 1);
  const moves = /** @type {const} */ ([["ArrowDown", 1], ["ArrowUp", 0], ["ArrowUp", last], ["Home", 0], ["End", last]]);

  assert.equal(await items.first().evaluate((/** @type {Element} */ el) => el === document.activeElement), true, "initial menu focus");
  for (const [key, to] of moves) {
    await page.keyboard.press(key);
    assert.equal(await items.nth(to).evaluate((/** @type {Element} */ el) => el === document.activeElement), true, key);
  }
  await page.keyboard.press("Escape");
  await menu.waitFor({ state: "hidden" });
  await focused(page, opener);
  await page.locator(opener).press("Enter");
  await menu.waitFor();
  await page.keyboard.press("Tab");
  await menu.waitFor({ state: "hidden" });
  const keptFocus = await page.evaluate(() => !!document.activeElement && document.activeElement !== document.body);
  assert.equal(keptFocus, true, "Tab advances focus after closing the menu");
  await page.getByRole("heading", { name: before }).waitFor();
}

/** @param {Tools} t */
async function checklist(t) {
  const { page, space } = t;
  const toggle = page.locator("#thead [data-ck]");
  assert.equal(await toggle.count(), 0);
  assert.equal(await page.locator("#thead").isHidden(), true, "the seeded thread has no checklist or run strip");
  space.push("thread", { ts: thread, status_md: "○ Read the form" }, { chat_id: "chat_demo", thread_ts: thread });
  await toggle.waitFor();
  assert.match(await toggle.innerText(), /0 of 1/);
  const sameButton = await toggle.elementHandle();
  try {
    await toggle.press("Enter");
    await page.locator('#thead [data-ck][aria-expanded="true"]').waitFor();
    assert.equal(await sameButton.evaluate((/** @type {Element} */ el) => el === document.activeElement), true, "open retains focus");
    await page.keyboard.press("Space");
    await page.locator('#thead [data-ck][aria-expanded="false"]').waitFor();
    assert.equal(await sameButton.evaluate((/** @type {Element} */ el) => el === document.activeElement), true, "close retains focus");
  } finally { await sameButton.dispose(); }
}

const viewports = /** @type {const} */ (["desktop", "phone"]);

/** @type {Omit<Case, 'file'>[]} */
export const cases = viewports.flatMap((viewport) => ["dark", "light"].map((theme) => ({
  name: `thread menu, checklist and native rename at ${viewport} ${theme}`, viewport, seed: "basic",
  async run(t) {
    const { page } = t;
    await page.addInitScript((/** @type {string} */ value) => localStorage.setItem("cv-theme", value), theme);
    let attempts = 0;
    await page.route(`**${patchPath}`, async (/** @type {RenameRoute} */ route) => {
      if (route.request().method() !== "PATCH") return route.fallback();
      ++attempts;
      if (attempts === 1) return route.fulfill({ status: 403, json: { detail: { code: "refused", message: "Rename refused" } } });
      return route.fallback();
    });
    await openThread(t, viewport === "phone");
    await menuKeys(t);
    await checklist(t);
    const opener = "#top-who [data-tmenu]";
    const field = await rename(t);
    await field.fill("名前の候補");
    for (const key of ["Enter", "Escape"]) for (const modern of [true, false]) {
      await field.evaluate((/** @type {Element} */ el, /** @type {{key:string, modern:boolean}} */ input) => {
        const composition = input.modern ? { isComposing: true } : { keyCode: 229 };
        el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: input.key, ...composition }));
      }, { key, modern });
    }
    assert.equal(await field.inputValue(), "名前の候補");
    assert.equal(attempts, 0);
    await field.press("Escape");
    await page.getByRole("heading", { name: before }).waitFor();
    await focused(page, opener);
    assert.equal(attempts, 0);

    await rename(t);
    await field.fill(after);
    await field.press("Enter");
    await page.waitForFunction(() => /Couldn't rename it/.test(
      (document.querySelector("#live")?.textContent || "") + (document.querySelector("#herald")?.textContent || ""),
    ));
    assert.equal(await field.inputValue(), after);
    await focused(page, "#tw-edit");
    assert.equal(attempts, 1);

    t.store.routes[`PATCH ${patchPath}`] = { ...t.store.threads.chat_demo[0], title: after };
    const release = t.space.gate(patchPath);
    try {
      await field.press("Enter");
      await page.locator('#tw-edit[aria-busy="true"]').waitFor();
      await field.press("Enter");
      await focused(page, "#tw-edit");
    } finally { release(); }
    await page.getByRole("heading", { name: after }).waitFor();
    await focused(page, opener);
    await t.settle();
    assert.equal(attempts, 2);
    const writes = t.store.writes.filter((write) => write.method === "PATCH" && write.path === patchPath);
    assert.deepEqual(writes.map((write) => write.body), [{ title: after }]);
  },
})));
