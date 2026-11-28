// @ts-check

import assert from "node:assert/strict";

/** @import {Case, Tools} from "../lib/types.d.ts" */

const viewports = /** @type {const} */ (["desktop", "phone"]);
const title = "Here is the command:";
const command = "npm test";
const seed = {
  routes: { "GET /api/xo-projects/demo/github/issues": { repo: null, issues: [] } },
  messages: { chat_demo: [{
    id: "msg_copy", seq: 1, author_kind: "agent", author_id: "project-coordinator", created_at: "2026-11-19T11:40:20Z",
    text: `${title}\n\n\`\`\`sh\n${command}\n\`\`\`\n`,
  }] },
};

/** @param {boolean} permit */
function clipboard(permit) {
  Object.defineProperty(navigator.clipboard, "writeText", {
    value: async (/** @type {string} */ text) => {
      if (!permit) throw new Error("Copy denied");
      const record = "recordMessageCopy" in window ? window.recordMessageCopy : undefined;
      if (typeof record !== "function") throw new Error("The clipboard fixture requires the Playwright binding");
      return record(text);
    },
  });
  document.execCommand = () => false;
}

/** @param {Tools} t @param {boolean} phone @param {string} theme @param {boolean} permit */
async function copy(t, phone, theme, permit) {
  const { page } = t;
  const live = page.locator("#live");

  /** @type {string[]} */
  const copied = [];
  await page.exposeFunction("recordMessageCopy", (/** @type {string} */ text) => { copied.push(text); });
  await page.addInitScript(clipboard, permit);
  await page.addInitScript((/** @type {string} */ value) => localStorage.setItem("cv-theme", value), theme);
  await t.open();
  if (phone) await page.locator("#pb-menu, #top-menu").filter({ visible: true }).first().click();
  await page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: "demo" }).click();
  const block = page.locator("#msgs [data-copy]").first();
  await block.press("Enter");
  await live.filter({ hasText: permit ? /Copied the code/ : /Couldn't copy/ }).waitFor({ state: "attached" });
  assert.equal((await block.innerText()).trim(), permit ? "Copied" : "Copy");
  assert.equal(await block.evaluate((/** @type {Element} */ node) => node === document.activeElement), true);
  if (phone) {
    assert.deepEqual(copied.map((value) => value.trim()), permit ? [command] : []);
    return;
  }
  const row = page.locator("#msgs .m").filter({ hasText: title }).first();
  await row.hover();
  const button = row.locator("[data-mx-copy]").filter({ visible: true }).first();
  await button.waitFor();
  const icon = await button.innerHTML();
  await button.press("Enter");
  if (permit) await live.filter({ hasText: /Copied the message/ }).waitFor({ state: "attached" });
  else await t.settle();
  assert.match(await live.innerText(), permit ? /Copied the message/ : /Couldn't copy/);
  assert.equal((await button.innerHTML()) !== icon, permit);
  assert.equal(await button.evaluate((/** @type {Element} */ node) => node === document.activeElement), true);
  if (permit) {
    assert.equal(copied.length, 2);
    assert.equal(copied[0].trim(), command);
    assert.ok(copied[1].includes(title) && copied[1].includes(command));
  } else assert.deepEqual(copied, []);
}

/** @type {Omit<Case, "file">[]} */
export const cases = viewports.flatMap((viewport) => ["dark", "light"].flatMap((theme) => [true, false].map((permit) => ({
  name: `Message copy ${permit ? "accepted" : "refused"} at ${viewport} ${theme}`, viewport, seed,
  run: (/** @type {Tools} */ t) => copy(t, viewport === "phone", theme, permit),
}))));
