// @ts-check

import assert from "node:assert/strict";
import { openLaunchpad, setup } from "./launchpad-controls.spec.mjs";

/** @import { Case, Tools } from "../lib/types.d.ts" */

const deploy = "/api/deploy/demo";
const suggestion = "demo-next";
const namedRepo = "fixtures/launchpad-demo";
const origin = "fixtures/demo";
const apps = [{ id: "app_demo", slug: "launchpad-demo" }, { id: "deploy-staging.yml", slug: null }];

/** @param {Tools} t @param {Record<string, unknown>} decision */
async function installDeploy(t, decision) {
  const { page } = t;
  /** @type {Record<string, unknown>[]} */
  const requests = [];
  await page.route(`**${deploy}`, async (/** @type {any} */ route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.fallback();
    requests.push(request.postDataJSON());
    const ts = t.store.now, run_id = "launchpad-name";
    const frames = [
      { type: "run", ts, run_id, kind: "deploy", attached: false, started_at: ts },
      requests.length === 1 ? { type: "needs", ts, run_id, ...decision }
        : { type: "error", ts, run_id, step: "check", code: "fixture_stop", message: "Local test ended." },
    ];
    const body = frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join("");
    return route.fulfill({ contentType: "text/event-stream", body });
  });
  return requests;
}

/** @param {Tools} t @param {number} elapsed */
async function passUndo(t, elapsed) {
  await t.page.locator('[data-lp="undo"]').waitFor();
  await t.page.clock.setFixedTime(new Date(Date.parse(t.store.now) + elapsed));
}

/** @param {Tools} t @param {"name_taken" | "repo_name_taken"} code */
async function startDeploy(t, code) {
  const requests = await installDeploy(t, { step: code === "name_taken" ? "app" : "repo",
    code, message: "This name is already taken.", options: [], data: { suggestion } });
  const { page } = t;
  await page.locator('[data-lp="deploy"]').click();
  assert.equal(requests.length, 0);
  await passUndo(t, 3100);
  return requests;
}

/** @param {Tools} t @param {boolean} phone */
async function appName(t, phone) {
  const { page } = t;
  const requests = await startDeploy(t, "name_taken");
  const name = page.locator('[data-lp-f="name"]');
  const use = page.getByRole("button", { name: `Use ${suggestion}` });
  await use.waitFor();
  assert.equal(requests.length, 1);
  const hint = page.locator("#lp-h-name");
  assert.equal(await hint.innerText(), "Taken on Launchpad.");
  const hintBox = await hint.boundingBox(), useBox = await use.boundingBox();
  assert.ok(hintBox && useBox);
  assert.ok(useBox.y >= hintBox.y + hintBox.height - 1);
  assert.ok(Math.abs(useBox.x - hintBox.x) < 2);
  assert.equal(Math.round(useBox.height), phone ? 36 : 32);
  await use.click();
  await use.waitFor({ state: "hidden" });
  assert.equal(await name.inputValue(), suggestion);
  assert.equal(await name.getAttribute("aria-invalid"), null);
}

/** @param {Tools} t */
async function repoName(t) {
  const { page } = t;
  const requests = await startDeploy(t, "repo_name_taken");
  const repo = page.locator('[data-lp-f="repo"]');
  await repo.and(page.locator('[aria-invalid="true"]')).waitFor();
  assert.equal(requests.length, 1);
  const picked = "demo-tooling";
  await repo.fill(picked);
  await page.locator('[data-lp="env-all"]').click();
  assert.equal(await repo.inputValue(), picked);
  assert.equal(await repo.getAttribute("aria-invalid"), null);
  assert.equal(await page.locator("#lp-h-repo").innerText(), "A new repository on your GitHub.");
}

const repoDecision = {
  action: "confirm_repo", code: "confirm_repo", step: "repo", data: { repo: namedRepo, origin },
  message: "The deployment names a different repository.", options: [{ id: "use_repo", label: `Deploy to ${namedRepo}` }],
};
const appsDecision = {
  action: "allow_apps", code: "other_apps", step: "push", data: { repo: origin, branch: "main", apps },
  message: "This push also deploys other apps.", options: [{ id: "allow_apps", label: "Push anyway" }],
};

/** @param {Tools} t @param {"repo" | "apps"} kind @param {boolean} approve */
async function deployDecision(t, kind, approve) {
  const { page } = t;
  const repo = kind === "repo";
  const requests = await installDeploy(t, repo ? repoDecision : appsDecision);
  const approveButton = page.locator(repo ? '[data-lp="use-repo"]' : '[data-lp="allow-apps"]');
  const declineButton = page.locator(repo ? '[data-lp="decline-repo"]' : '[data-lp="decline-apps"]');
  if (repo) assert.match(await page.locator(".lp-note.t-need").first().innerText(), /Pushes to fixtures\/launchpad-demo/);
  await page.locator('[data-lp="deploy"]').click();
  await passUndo(t, 3100);
  await approveButton.waitFor();
  assert.equal(requests.length, 1);
  const card = await page.locator(".lp-ask").innerText();
  for (const name of repo ? [namedRepo, origin] : [origin, "launchpad-demo", "deploy-staging.yml"]) assert.ok(card.includes(name));
  assert.equal((await approveButton.innerText()).trim(), repo ? `Deploy to ${namedRepo}` : "Push anyway");
  const key = repo ? "use_repo" : "allow_apps";
  assert.equal(requests[0][key], undefined);
  if (approve) {
    const replied = page.waitForResponse((/** @type {any} */ response) => response.request().method() === "POST"
      && new URL(response.url()).pathname === deploy);
    await approveButton.click();
    await passUndo(t, 6200);
    await replied;
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[1][key], repo ? namedRepo : apps.map((app) => app.id));
    assert.equal(requests[1].name, requests[0].name);
    return;
  }
  await declineButton.click();
  await approveButton.waitFor({ state: "hidden" });
  await page.locator('[data-lp="deploy"]').waitFor();
  assert.equal(await page.locator('[data-lp="undo"]').count(), 0);
  assert.equal(requests.length, 1);
}

const repoSetup = {
  ...setup, routes: {
    ...setup.routes, [`GET ${deploy}/check`]: {
      ...setup.routes[`GET ${deploy}/check`], warnings: [`Pushes to ${namedRepo}, which isn't your repository.`],
    },
  },
};

/** @type {Omit<Case, 'file'>[]} */
export const cases = /** @type {const} */ (["desktop", "phone"]).flatMap((viewport) => ["dark", "light"].flatMap((theme) => [
  {
    name: `Launchpad name suggestion under the hint at ${viewport} ${theme}`, viewport, seed: setup,
    async run(/** @type {Tools} */ t) {
      await openLaunchpad(t, viewport === "phone", theme);
      await appName(t, viewport === "phone");
    },
  },
  {
    name: `Launchpad repository name persists through a redraw at ${viewport} ${theme}`, viewport, seed: setup,
    async run(/** @type {Tools} */ t) {
      await openLaunchpad(t, viewport === "phone", theme);
      await repoName(t);
    },
  },
  .../** @type {const} */ (["repo", "apps"]).flatMap((kind) => [true, false].map((approve) => ({
    name: `Launchpad ${kind} decision ${approve ? "approved" : "declined"} at ${viewport} ${theme}`,
    viewport, seed: kind === "repo" ? repoSetup : setup,
    async run(/** @type {Tools} */ t) {
      await openLaunchpad(t, viewport === "phone", theme);
      await deployDecision(t, kind, approve);
    },
  }))),
]));
