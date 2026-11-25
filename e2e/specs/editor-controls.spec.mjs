// @ts-check

import assert from "node:assert/strict";

/** @import {Case, Seed, Tools} from "../lib/types.d.ts" */

/** @typedef {{relative_path: string, content: string, base_version: string | null}} SaveRequest */

/** @typedef {{url(): string, method(): string, postDataJSON(): SaveRequest}} BrowserRequest */

/** @typedef {{request(): BrowserRequest, fulfill(value: {status?: number, json: unknown}): Promise<void>}} ReplyRoute */

/** @typedef {ReplyRoute & {fallback(): Promise<void>}} SaveRoute */

/** @typedef {{url(): string, request(): BrowserRequest, status(): number, json(): Promise<unknown>}} BrowserResponse */

const firstFile = "alpha.js";
const emptyFile = "empty.js";
const initial = Array.from({ length: 180 }, (_, n) => `// line ${n}`).join("\n") + "\nconst needle = 1;";
const putFile = "/api/xo-projects/demo/file";
const viewports = /** @type {const} */ (["desktop", "phone"]);

/** @type {Seed} */
const seed = {
  files: { demo: { [firstFile]: initial, [emptyFile]: "" } },
  routes: {
    "GET /api/xo-projects/demo/github/issues": {
      project_id: "demo", repo: null, fetched_at: null, error: null, issues: [], untracked: 0, tracked: 0, state: "no_remote",
    },
    "GET /api/coworker/xo-projects/demo/paths": {
      root: "/home/test/demo", paths: [firstFile, emptyFile], dirs: [], truncated: false, stamp: "editor-fixture",
    },
  },
};

/** @param {Tools['page']} page @param {string} selector */
const visible = (page, selector) => page.locator(selector).filter({ visible: true }).first();

/** @param {Tools['page']} page */
const editor = (page) => visible(page, '#viewer .cm-content[contenteditable="true"]');

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function boot(t, phone, theme) {
  const { page } = t;
  page.setDefaultTimeout(4500);
  const versionsPath = "/api/xo-projects/demo/versions";
  await page.route((/** @type {URL} */ url) => url.pathname === versionsPath, (/** @type {ReplyRoute} */ route) => {
    const path = new URL(route.request().url()).searchParams.get("relative_path");
    assert.ok(path === firstFile || path === emptyFile);
    return route.fulfill({ json: { relative_path: path, versions: [], head: null, more: false } });
  });
  await page.addInitScript((/** @type {string} */ value) => localStorage.setItem("cv-theme", value), theme);
  await t.open();
  if (phone) await visible(page, "#pb-menu, #top-menu").click();
  await visible(page, '[data-go="p:demo"]').click();
  await visible(page, "[data-stage-toggle]").click();
  const changes = visible(page, '[data-ghost="changes"]');
  if (await changes.count()) await changes.click();
  await visible(page, "[data-open-files]").click();
}

/** @param {Tools['page']} page @param {string} file */
async function openFile(page, file) {
  await visible(page, `[data-fl-file="${file}"]`).press("Enter");
  const content = editor(page);
  await content.waitFor();
  return content;
}

/** @param {Tools['page']} page @param {string} words */
async function append(page, words) {
  await editor(page).press("ControlOrMeta+End");
  await page.keyboard.insertText(words);
}

/** @param {Tools} t @param {(request: SaveRequest, attempt: number, route: SaveRoute) => Promise<void>} reply */
async function interceptSaves(t, reply) {
  /** @type {SaveRequest[]} */
  const writes = [];
  await t.page.route((/** @type {URL} */ url) => url.pathname === putFile, async (/** @type {SaveRoute} */ route) => {
    const request = route.request();
    if (request.method() !== "PUT") return route.fallback();
    const save = request.postDataJSON();
    writes.push(save);
    await reply(save, writes.length, route);
  });
  return writes;
}

/** @param {Tools} t @param {SaveRequest} save @param {number} attempt */
const saved = (t, save, attempt) => ({ relative_path: save.relative_path, version: `sha256:saved-${attempt}`,
  size_bytes: Buffer.byteLength(save.content), saved_at: t.store.now, edit_id: `edit-${attempt}`, unchanged: false });

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function saveWhileTyping(t, phone, theme) {
  const { page } = t;
  const first = /** @type {ReturnType<typeof Promise.withResolvers<void>>} */ (Promise.withResolvers());
  const writes = await interceptSaves(t, async (save, attempt, route) => {
    if (attempt === 1) await first.promise;
    await route.fulfill({ json: saved(t, save, attempt) });
  });
  await boot(t, phone, theme);
  const content = await openFile(page, firstFile);
  const status = page.locator("#viewer .xd-state");
  const toSave = " // first edit";
  const later = " // while saving";
  await append(page, toSave);
  assert.equal(writes.length, 0);
  try {
    await content.press("ControlOrMeta+s");
    await status.filter({ hasText: "Saving" }).waitFor();
    await append(page, later);
  } finally {
    first.resolve();
  }
  await status.filter({ hasText: "Unsaved" }).waitFor();
  assert.match(await content.innerText(), /first edit \/\/ while saving/);
  assert.deepEqual(writes, [{ relative_path: firstFile, content: initial + toSave, base_version: `sha256:e2e-${initial.length}` }]);
  await content.press("ControlOrMeta+s");
  await status.filter({ hasText: /^Saved$/ }).waitFor();
  assert.deepEqual(writes[1], { relative_path: firstFile, content: initial + toSave + later, base_version: "sha256:saved-1" });
  assert.equal(writes.length, 2);
}

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function saveRefusal(t, phone, theme) {
  const { page } = t;
  const writes = await interceptSaves(t, (save, attempt, route) => attempt === 1
    ? route.fulfill({ status: 503, json: { detail: { code: "writer_key_missing", message: "Saving is unavailable" } } })
    : route.fulfill({ json: saved(t, save, attempt) }));
  await boot(t, phone, theme);
  const content = await openFile(page, firstFile);
  await append(page, " // keep this edit");
  const [denied] = await Promise.all([
    page.waitForResponse((/** @type {BrowserResponse} */ response) =>
      new URL(response.url()).pathname === putFile && response.request().method() === "PUT"),
    content.press("ControlOrMeta+s"),
  ]);
  assert.equal(denied.status(), 503);
  assert.deepEqual(await denied.json(), { detail: { code: "writer_key_missing", message: "Saving is unavailable" } });
  assert.deepEqual(writes, [{ relative_path: firstFile, content: initial + " // keep this edit",
    base_version: `sha256:e2e-${initial.length}` }]);
  const status = page.locator("#viewer .xd-state");
  const refusal = status.filter({ hasText: /^Not saved$/ });
  await refusal.waitFor();
  assert.equal(await refusal.getAttribute("title"), "XO Space hasn't enabled saving yet");
  assert.match(await content.innerText(), /keep this edit/);
  assert.equal(await content.evaluate((/** @type {Element} */ node) => node === document.activeElement), true);
  assert.equal(writes.length, 1);
  await content.press("ControlOrMeta+s");
  await status.filter({ hasText: /^Saved$/ }).waitFor();
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[1], writes[0]);
  assert.equal(await refusal.count(), 0);
}

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function closeFind(t, phone, theme) {
  const { page } = t;
  await boot(t, phone, theme);
  const content = await openFile(page, firstFile);
  await content.press("ControlOrMeta+End");
  await page.keyboard.press("ControlOrMeta+f");
  const panel = visible(page, "#viewer .cm-search");
  const search = panel.locator('input[name="search"]');
  await search.pressSequentially("needle");
  await search.press("Enter");
  const match = visible(page, "#viewer .cm-searchMatch-selected");
  await match.waitFor();
  assert.equal(await match.innerText(), "needle");
  const close = panel.getByRole("button", { name: "close", exact: true });
  for (const key of ["Enter", "Space"]) {
    await close.press(key);
    await panel.waitFor({ state: "hidden" });
    assert.equal(await content.evaluate((/** @type {Element} */ node) => node === document.activeElement), true);
    if (key === "Enter") await page.keyboard.press("ControlOrMeta+f");
  }
}

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function findThenEmpty(t, phone, theme) {
  const { page } = t;
  await closeFind(t, phone, theme);
  await page.keyboard.press("ControlOrMeta+p");
  const picker = page.getByRole("dialog", { name: "Go to a file", exact: true });
  const query = picker.getByRole("textbox");
  await query.pressSequentially(emptyFile);
  await picker.getByRole("option", { name: emptyFile, exact: true }).waitFor();
  await query.press("Enter");
  await picker.waitFor({ state: "hidden" });
  const blank = page.locator(`#viewer .cm-content[aria-label="${emptyFile}"]`);
  await blank.waitFor();
  assert.equal((await blank.innerText()).trim(), "");
  await page.waitForFunction((/** @type {string} */ name) => document.activeElement?.getAttribute("aria-label") === name, emptyFile);
  await page.keyboard.insertText("first words in the empty file");
  await blank.getByText("first words in the empty file", { exact: true }).waitFor();
}

/** @type {Omit<Case, "file">[]} */
export const cases = viewports.flatMap((viewport) => ["dark", "light"].flatMap((theme) => {
  const phone = viewport === "phone";
  return [
    { name: `Editor held Save preserves later typing at ${viewport} ${theme}`, viewport, seed,
      run: (/** @type {Tools} */ t) => saveWhileTyping(t, phone, theme) },
    { name: `Editor Save refusal preserves typing and retries at ${viewport} ${theme}`, viewport, seed,
      run: (/** @type {Tools} */ t) => saveRefusal(t, phone, theme) },
    { name: `Editor Find Close restores the caret on Enter and Space at ${viewport} ${theme}`, viewport, seed,
      run: (/** @type {Tools} */ t) => closeFind(t, phone, theme) },
    { name: `Editor Find followed by Quick Open into an empty file at ${viewport} ${theme}`, viewport, seed,
      run: (/** @type {Tools} */ t) => findThenEmpty(t, phone, theme) },
  ];
}));
