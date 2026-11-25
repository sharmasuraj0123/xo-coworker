// @ts-check

import assert from "node:assert/strict";

/** @import {Case, Tools} from "../lib/types.d.ts" */

const names = ["First", "Second", "Third"];
const seed = {
  routes: { "GET /api/xo-projects/demo/github/issues": { repo: null, issues: [] } },
  messages: { chat_demo: [{
    id: "msg_gallery", text: "Three pictures from the report.", author_kind: "owner",
    extra: { attachments: names.map((title, index) => ({
      id: `pic-${index}`, title, name: `report-${index}.svg`, type: "image/svg+xml", bytes: 200, w: 64, h: 64,
    })) },
  }] },
};
const viewports = /** @type {const} */ (["desktop", "phone"]);

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function open(t, phone, theme) {
  const { page, space } = t;
  /** @param {{fetch(options: {url: string}): Promise<unknown>, fulfill(options: {response: unknown}): Promise<void>}} route */
  const image = async (route) => route.fulfill({ response: await route.fetch({ url: `${space.base}/favicon.svg` }) });
  await page.route("**/api/chat/chats/chat_demo/attachments/pic-*", image);
  await page.addInitScript((/** @type {string} */ value) => localStorage.setItem("cv-theme", value), theme);
  await t.open();
  if (phone) await page.locator("#pb-menu, #top-menu").filter({ visible: true }).first().click();
  await page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: "demo", exact: true }).click();
  const first = page.getByRole("button", { name: /^Open First, image 1 of 3$/ });
  await first.press("Enter");
  const dialog = page.locator('.lbx[role="dialog"]');
  await dialog.getByText("1 of 3", { exact: true }).waitFor();
  await t.settle();
  return { page, dialog };
}

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function ends(t, phone, theme) {
  const { page, dialog } = await open(t, phone, theme);
  const next = dialog.getByRole("button", { name: "Next picture" });
  if (await next.isVisible()) {
    await next.press("Enter");
    await next.press("Enter");
    assert.equal(await next.getAttribute("aria-disabled"), "true");
    await next.press("Enter");
    assert.equal(await next.evaluate((/** @type {Element} */ node) => node === document.activeElement), true);
  } else {
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
  }
  await dialog.getByText("3 of 3", { exact: true }).waitFor();
  await page.keyboard.press("ArrowLeft");
  await dialog.getByText("2 of 3", { exact: true }).waitFor();
  const previous = dialog.getByRole("button", { name: "Previous picture" });
  if (await previous.isVisible()) {
    await previous.press("Enter");
    assert.equal(await previous.getAttribute("aria-disabled"), "true");
    await previous.press("Enter");
    assert.equal(await previous.evaluate((/** @type {Element} */ node) => node === document.activeElement), true);
  } else {
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
  }
  await dialog.getByText("1 of 3", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  const first = page.getByRole("button", { name: /^Open First, image 1 of 3$/ });
  assert.equal(await first.evaluate((/** @type {Element} */ node) => node === document.activeElement), true);
}

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function returnToPicture(t, phone, theme) {
  const { page, dialog } = await open(t, phone, theme);
  await page.keyboard.press("Tab");
  assert.equal(await dialog.evaluate((/** @type {Element} */ el) => el.contains(document.activeElement)), true);
  await page.keyboard.press("ArrowRight");
  await dialog.getByText("2 of 3", { exact: true }).waitFor();
  await dialog.getByRole("button", { name: "Close", exact: true }).press("Enter");
  await dialog.waitFor({ state: "hidden" });
  const second = page.getByRole("button", { name: /^Open Second, image 2 of 3$/ });
  assert.equal(await second.evaluate((/** @type {Element} */ node) => node === document.activeElement), true);
}

/** @type {Omit<Case, "file">[]} */
export const cases = viewports.flatMap((viewport) => ["dark", "light"].flatMap((theme) => [
  { name: `Lightbox end navigation and retained focus at ${viewport} ${theme}`, viewport, seed,
    run: (/** @type {Tools} */ t) => ends(t, viewport === "phone", theme) },
  { name: `Lightbox returns keyboard focus to the viewed picture at ${viewport} ${theme}`, viewport, seed,
    run: (/** @type {Tools} */ t) => returnToPicture(t, viewport === "phone", theme) },
]));
