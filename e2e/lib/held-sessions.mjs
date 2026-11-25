// @ts-check

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createStore } from "./store.mjs";

/** @import { Case, Frame, Row, Seed, Tools } from "./types.d.ts" */

const basic = /** @type {Seed} */ (JSON.parse(readFileSync(new URL("../seeds/basic.json", import.meta.url), "utf8")));
const reset = "2026-11-19T15:17:00Z";
const pool = "claude_code:default";
const runtimeRoute = "/api/chat/runtimes";
const { runtimes: [runtime] } = /** @type {{runtimes: Row[]}} */ (createStore().statics[runtimeRoute]);
const profiles = /** @type {const} */ ([
  ["desktop", "dark", 1440, 900], ["desktop", "light", 1440, 900], ["phone", "dark", 390, 844], ["phone", "light", 390, 844],
]);

/** @param {Row[]} sessions @param {Row[]} threads @param {Row[]} [messages] @returns {Seed} */
export function heldSeed(sessions, threads, messages = []) {
  const [{ ts }] = threads;
  return { ...basic, threads: { chat_demo: threads }, threadMessages: { [ts]: messages }, routes: {
    ...basic.routes,
    [`GET ${runtimeRoute}`]: { runtimes: [{ ...runtime, cli: { ...runtime.cli, account: "default" },
      health: { ...runtime.health, account: "default", pool, limit: "closed", resets_at: reset } }] },
    "GET /api/chat/sessions": { sessions, next_after_seq: null },
    "GET /api/chat/status": { sessions: { live: 0, warm: 0, held_back: [] }, queue: { by_priority: {}, by_pool: {}, waiting: {} },
      pools: [{ id: pool, state: "closed", resets_at: reset, reason: "limit" }] },
  } };
}

export const contract = (() => {
  const path = new URL("../../tests/fixtures/storm-held-contract.json", import.meta.url);
  /** @type {{ sessions: Row[], threads: Row[], thread_ts: string, thread_session: string, coordinator: string, events: Frame[] }} */
  const fixture = JSON.parse(readFileSync(path, "utf8").replaceAll("__RESET__", reset));
  return fixture;
})();

/** @param {boolean} explicit */
export function synthetic(explicit) {
  const waiting = explicit ? { waiting: { for: "limit", until: reset, pool, why: "usage limit" } } : {};
  const createSession = (/** @type {string} */ id, /** @type {number} */ seq, /** @type {Row} */ extra) => ({
    id, seq, chat_id: "chat_demo", state: "queued", busy: !explicit, agent: "claude_code", pool, retired_at: null, ...waiting, ...extra,
  });
  const thread = (/** @type {string} */ id, /** @type {string} */ ts, /** @type {string} */ title, /** @type {string} */ state) => ({
    ts, title, state, session_id: id, cwd: "/home/test/demo", created_at: basic.now, updated_at: basic.now, busy: !explicit,
    session: { state: "queued", agent: "claude_code", busy: !explicit, live_runs: 0, paused: null, ...waiting },
  });
  const sessions = [createSession("s-co", 3, { role: "project-coordinator" }),
    createSession("s-held", 4, { role: "thread", thread_ts: "t-held" }),
    createSession("s-done", 5, { role: "thread", thread_ts: "t-done" })];
  const threads = [thread("s-held", "t-held", "Research the telemetry", "working"),
    thread("s-done", "t-done", "Write the summary", "done")];
  const messages = [{ id: "try-later", author_kind: "agent", author_id: "thread", text: "Try when it resets", seq: 6 }];
  return { seed: heldSeed(sessions, threads, messages), coordinator: "s-co", session: "s-held", thread: "t-held", done: "t-done",
    events: [], label: explicit ? "explicit waiting payload" : "queued backend payload" };
}

/** @param {Tools['page']} page @param {string} selector */
const visible = (page, selector) => page.locator(selector).filter({ visible: true }).first();

/** @param {Tools} t @param {boolean} phone */
async function project(t, phone) {
  if (phone && await t.page.locator('#app[data-view="thread"]').count()) {
    await t.page.locator("#top-back").click();
    await t.page.locator('#app[data-view="project"]').waitFor();
    await t.settle();
    return;
  }
  if (phone) await visible(t.page, "#pb-menu, #top-menu").click();
  const row = visible(t.page, '[data-go="p:demo"]');
  await row.click();
  await t.settle();
}

/** @param {Tools} t @param {string} ts */
async function openThread(t, ts) {
  const { page } = t;
  if (await page.locator("#stage").isHidden()) await visible(page, "[data-stage-toggle]").click();
  const fold = visible(page, '[data-tg-fold="waiting"]');
  await fold.waitFor();
  if ((await fold.getAttribute("aria-expanded")) === "false") await fold.click();
  await visible(page, `#stage [data-go="t:${ts}"]`).click();
  await page.getByRole("button", { name: "Open in main chat" }).click();
  const close = visible(page, "#stage [data-stg-close]");
  if (await close.count()) await close.click();
  await t.settle();
}

/** @param {Tools} t @param {boolean} isThread */
async function heldLine(t, isThread) {
  const { page } = t;
  const line = page.locator("#typing .typing.is-held");
  const words = (await line.innerText()).replace(/\u00a0/g, " ");
  assert.match(words, /waiting for the usage limit · starts (?:tomorrow )?at (?:3:17\s*pm|15:17)/i);
  assert.doesNotMatch(words, /working|replying/i);
  assert.equal(await line.locator(".arc, .shimmer").count(), 0);
  assert.equal(await line.locator(".elapsed").textContent(), "");
  assert.equal(await line.locator(".av.is-wait").count(), 1);
  assert.equal(await page.locator("#send").getAttribute("title"), "Send (Enter)");
  if (isThread) {
    const heading = await page.locator("#top-who").innerText();
    assert.match(heading, /Waiting/);
    assert.doesNotMatch(heading, /Working|Idle|Done/);
    assert.equal(await page.locator("#top-who .badge.st-paused .g-paused").count(), 1);
    assert.notEqual(await page.locator("#top").getAttribute("data-state"), "busy");
  }
}

/** @param {Tools['page']} page */
async function pausedLine(page) {
  const paused = page.locator("#herald .hr-conn .hr-t");
  await paused.waitFor();
  assert.match((await paused.innerText()).replace(/\u00a0/g, " "), /^Paused until (?:3:17\s*pm|15:17)$/i);
  const gap = await page.evaluate(() => {
    const typing = document.querySelector("#typing .ty-b");
    const herald = document.querySelector("#herald .hr-conn");
    return typing && herald ? Math.round(herald.getBoundingClientRect().top - typing.getBoundingClientRect().bottom) : null;
  });
  assert.ok(gap !== null && gap >= 4, `the Paused until line clears typing by ${gap}px`);
}

/** @typedef {{seed: Seed, coordinator: string, session: string, thread: string, done?: string, events: Frame[], label: string}} HeldCase */
/** @param {HeldCase} witness @returns {Omit<Case, 'file'>[]} */
export function casesForHeld(witness) {
  return profiles.map(([viewport, theme, width, height]) => ({
    viewport, seed: witness.seed, name: `${witness.label} on ${viewport} ${theme}`,
    async run(t) {
      const { page } = t;
      await page.addInitScript((/** @type {string} */ value) => localStorage.setItem("cv-theme", value), theme);
      await t.open();
      const profile = await page.evaluate(() => [innerWidth, innerHeight, devicePixelRatio, document.documentElement.dataset.theme]);
      assert.deepEqual(profile, [width, height, 1, theme]);
      for (const frame of witness.events) t.space.push(frame.type, frame.data, frame);
      await t.settle();
      const phone = viewport === "phone";
      await project(t, phone);
      await heldLine(t, false);
      const projectRow = page.locator('#projects [data-go="p:demo"]');
      assert.match((await projectRow.getAttribute("aria-label")) ?? "", /Waiting for the usage limit/);
      assert.match((await projectRow.textContent()).replace(/\u00a0/g, " "), /Starts (?:3:17\s*pm|15:17)/i);
      assert.doesNotMatch((await projectRow.getAttribute("class")) ?? "", /\bbusy\b/);
      if (witness.done) await pausedLine(page);
      if (witness.done) {
        await openThread(t, witness.done);
        await heldLine(t, true);
        await project(t, phone);
      }
      await openThread(t, witness.thread);
      await heldLine(t, true);
      if (witness.done) {
        await pausedLine(page);
        if (!phone) assert.match((await page.locator("#top-who").innerText()).replace(/\u00a0/g, " "), /Usage limit · starts/i);
        await page.getByRole("log", { name: "Messages" }).getByText("Try when it resets", { exact: true }).waitFor();
      }
      const status = witness.events.length ? "starting" : "running";
      t.space.push("pool", { pool, state: "open", resets_at: null, reason: null });
      t.space.push("session", { status }, { session_id: witness.session, chat_id: "chat_demo", thread_ts: witness.thread });
      t.space.push("session", { status }, { session_id: witness.coordinator, chat_id: "chat_demo" });
      await page.locator('#send[title="Stop the agent (it keeps what\'s done)"]').waitFor();
      assert.match(await page.locator("#typing .typing:not(.is-held)").innerText(), /^Working/);
      await project(t, phone);
      await page.locator('#send[title="Stop the coordinator"]').waitFor();
      assert.match((await page.locator('#projects [data-go="p:demo"]').getAttribute("aria-label")) ?? "", /Working/);
    },
  }));
}
