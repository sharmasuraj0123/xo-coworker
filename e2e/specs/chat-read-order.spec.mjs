// @ts-check

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** @import { Case, Seed, Tools } from "../lib/types.d.ts" */

/** @typedef {{request(): ReadRequest, fulfill(options: {json: unknown}): Promise<void>}} ReadRoute @typedef {{url(): string}} ReadRequest */

const seed = /** @type {Seed} */ (JSON.parse(readFileSync(new URL("../seeds/basic.json", import.meta.url), "utf8")));

const viewports = /** @type {const} */ (["desktop", "phone"]);
const pool = "claude_code:acct-test";
const waiting = { for: "limit", until: new Date(Date.parse(seed.now ?? "") + 2 * 60 * 60 * 1000).toISOString(),
  pool, why: "usage limit reached" };
const session = (/** @type {string} */ state) => ({ id: "pc", role: "plain", seq: 7, agent: "claude_code", pool, state,
  busy: state === "running", waiting: state === "queued" ? waiting : null, cwd: "/home/test", created_at: seed.now, retired_at: null });

/** @param {Tools} t @param {boolean} phone @param {string} id */
async function navigate(t, phone, id) {
  if (phone) await t.page.locator("#pb-menu, #top-menu").filter({ visible: true }).first().click();
  await t.page.locator(id).click();
}

/** @param {Tools} t */
async function reads(t) {
  /** @type {{kind: 'list' | 'detail', state: string, release: ReturnType<typeof Promise.withResolvers<void>>} | null} */
  let next = null;
  let list = "cold";
  await t.page.route("**/api/chat/sessions?*", async (/** @type {ReadRoute} */ route) => {
    const plain = new URL(route.request().url()).searchParams.get("role") === "plain";
    const gate = plain && next?.kind === "list" ? next : null;
    if (gate) await gate.release.promise;
    await route.fulfill({ json: { sessions: [session(gate?.state ?? list)], next_after_seq: null } });
  });
  await t.page.route("**/api/chat/sessions/pc", async (/** @type {ReadRoute} */ route) => {
    const gate = next?.kind === "detail" ? next : null;
    if (gate) await gate.release.promise;
    await route.fulfill({ json: session(gate?.state ?? list) });
  });
  return {
    setList(/** @type {string} */ state) { list = state; },

    hold(/** @type {'list' | 'detail'} */ kind, /** @type {string} */ state) {
      const gate = {
        kind, state,
        release: /** @type {ReturnType<typeof Promise.withResolvers<void>>} */ (Promise.withResolvers()),
      };
      next = gate;
      const opened = t.page.waitForRequest((/** @type {ReadRequest} */ request) => {
        const url = new URL(request.url());
        return kind === "list" ? url.pathname === "/api/chat/sessions" && url.searchParams.get("role") === "plain"
          : url.pathname === "/api/chat/sessions/pc";
      });
      return { opened, release() { gate.release.resolve(); if (next === gate) next = null; } };
    },
  };
}

/** @param {Tools} t @param {boolean} phone */
async function verify(t, phone) {
  const { page, space } = t;
  const api = await reads(t);
  const row = page.locator('[data-go="c:pc"]');
  const activity = row.locator(".chl-a");
  const wait = (/** @type {RegExp} */ words) => activity.filter({ hasText: words }).waitFor();
  await t.open();
  const frame = (/** @type {string} */ status, extra = {}) => space.push("session", { status, ...extra }, { session_id: "pc" });
  const heldActivity = /Starts|Waiting/;
  const listRace = async (/** @type {string} */ response, /** @type {() => void} */ update, /** @type {RegExp} */ words) => {
    const held = api.hold("list", response);
    try {
      await Promise.all([navigate(t, phone, "#nv-chats"), held.opened]);
      update();
      await wait(words);
    } finally { held.release(); }
    await t.settle();
    assert.match(await activity.innerText(), words);
  };
  await listRace("running", () => frame("queued", { waiting }), heldActivity);
  await navigate(t, phone, "#nv-home");
  await listRace("queued", () => frame("running"), /Working/);
  api.setList("queued");
  await navigate(t, phone, "#nv-home");
  await navigate(t, phone, "#nv-chats");
  await t.settle();
  await wait(heldActivity);
  const detail = api.hold("detail", "queued");
  try {
    await Promise.all([row.click(), detail.opened]);
    assert.doesNotMatch((await page.locator("#send").getAttribute("title")) ?? "", /^Stop the agent/);
    frame("running");
    await page.locator('#send[title^="Stop the agent"]').waitFor();
  } finally { detail.release(); }
  await t.settle();
  assert.match((await page.locator("#send").getAttribute("title")) ?? "", /^Stop the agent/);
}

/** @type {Omit<Case, 'file'>[]} */
export const cases = viewports.flatMap((viewport) => ["dark", "light"].map((theme) => ({
  name: `plain chat list and detail read ordering at ${viewport} ${theme}`, viewport, seed,
  async run(t) {
    await t.page.addInitScript((/** @type {string} */ value) => localStorage.setItem("cv-theme", value), theme);
    await verify(t, viewport === "phone");
  },
})));
