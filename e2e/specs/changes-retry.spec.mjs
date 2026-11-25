// @ts-check

import assert from "node:assert/strict";

/** @import {Case, Tools} from "../lib/types.d.ts" */

/** @typedef {{request(): {url(): string}, fulfill(reply: {status?: number, json: unknown}): Promise<void>}} Route */

const viewports = /** @type {const} */ (["desktop", "phone"]);
const changes = "/api/xo-projects/demo/changes";
const path = "example.js";
const before = "const count = 1;";
const after = "const count = 2;";
const change = { path, status: "modified", additions: 1, deletions: 1, binary: false, version: "sha256:change" };
const patch = ["diff --git a/example.js b/example.js", "--- a/example.js", "+++ b/example.js",
  "@@ -1 +1 @@", "-" + before, "+" + after, ""].join("\n");
const seed = {
  files: { demo: { [path]: after + "\n" } },
  routes: {
    "GET /api/xo-projects/demo/github/issues": { repo: null, issues: [] },
    "GET /api/xo-projects/demo/versions": { relative_path: path, versions: [], head: null, more: false },
    "GET /api/coworker/xo-projects/demo/paths": { root: "/home/test/demo", paths: [path], dirs: [], truncated: false, stamp: "fixture" },
  },
};

/** @param {Tools} t */
async function holdPatch(t) {
  const pending = /** @type {ReturnType<typeof Promise.withResolvers<void>>} */ (Promise.withResolvers());
  let reads = 0, retrying = false;
  const body = {
    project_id: "demo", worktree: null, root: "/home/test/demo", base_ref: "HEAD", base_commit: "c0",
    base_source: "head", head_commit: "c1", computed_at: t.store.now, truncated: false, total_files: 1,
  };
  await t.page.route((/** @type {URL} */ url) => url.pathname.endsWith(changes), async (/** @type {Route} */ route) => {
    const file = new URL(route.request().url()).searchParams.get("path");
    if (!file) return route.fulfill({ json: { ...body, files: [{ ...change, patch: null, patch_omitted: "response_budget" }] } });
    assert.equal(file, path);
    reads++;
    if (!retrying) {
      return route.fulfill({ status: 503, json: { detail: { code: "unavailable", message: "Fixture unavailable" } } });
    }
    await pending.promise;
    return route.fulfill({ json: { ...body, files: [{ ...change, patch }] } });
  });
  return { reads: () => reads, beginRetry() { retrying = true; }, release: pending.resolve };
}

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function retry(t, phone, theme) {
  const { page } = t;
  page.setDefaultTimeout(3500);
  const fixture = await holdPatch(t);
  const visible = (/** @type {string} */ selector) => page.locator(selector).filter({ visible: true }).first();

  await page.addInitScript((/** @type {string} */ value) => localStorage.setItem("cv-theme", value), theme);
  await t.open();
  if (phone) await visible("#pb-menu, #top-menu").click();
  await visible('[data-go="p:demo"]').click();
  await visible("[data-stage-toggle]").click();
  const folded = visible('[data-ghost="changes"]');
  if (await folded.count()) await folded.click();
  await visible("[data-open-files]").click();
  await visible(`[data-fl-change="${path}"]`).click();
  const body = page.locator("#viewer .vw-diff");
  const error = body.getByRole("alert").filter({ hasText: /Couldn't read this change/ });
  try {
    await error.waitFor();
  } catch (cause) {
    const viewer = await page.evaluate(() => document.getElementById("viewer")?.innerText.slice(0, 300));
    throw new Error(`Changes refusal rendered after ${fixture.reads()} patch reads: ${JSON.stringify(viewer)}`, { cause });
  }
  const failedReads = fixture.reads();
  assert.ok(failedReads > 0);
  await t.settle();
  assert.equal(await error.isVisible(), true);
  assert.equal(fixture.reads(), failedReads);
  const selectedChanges = visible('#viewer .vw-seg [data-vw-show="changes"][aria-pressed="true"]');
  for (let i = 0; i < 2; i++) {
    await selectedChanges.press("Enter");
    await t.settle();
    assert.equal(await error.isVisible(), true, "the refusal stays visible across a Changes redraw");
    assert.equal(fixture.reads(), failedReads, "redrawing the selected Changes view does not reread the patch");
  }
  try {
    fixture.beginRetry();
    await body.getByRole("button", { name: "Try again" }).press("Enter");
    await body.getByRole("status").filter({ hasText: /Reading the change/ }).waitFor();
    await page.waitForFunction(() => !!document.activeElement?.matches("#viewer .vw-diff"));
  } finally {
    fixture.release();
  }
  await body.locator("diffs-container").getByText(after, { exact: true }).waitFor();
  assert.equal(await body.evaluate((/** @type {Element} */ node) => node === document.activeElement), true);
  assert.equal(fixture.reads(), failedReads + 1);
}

/** @type {Omit<Case, "file">[]} */
export const cases = viewports.flatMap((viewport) => ["dark", "light"].map((theme) => ({
  name: `Changes read refusal and keyboard retry at ${viewport} ${theme}`, viewport, seed,
  run: (/** @type {Tools} */ t) => retry(t, viewport === "phone", theme),
})));
