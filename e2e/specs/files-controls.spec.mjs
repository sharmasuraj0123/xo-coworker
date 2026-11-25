// @ts-check

import assert from "node:assert/strict";

/** @import {Case, Tools} from "../lib/types.d.ts" */

/** @typedef {{request(): {url(): string}, abort(code: string): Promise<void>, fallback(): Promise<void>}} TreeRoute */

const viewports = /** @type {const} */ (["desktop", "phone"]);
const project = "demo";
const tree = `**/api/xo-projects/${project}/tree*`;
const sample = "export const fixture = true;\n";

/** @param {Tools["page"]} page @param {string} selector */
function visible(page, selector) {
  return page.locator(selector).filter({ visible: true }).first();
}

/** @param {Tools} t @param {boolean} phone @param {string} theme @param {boolean} [workspace] */
async function openFiles(t, phone, theme, workspace = false) {
  const { page } = t;
  t.store.routes[`GET /api/xo-projects/${project}/github/issues`] = { repo: null, issues: [] };
  t.store.routes[`GET /api/xo-projects/${project}/versions`] = { relative_path: "example.js", versions: [], head: null, more: false };
  t.store.routes[`GET /api/coworker/xo-projects/${project}/paths`] = {
    root: "/home/test/demo", paths: Object.keys(t.store.files[project] || {}), dirs: ["bad"], truncated: false, stamp: "fixture",
  };
  await page.addInitScript((/** @type {string} */ value) => localStorage.setItem("cv-theme", value), theme);
  await t.open();
  if (phone) await visible(page, "#pb-menu, #top-menu").click();
  await visible(page, workspace ? '[data-go="ws"]' : '[data-go="p:demo"]').click();
  await visible(page, "[data-stage-toggle]").click();
  const changes = visible(page, '[data-ghost="changes"]');
  if (await changes.count()) await changes.click();
  await visible(page, "[data-open-files]").click();
}

/** @param {Tools} t @param {string} selector */
async function focus(t, selector) {
  await t.page.waitForFunction((/** @type {string} */ target) => !!document.activeElement?.matches(target), selector);
}

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function openFile(t, phone, theme) {
  const { page } = t;
  await openFiles(t, phone, theme);
  const row = visible(page, '[data-fl-file="example.js"]');
  await row.focus();
  assert.equal(await row.evaluate((/** @type {Element} */ node) => node === document.activeElement), true);
  await page.keyboard.press("Enter");
  await page.locator("#viewer .cm-content").getByText(sample.trim(), { exact: true }).waitFor();
  await t.settle();
  const active = await page.evaluate(() => {
    const node = document.activeElement;
    const inViewer = !!node?.closest("#viewer");
    const shown = !!node?.getClientRects().length && getComputedStyle(node).visibility === "visible";
    return { inViewer, shown, tag: node?.tagName, classes: node?.className };
  });
  assert.equal(active.inViewer && active.shown, true, `keyboard file open focuses the visible viewer: ${JSON.stringify(active)}`);
}

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function projects(t, phone, theme) {
  const { page } = t;
  await openFiles(t, phone, theme, true);
  const pick = '[data-fl-pick="demo"]';
  await visible(page, pick).press("Enter");
  await visible(page, '[data-fl-file="example.js"]').waitFor();
  await page.waitForFunction(() => !!document.activeElement?.closest(".fl")
    && [...document.activeElement.attributes].some((attribute) => attribute.name.startsWith("data-fl-")));
  await visible(page, "[data-fl-unpick]").press("Enter");
  await focus(t, pick);
}

/** @param {Tools["page"]} page @param {string} selector @param {number} height */
async function retrySize(page, selector, height) {
  const size = await visible(page, selector).evaluate((/** @type {Element} */ button) => {
    const rect = button.getBoundingClientRect(), range = document.createRange();
    range.selectNodeContents(button);
    return { width: rect.width, height: rect.height, lines: new Set([...range.getClientRects()].map((part) => Math.round(part.top))).size };
  });
  assert.ok(size.width >= 44 && size.height >= height && size.lines === 1, JSON.stringify(size));
}

/** @param {Tools} t @param {boolean} phone @param {string} theme @param {string} folder */
async function retryTree(t, phone, theme, folder) {
  const { page } = t;
  const release = /** @type {ReturnType<typeof Promise.withResolvers<void>>} */ (Promise.withResolvers());
  const retry = `[data-fl-retry="${folder}"]`;
  let accepting = false, retried = 0;
  await page.route(tree, async (/** @type {TreeRoute} */ route) => {
    const path = new URL(route.request().url()).searchParams.get("relative_path") || "";
    if (path !== folder) return route.fallback();
    if (!accepting) return route.abort("connectionrefused");
    retried++;
    await release.promise;
    return route.fallback();
  });
  await openFiles(t, phone, theme);
  if (folder) await visible(page, `[data-fl-dir="${folder}"]`).click();
  const button = visible(page, retry);
  await button.waitFor();
  await retrySize(page, retry, phone ? 36 : 32);
  const oldInk = await visible(page, ".fl-tree .fl-note.is-err").evaluate((/** @type {Element} */ el) => getComputedStyle(el).color);
  accepting = true;
  try {
    await button.press("Enter");
    const pending = visible(page, ".fl-tree .fl-note.is-pending");
    await pending.getByText(/Reading again/).waitFor();
    assert.equal(await button.getAttribute("aria-busy"), "true");
    assert.notEqual(await pending.evaluate((/** @type {Element} */ el) => getComputedStyle(el).color), oldInk);
    await retrySize(page, retry, phone ? 36 : 32);
    await focus(t, retry);
  } finally {
    release.resolve();
  }
  if (folder) {
    await visible(page, '[data-fl-file="bad/inside.md"]').waitFor();
    await page.waitForFunction(() => !!document.activeElement?.closest(".fl"));
  } else {
    await focus(t, "[data-fl-new]");
  }
  assert.ok(retried >= 1);
}

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function dividers(t, phone, theme) {
  const { page } = t;
  await openFiles(t, phone, theme);
  await visible(page, '[data-fl-file="example.js"]').click();
  await page.keyboard.press("Shift");
  const grip = visible(page, ".stg-grip");
  await grip.focus();
  const outline = await grip.evaluate((/** @type {Element} */ node) => {
    const style = getComputedStyle(node);
    return [style.outlineStyle, style.outlineWidth];
  });
  assert.deepEqual(outline, ["solid", "2px"]);
  const box = await grip.boundingBox();
  assert.ok(box);
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x - 175, y, { steps: 5 });
  await page.mouse.up();
  await page.locator(".fv .fl.is-wide").waitFor();
  const divider = visible(page, ".fv .fl.is-wide .fl-split");
  if (!(await divider.count())) await page.keyboard.press("ControlOrMeta+b");
  await divider.waitFor();
  const hit = await divider.evaluate((/** @type {Element} */ node) => {
    const rect = node.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    return [-3, 3].map((offset) => document.elementFromPoint(rect.left + offset, center) === node);
  });
  assert.deepEqual(hit, [true, true]);
  await divider.focus();
  const ring = await divider.evaluate((/** @type {Element} */ node) => getComputedStyle(node, "::after").boxShadow);
  assert.match(ring, /inset/);
}

/** @type {Omit<Case, "file">[]} */
export const cases = viewports.flatMap((viewport) => ["dark", "light"].flatMap((theme) => {
  const phone = viewport === "phone";
  const seed = { files: { demo: { "example.js": sample, "bad/inside.md": "Fixture folder\n" } } };
  return [
    ...phone && theme === "light" ? [{ name: "Files keyboard open focuses the visible viewer on phone light", viewport, seed,
      run: (/** @type {Tools} */ t) => openFile(t, phone, theme) }] : [],
    { name: `Files workspace picker focus at ${viewport} ${theme}`, viewport, seed,
      run: (/** @type {Tools} */ t) => projects(t, phone, theme) },
    { name: `Files folder read pending and retry at ${viewport} ${theme}`, viewport, seed,
      run: (/** @type {Tools} */ t) => retryTree(t, phone, theme, "bad") },
    { name: `Files empty root read pending and retry at ${viewport} ${theme}`, viewport,
      run: (/** @type {Tools} */ t) => retryTree(t, phone, theme, "") },
    ...phone ? [] : [{ name: `Files divider and Stage grip at ${theme}`, viewport, seed,
      run: (/** @type {Tools} */ t) => dividers(t, phone, theme) }],
  ];
}));
