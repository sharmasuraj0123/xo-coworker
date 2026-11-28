// @ts-check

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

/** @import { Case, Seed, Tools } from "../lib/types.d.ts" */

/** @typedef {{method(): string, postDataJSON(): unknown}} DeployRequest */

/** @typedef {{contentType: string, body: string}} DeployReply */

/** @typedef {{request(): DeployRequest, fallback(): Promise<void>, fulfill(reply: DeployReply): Promise<void>}} DeployRoute */

const { SCENARIOS } = createRequire(import.meta.url)("../fixtures/mockspace-harness.cjs");
const basic = /** @type {Seed} */ (JSON.parse(readFileSync(new URL("../seeds/basic.json", import.meta.url), "utf8")));

const viewports = /** @type {const} */ (["desktop", "phone"]);
const deploy = "/api/deploy/demo";
const preflight = {
  state: "ready", github: SCENARIOS.live.pre.github, repo: SCENARIOS.live.pre.repo,
  launchpad: { key: true, cli: true, name_free: true, sizes: {
    tiers: [{ name: "xo.small", label: "Small", cpu: 1, memory_gb: 2 }, { name: "xo.medium", label: "Medium", cpu: 2, memory_gb: 4 }],
    default: "xo.small", source: "template",
  } },
};
export const setup = { ...basic, routes: { ...basic.routes, [`GET ${deploy}/check`]: SCENARIOS.ready.check,
  [`GET ${deploy}/preflight`]: preflight } };

/** @param {Tools} t @param {boolean} phone @param {string} theme @param {"setup" | "run"} [screen] */
export async function openLaunchpad(t, phone, theme, screen = "setup") {
  const { page } = t;
  await page.addInitScript((/** @type {string} */ value) => localStorage.setItem("cv-theme", value), theme);
  await t.open();
  if (phone) await page.locator("#pb-menu").click();
  await page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: "demo" }).click();
  await page.locator("[data-lp-open]").click();
  await page.locator(`.lp[data-screen="${screen}"]`).waitFor();
}

/** @param {Tools} t @param {boolean} phone */
async function sizes(t, phone) {
  const { page } = t;
  await page.locator('[data-lp="machine-open"]').click();
  const size = page.locator('xo-select[data-lp-f="size"]');
  const button = size.locator(".dd-btn");
  await button.waitFor();
  assert.equal(await page.locator(".lp select").count(), 0);
  assert.equal(await button.getAttribute("aria-describedby"), "lp-h-size");
  assert.equal(await button.evaluate((/** @type {Element} */ el) => el === document.activeElement), true);
  await button.press("Space");
  await size.locator(".dd-menu:not([hidden])").waitFor();
  await page.keyboard.press("Escape");
  await size.locator(".dd-menu").waitFor({ state: "hidden" });
  await page.locator('.lp[data-screen="setup"]').waitFor();
  assert.equal(await button.evaluate((/** @type {Element} */ el) => el === document.activeElement), true);
  const heights = await page.locator(".lp :is(.lp-in, xo-select .dd-btn)").filter({ visible: true })
    .evaluateAll((/** @type {HTMLElement[]} */ controls) => controls.map((control) => Math.round(control.getBoundingClientRect().height)));
  assert.deepEqual(heights, [40, 40, phone ? 36 : 32, 40, 40], "Size and field heights");
  await button.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.equal(await size.evaluate((/** @type {Element & {value: string}} */ el) => el.value), "xo.medium");

  assert.equal(await button.evaluate((/** @type {Element} */ el) => el === document.activeElement), true);
  assert.match(await page.locator("#lp-h-size").innerText(), /Fixed once it's created/);
  assert.equal(await page.locator('[data-lp="undo"]').count(), 0);
  assert.equal(t.store.writes.filter((write) => write.path === deploy).length, 0);
}

/** @param {Tools} t @param {string} theme */
async function deployWithSize(t, theme) {
  const { page } = t;
  /** @type {unknown[]} */
  const payloads = [];

  await page.route(`**${deploy}`, async (/** @type {DeployRoute} */ route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.fallback();
    const payload = request.postDataJSON();
    assert.ok(payload && typeof payload === "object" && "size" in payload);
    payloads.push(payload.size);
    const ts = t.store.now, run_id = "launchpad-size";
    const frames = [
      { type: "run", ts, run_id, kind: "deploy", attached: false, started_at: ts },
      { type: "error", ts, run_id, step: "app", code: "size_not_allowed", message: "Size not allowed", fix: "", data: {} },
    ];
    return route.fulfill({ contentType: "text/event-stream", body: frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join("") });
  });
  await page.locator('[data-lp="deploy"]').click();
  await page.locator('[data-lp="undo"]').waitFor();
  assert.equal(payloads.length, 0);
  await page.clock.setFixedTime(new Date(Date.parse(t.store.now) + 3100));
  const size = page.locator('xo-select[data-lp-f="size"]');
  const button = size.locator(".dd-btn");
  await size.locator('.dd-btn[aria-invalid="true"]').waitFor();
  assert.deepEqual(payloads, ["xo.medium"]);
  assert.equal(await button.evaluate((/** @type {Element} */ el) => el === document.activeElement), true);
  const hint = page.locator("#lp-h-size");
  assert.match(await hint.innerText(), /doesn't allow this size for this app\. Pick another\./);
  if (theme === "dark") assert.ok(await invalidEdge(button) > 40, "dark theme uses a red invalid edge");
  await button.press("ArrowDown");
  await page.keyboard.press("Home");
  await page.keyboard.press("Enter");
  await size.locator('.dd-btn:not([aria-invalid="true"])').waitFor();
  const defaultHint = "The default; fixed once created.";
  assert.equal(await hint.innerText(), defaultHint);
  await page.locator('[data-lp="disk-add"]').click();
  await page.locator('[data-lp-f="diskPath"]').waitFor();
  assert.equal(await size.evaluate((/** @type {Element & {value: string}} */ el) => el.value), "xo.small");
  assert.equal(await page.locator('.lp [aria-invalid="true"]').count(), 0);
  assert.equal(await hint.innerText(), defaultHint);
}

/** @param {{evaluate(fn: (element: Element) => number): Promise<number>}} button */
async function invalidEdge(button) {
  return button.evaluate((/** @type {Element} */ el) => {
    const context = document.createElement("canvas").getContext("2d");
    if (!context) return 0;
    context.fillStyle = getComputedStyle(el).borderTopColor;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return r - Math.max(g, b);
  });
}

/** @param {Tools} t @param {boolean} phone */
async function invalidHints(t, phone) {
  const { page } = t;
  await page.locator('[data-lp-f="name"]').fill("Bad Name!");
  await page.locator('[data-lp-f="port"]').fill("99999");
  await page.locator('[data-lp="deploy"]').click();
  const name = page.locator('[data-lp-f="name"][aria-invalid="true"]');
  await name.waitFor();
  assert.equal(await name.evaluate((/** @type {Element} */ el) => el === document.activeElement), true);
  assert.match(await page.locator("#lp-h-port").innerText(), /A port from 1 to 65535/);
  const clipped = await page.locator(".lp .lp-hint").evaluateAll((/** @type {HTMLElement[]} */ hints) => hints
    .filter((hint) => hint.scrollWidth > hint.clientWidth + 1 || !hint.getClientRects().length).map((hint) => hint.id));
  assert.deepEqual(clipped, [], "visible text fits in every Launchpad hint");
  const placed = await page.evaluate(() => ["name", "port"].every((key) => {
    const field = document.querySelector(`[data-lp-f="${key}"]`)?.getBoundingClientRect();
    const hint = document.getElementById(`lp-h-${key}`);
    const rect = hint?.getBoundingClientRect();
    return !!field && !!hint && !!rect && rect.height > 0 && hint.scrollWidth <= hint.clientWidth + 1
      && rect.top >= field.bottom - 1 && Math.abs(rect.left - field.left) < 2;
  }));
  assert.equal(placed, true);
  const heights = await page.locator(".lp :is(.lp-in, .lp-go, .lp-b, .lp-a, .lp-ib)").filter({ visible: true })
    .evaluateAll((/** @type {HTMLElement[]} */ controls) => controls.map((control) => Math.round(control.getBoundingClientRect().height)));
  const compact = phone ? 36 : 32;
  assert.deepEqual(heights, [40, 40, compact, 40, 40, 56, compact, 40], "Launchpad control heights");
  assert.equal(t.store.writes.filter((write) => write.path === deploy).length, 0);
}

/** @type {Omit<Case, 'file'>[]} */
export const cases = viewports.flatMap((viewport) => ["dark", "light"].flatMap((theme) => [
  {
    name: `Launchpad invalid hint geometry at ${viewport} ${theme}`, viewport, seed: setup,
    async run(/** @type {Tools} */ t) {
      await openLaunchpad(t, viewport === "phone", theme);
      await invalidHints(t, viewport === "phone");
    },
  },
  {
    name: `Launchpad Size keyboard handling and refusal at ${viewport} ${theme}`, viewport, seed: setup,
    async run(/** @type {Tools} */ t) {
      await openLaunchpad(t, viewport === "phone", theme);
      await sizes(t, viewport === "phone");
      await deployWithSize(t, theme);
    },
  },
]));
