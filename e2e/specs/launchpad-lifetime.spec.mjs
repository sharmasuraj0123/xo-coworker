// @ts-check

import assert from "node:assert/strict";
import { openLaunchpad, setup } from "./launchpad-controls.spec.mjs";

/** @import { Case, Tools } from "../lib/types.d.ts" */

/** @typedef {{url(): string, method(): string}} Request */

/** @typedef {{status?: number, json?: unknown, contentType?: string, body?: string}} Reply */

/** @typedef {{request(): Request, fulfill(reply: Reply): Promise<void>, fallback(): Promise<void>}} Route */

const deploy = "/api/deploy/demo";
const check = `GET ${deploy}/check`;
const runId = "demo-building";

const viewports = /** @type {const} */ (["desktop", "phone"]);

/** @type {Omit<Case, 'file'>[]} */
export const cases = viewports.flatMap((viewport) => ["dark", "light"].flatMap((theme) => [
  {
    name: `Launchpad deploy Undo cancels the request at ${viewport} ${theme}`, viewport, seed: setup,
    async run(/** @type {Tools} */ t) {
      await openLaunchpad(t, viewport === "phone", theme);
      await undoDeploy(t);
    },
  },
  .../** @type {const} */ (["confirmed", "refused", "unconfirmed"]).map((outcome) => ({
    name: `Launchpad stopped or retained after a ${outcome} response at ${viewport} ${theme}`,
    viewport, seed: setup,
    async run(/** @type {Tools} */ t) {
      await watch(t);
      await openLaunchpad(t, viewport === "phone", theme, "run");
      await stopDeploy(t, outcome);
    },
  })),
]));

/** @param {Tools} t @param {string} control */
async function focus(t, control) {
  await t.page.waitForFunction((/** @type {string} */ action) => document.activeElement?.getAttribute("data-lp") === action, control);
}

/** @param {Tools} t @param {RegExp} words */
async function announcement(t, words) {
  await t.page.locator("#live").filter({ hasText: words }).waitFor({ state: "attached" });
}

/** @param {Tools} t */
async function undoDeploy(t) {
  const { page } = t;
  await page.locator('[data-lp="deploy"]').click();
  const undo = page.locator('[data-lp="undo"]');
  await undo.waitFor();
  await focus(t, "undo");
  await page.keyboard.press("Enter");
  await focus(t, "deploy");
  await announcement(t, /Deploy undone/);
  await page.locator('.lp[data-screen="setup"]').waitFor();
  await page.clock.setFixedTime(new Date(Date.parse(t.store.now) + 3200));
  await page.waitForTimeout(250);
  const writes = t.store.writes.filter((write) => write.method === "POST" && write.path === deploy);
  assert.deepEqual(writes, []);
}

/** @param {Tools} t */
async function watch(t) {
  t.store.routes[check] = { ...setup.routes[check], running: { run_id: runId, kind: "deploy" } };
  await t.page.route(`**${deploy}/watch*`, (/** @type {Route} */ route) => {
    const ts = t.store.now, run_id = runId;
    const frames = [
      { type: "run", ts, run_id, seq: 1, kind: "deploy", attached: true, started_at: ts },
      { type: "step", ts, run_id, seq: 2, step: "build", status: "running", message: "Building the fixture" },
    ];
    const body = frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join("");
    return route.fulfill({ contentType: "text/event-stream", body });
  });
}

/** @param {Tools} t @param {"confirmed" | "refused" | "unconfirmed"} outcome */
async function stopDeploy(t, outcome) {
  const { page } = t;
  const screen = page.locator(".lp");
  const stop = screen.locator('[data-lp="stop"]');
  await stop.waitFor();
  await screen.getByText("GitHub Actions is building the image.", { exact: true }).waitFor();
  const release = /** @type {ReturnType<typeof Promise.withResolvers<void>>} */ (Promise.withResolvers());
  let calls = 0;
  await page.route(`**${deploy}`, async (/** @type {Route} */ route) => {
    if (route.request().method() !== "DELETE") return route.fallback();
    calls += 1;
    await release.promise;
    if (outcome === "refused") {
      return route.fulfill({ status: 503, json: { detail: { code: "fixture_offline", message: "Fixture offline" } } });
    }
    if (outcome === "confirmed") {
      t.store.routes[check] = setup.routes[check];
      return route.fulfill({ json: { stopped: true, run_id: runId } });
    }
    return route.fulfill({ json: { stopped: false } });
  });
  try {
    if (outcome === "confirmed") {
      const resumed = page.waitForRequest((/** @type {Request} */ request) => {
        const url = new URL(request.url());
        return url.pathname === `${deploy}/watch` && url.searchParams.get("run") === runId && url.searchParams.get("after") === "2";
      });
      await stop.click();
      const keep = screen.getByRole("button", { name: "Keep deploying" });
      await keep.waitFor();
      await focus(t, "stop-undo");
      assert.match(await screen.locator(".lp-q").innerText(), /Stops in [123] s\./);
      await page.keyboard.press("Enter");
      await focus(t, "stop");
      await announcement(t, /deploy carries on/);
      await resumed;
      assert.equal(calls, 0);
    }
    const sent = page.waitForRequest((/** @type {Request} */ request) => request.method() === "DELETE"
      && new URL(request.url()).pathname === deploy);
    await stop.press("Enter");
    await focus(t, "stop-undo");
    await screen.getByRole("button", { name: "Stopping…" }).waitFor();
    await focus(t, "stop");
    await screen.getByText("Stopping… it stops once Space confirms.").waitFor();
    await sent;
  } finally {
    release.resolve();
  }
  if (outcome === "confirmed") {
    await stop.waitFor({ state: "hidden" });
    await announcement(t, /Deploy stopped/);
  } else {
    await screen.getByRole("button", { name: "Stop again" }).waitFor();
    await focus(t, "stop");
    await announcement(t, /Couldn't stop the deploy/);
  }
  assert.equal(calls, 1);
}
