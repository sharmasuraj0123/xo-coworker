// @ts-check

import assert from "node:assert/strict";

/** @import {Case, Seed, Tools} from "../lib/types.d.ts" */

const stamp = Date.parse("2026-11-19T12:00:00Z");
const wideName = "quarterly-research-findings-for-the-board-final-draft.md";
const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNomLAAAANEAbF61zYUAAAAAElFTkSuQmCC", "base64");
const viewports = /** @type {const} */ (["desktop", "phone"]);

/** @param {{ fulfill(reply: object): Promise<void> }} route */
const servePixel = (route) => route.fulfill({ status: 200, contentType: "image/png", body: pixel });

/** @param {string} id @param {string} name @param {string} project @param {string} mime @param {number} [minute] */
function file(id, name, project, mime, minute = 0) {
  const time = new Date(stamp - minute * 60_000).toISOString();
  return { id, name, path: name, relative_path: name, project_id: project, mime, bytes: 10, created_at: time, updated_at: time };
}

/** @param {boolean} longList @returns {Seed} */
function gallerySeed(longList) {
  const notes = [file("lead", wideName, "demo", "text/markdown"), file("note", "notes.md", "demo", "text/markdown", 1)];
  const others = longList ? Array.from({ length: 98 }, (_, i) => file(`row-${i}`, `note-${i}.md`, "demo", "text/markdown", i + 2)) : [];
  const demo = [...notes, ...others];
  return {
    chats: [{ id: "chat_ws", kind: "workspace" }, { id: "chat_demo", kind: "project", project: "demo" },
      { id: "chat_research", kind: "project", project: "research" }],
    files: { demo: Object.fromEntries(demo.map(({ path }) => [path, "Fixture notes.\n"])) },
    routes: {
      "GET /api/chat/chats/chat_demo/made": { made: demo, next_before: null },
      "GET /api/chat/chats/chat_research/made": { made: [file("picture", "shot.png", "research", "image/png")], next_before: null },
      "GET /api/xo-projects/demo/github/issues": { repo: null, issues: [] },
      "GET /api/xo-projects/research/github/issues": { repo: null, issues: [] },
      "PUT /api/chat/chats/chat_demo/made/note/pin": { pinned: true },
      "PUT /api/chat/chats/chat_demo/made/row-48/pin": { pinned: true },
    },
  };
}

/** @param {Tools} t @param {string} theme */
async function open(t, theme) {
  await t.page.addInitScript((/** @type {string} */ value) => localStorage.setItem("cv-theme", value), theme);
  await t.page.route("**/api/xo-projects/research/image?*", servePixel);
  await t.open();
}

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function gallery(t, phone, theme) {
  await open(t, theme);
  if (phone) await t.page.locator("#pb-menu, #top-menu").filter({ visible: true }).first().click();
  await t.page.locator('[data-go="artifacts"]').filter({ visible: true }).first().click();
  await t.page.locator('#arts-body [data-k="lead"]').waitFor();
  await t.settle();
}

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function kinds(t, phone, theme) {
  await gallery(t, phone, theme);
  const { page } = t;
  const group = page.getByRole("radiogroup", { name: "Show" });
  await group.locator('[data-arts-kind="all"]').press("ArrowRight");
  const docs = group.locator('[data-arts-kind="doc"][aria-checked="true"]');
  await docs.waitFor();
  assert.equal(await docs.evaluate((/** @type {Element} */ node) => node === document.activeElement), true);
  assert.equal(await group.locator('[role="radio"]:not([tabindex="-1"])').count(), 1);
  await docs.press("ArrowRight");
  const images = group.locator('[data-arts-kind="image"][aria-checked="true"]');
  await images.waitFor();
  assert.equal(await images.evaluate((/** @type {Element} */ node) => node === document.activeElement), true);
  await page.locator("#arts-pj").getByRole("combobox").click();
  await page.locator("#arts-pj").getByRole("option", { name: /^demo$/i }).click();
  await page.getByText("No images in this project.", { exact: true }).waitFor();
  assert.equal(await images.count(), 1);
  assert.equal(await group.locator('[role="radio"]:not([tabindex="-1"])').count(), 1);
}

/** @param {Tools} t @param {string} theme */
async function phoneRows(t, theme) {
  await gallery(t, true, theme);
  const { page } = t;
  const lead = page.locator('#arts-body [data-k="lead"]');
  const other = page.locator('#arts-body [data-k="note"]');
  const nextHeight = (await other.boundingBox())?.height;
  const layout = await lead.evaluate((/** @type {HTMLElement} */ card) => {
    const box = card.getBoundingClientRect();
    const name = card.querySelector(".md-meta b")?.getBoundingClientRect();
    const pin = card.querySelector(".md-pin")?.getBoundingClientRect();
    const openButton = card.querySelector(".md-open")?.getBoundingClientRect();
    return { width: box.width, height: box.height, nameWidth: name?.width ?? 0, nameHeight: name?.height ?? 0,
      pinWidth: pin?.width, pinLeft: pin?.left, openRight: openButton?.right,
      viewportWidth: innerWidth, pageWidth: document.documentElement.scrollWidth };
  });
  await page.locator('[data-arts-kind="image"]').click();
  const picture = page.locator('#arts-body [data-k="picture"] .k-image img');
  await picture.waitFor();
  await page.waitForFunction(() => {
    const img = document.querySelector('#arts-body [data-k="picture"] .k-image img');
    return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0;
  });
  const columns = await page.locator("#arts-body .ar-grid").first().evaluate((/** @type {Element} */ row) =>
    getComputedStyle(row).gridTemplateColumns.split(" ").length);
  const geometry = JSON.stringify(layout);
  assert.equal(columns, 2);
  assert.ok(layout.width > 300 && layout.nameWidth >= 220 && layout.nameHeight <= 40, geometry);
  assert.equal(layout.height, nextHeight, geometry);
  assert.equal(layout.pinWidth, 44, geometry);
  assert.equal(layout.openRight - layout.pinLeft, 4, geometry);
  assert.ok(layout.pageWidth <= layout.viewportWidth, geometry);
}

/** @param {Tools} t @param {boolean} phone @param {string} theme @param {string} key */
async function pinCard(t, phone, theme, key) {
  await gallery(t, phone, theme);
  const { page, store } = t;
  const card = page.locator(`#arts-body [data-k="${key}"]`);
  if (key !== "note") {
    await page.locator("#arts").hover();
    for (let i = 0; i < 10 && !await card.count(); i++) {
      await page.mouse.wheel(0, 480);
      await t.settle();
    }
  }
  const pin = card.locator(".md-pin");
  await pin.press("Enter");
  const pinned = card.locator('.md-pin[aria-pressed="true"]');
  await pinned.waitFor();
  await t.settle();
  assert.equal(await pinned.evaluate((/** @type {Element} */ node) => node === document.activeElement), true);
  if (key !== "note") {
    await page.mouse.wheel(0, -4800);
    await page.getByRole("heading", { name: "Pinned", exact: true }).waitFor();
    await t.settle();
  }
  const heading = await pinned.evaluate((/** @type {Element} */ node) => {
    let line = node.closest(".ar-line")?.previousElementSibling;
    while (line && line.tagName !== "H2") line = line.previousElementSibling;
    return line?.textContent;
  });
  assert.equal(heading, "Pinned");
  assert.equal(await card.count(), 1);
  const writes = store.writes.filter(({ path }) => path.endsWith(`/made/${key}/pin`));
  assert.deepEqual(writes.map(({ method }) => method), ["PUT"]);
}

/** @param {Tools} t @param {string} theme */
async function jump(t, theme) {
  await open(t, theme);
  const { page } = t;
  await page.keyboard.press("Control+k");
  await page.locator("#jump-q").fill("Artifacts");
  await page.locator("#jump-list").getByText("Artifacts", { exact: true }).waitFor();
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: "Artifacts", exact: true }).waitFor();
  await page.waitForFunction(() => !!document.activeElement?.closest("#arts"));
}

/** @type {Omit<Case, "file">[]} */
export const cases = viewports.flatMap((viewport) => ["dark", "light"].flatMap((theme) => {
  const phone = viewport === "phone";
  const seed = gallerySeed(false);
  return [
    { name: `Artifacts native kind navigation and empty selected kind at ${viewport} ${theme}`, viewport, seed,
      run: (/** @type {Tools} */ t) => kinds(t, phone, theme) },
    { name: `Artifacts pin relocates a single card and keeps focus at ${viewport} ${theme}`, viewport, seed,
      run: (/** @type {Tools} */ t) => pinCard(t, phone, theme, "note") },
    ...phone ? [
      { name: `Artifacts narrow rows and image grid at ${theme}`, viewport, seed,
        run: (/** @type {Tools} */ t) => phoneRows(t, theme) },
      { name: `Artifacts pin relocates an offscreen virtualized card at ${theme}`, viewport, seed: gallerySeed(true),
        run: (/** @type {Tools} */ t) => pinCard(t, true, theme, "row-48") },
    ] : [
      { name: `Artifacts keyboard Jump transfers focus at ${theme}`, viewport, seed,
        run: (/** @type {Tools} */ t) => jump(t, theme) },
    ],
  ];
}));
