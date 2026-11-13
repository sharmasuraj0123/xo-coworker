// A session the usage limit holds back is Waiting, never Working: storm queues it with no process (engine
// _wait), so nothing runs. The coordinator and a thread, each held by a closed pool, say what they wait for
// and until when: no arc, no shimmer, no clock, no Stop. The sidebar and the thread's header say Waiting.
// When the limit resets and they start, Working (and Stop) come back. Both backends: an older one that
// says only "queued" (and busy: true), read through the pool; a newer one that says `waiting` itself.
// Every case in four cells: dark and light, at 1440×900 and 390×844. All API traffic is mocked.
//   node tests/browser/held-waiting.test.cjs     (HELD_CELLS="390 light,1440 dark" runs only those)
//   HELD_SHOTS=/tmp/held keeps a screenshot of each cell
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "/tmp/pw/node_modules/playwright-core");
const { serve, launch, openApp, NOW } = require("./harness.cjs");

const POOL = "claude_code:acct-test"; // the harness's one runtime's pool
const RESET = new Date(Date.now() + 3 * 3600e3 + 17 * 60e3).toISOString();
const closed = { sessions: { by_state: { cold: 0, running: 0, warm: 0 }, live: 0, warm: 0, released: 0, parked: 0, held_back: [], paused: {}, store_failed: [], backing_off: {}, waiting_for_decision: {} }, queue: { by_priority: { now: 0, next: 0, later: 0 }, by_pool: {}, waiting: {} }, pools: [{ id: POOL, state: "closed", resets_at: RESET, reason: "limit" }] };
const waiting = { for: "limit", until: RESET, pool: POOL, why: "usage limit" };

/** The world: the demo project's coordinator and one thread, both held by the closed pool. newer: the backend says `waiting`. */
function world(newer) {
  const coord = { id: "co", seq: 3, chat_id: "chat_demo", role: "project-coordinator", state: "queued", busy: !newer, agent: "claude_code", pool: POOL, retired_at: null, ...(newer ? { waiting } : {}) };
  const ses = { id: "th", seq: 4, chat_id: "chat_demo", thread_ts: "t-held", role: "thread", state: "queued", busy: !newer, agent: "claude_code", pool: POOL, retired_at: null, ...(newer ? { waiting } : {}) };
  const thread = { ts: "t-held", chat_id: "chat_demo", title: "Research the telemetry", session_id: "th", cwd: "/home/test/demo", state: "working", status_md: "- [ ] Claude Code telemetry\n- [ ] Write it up", created_at: NOW, updated_at: NOW, busy: !newer, session: { state: "queued", agent: "claude_code", busy: !newer, paused: null, live_runs: 0, ...(newer ? { waiting } : {}) } };
  return {
    threadsBy: { chat_demo: [thread] },
    beforeLoad: async (p) => {
      await p.route("**/api/chat/sessions?*", (r) => r.fulfill({ json: { sessions: [coord, ses], next_after_seq: null } }));
      await p.route("**/api/chat/status", (r) => r.fulfill({ json: closed }));
    },
  };
}

const CELLS = [[1440, "dark"], [1440, "light"], [390, "dark"], [390, "light"]]
  .filter(([w, th]) => !process.env.HELD_CELLS || process.env.HELD_CELLS.split(",").map((x) => x.trim()).includes(`${w} ${th}`));

(async () => {
  const server = await serve();
  let browser;
  let n = 0;
  try {
    browser = await launch(chromium);
    assert.ok(browser, "Chromium is available");
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const [width, theme] of CELLS) for (const newer of [false, true]) {
      const cell = `${width} ${theme} ${newer ? "newer" : "older"} backend`;
      const page = await openApp(browser, base, world(newer), { width, height: width < 600 ? 844 : 900, theme });
      await page.waitForFunction(() => window.__t.world.state.loaded && window.__t.world.state.sessions.co && window.__t.world.thread("t-held"));
      await page.waitForFunction(() => window.__t.world.thread("t-held").held);
      const typing = async () => page.evaluate(() => {
        const b = document.querySelector("#typing .typing");
        return b ? { text: b.querySelector(".ty-t").textContent, held: b.classList.contains("is-held"), arc: !!b.querySelector(".arc"), shimmer: !!b.querySelector(".shimmer"), clock: b.querySelector(".elapsed").textContent, wait: !!b.querySelector(".av.is-wait") } : null;
      });
      const sendTitle = () => page.locator("#send").getAttribute("title");

      // ── the coordinator, held ──
      await page.evaluate(() => window.__t.go("p:demo"));
      await page.waitForFunction(() => document.querySelector("#typing .typing"));
      let ty = await typing();
      assert.match(ty.text, /^demo coordinator · waiting for the usage limit · starts (tomorrow )?at \d/, `${cell}: the coordinator's line`);
      assert.doesNotMatch(ty.text, /working|replying/i, cell);
      assert.deepEqual([ty.held, ty.arc, ty.shimmer, ty.clock, ty.wait], [true, false, false, "", true], `${cell}: no arc, shimmer or clock`);
      assert.equal(await sendTitle(), "Send (Enter)", `${cell}: no Stop, nothing runs`);
      const row = page.locator('#projects [data-go="p:demo"]');
      assert.doesNotMatch(await row.getAttribute("class"), /\bbusy\b/, cell);
      assert.match(await row.textContent(), /Waiting · (tomorrow )?\d/, `${cell}: the sidebar says Waiting, with the reset`);
      assert.doesNotMatch(await row.textContent(), /working/i, cell);
      assert.match(await row.getAttribute("aria-label"), /Waiting for the usage limit · starts (tomorrow )?at/, cell);
      // the project's header counts it waiting, not working
      assert.match(await page.locator("#top-who").textContent(), /1 waiting to start/, cell);
      assert.doesNotMatch(await page.locator("#top-who").textContent(), /working/i, cell);

      if (process.env.HELD_SHOTS) { fs.mkdirSync(process.env.HELD_SHOTS, { recursive: true }); await page.screenshot({ path: `${process.env.HELD_SHOTS}/${width}-${theme}-${newer ? "newer" : "older"}-coordinator.png` }); }

      // ── the thread, held ──
      await page.evaluate(() => window.__t.go("t:t-held"));
      await page.waitForFunction(() => { const b = document.querySelector("#typing .typing .ty-t"); return b && /^Waiting/.test(b.textContent); });
      ty = await typing();
      assert.match(ty.text, /^Waiting for the usage limit · starts (tomorrow )?at \d/, `${cell}: the thread's line`);
      assert.deepEqual([ty.held, ty.arc, ty.shimmer, ty.clock], [true, false, false, ""], cell);
      assert.equal(await sendTitle(), "Send (Enter)", `${cell}: no Stop on a held thread`);
      const head = await page.locator("#top-who").textContent();
      assert.match(head, /Usage limit · until (tomorrow )?\d/, `${cell}: the header says until when, with one runtime too`);
      assert.doesNotMatch(head, /Working|Idle/, cell);
      assert.equal(await page.locator("#top-who .badge.st-paused .g-paused").count(), 1, `${cell}: the pause's badge`);
      assert.notEqual(await page.locator("#top").getAttribute("data-state"), "busy", `${cell}: no Working sweep along the header`);
      if (process.env.HELD_SHOTS) { fs.mkdirSync(process.env.HELD_SHOTS, { recursive: true }); await page.screenshot({ path: `${process.env.HELD_SHOTS}/${width}-${theme}-${newer ? "newer" : "older"}-thread.png` }); }

      // ── the reset: the pool opens, both start: Working and Stop are back ──
      await page.evaluate(() => {
        const at = new Date().toISOString();
        window.__storm.apply({ type: "pool", envelope: { type: "pool", seq: 60, ts: at, data: { pool: "claude_code:acct-test", state: "open", resets_at: null, reason: null } } });
        window.__storm.apply({ type: "session", envelope: { type: "session", session_id: "th", seq: 61, ts: at, data: { status: "running" } } });
        window.__storm.apply({ type: "session", envelope: { type: "session", session_id: "co", seq: 62, ts: at, data: { status: "running" } } });
      });
      await page.waitForFunction(() => { const b = document.querySelector("#typing .typing"); return b && !b.classList.contains("is-held") && /^Working/.test(b.querySelector(".ty-t").textContent); });
      assert.equal(await sendTitle(), "Stop the agent (it keeps what's done)", `${cell}: Stop once it works`);
      assert.doesNotMatch(await page.locator("#top-who").textContent(), /Waiting/, cell);
      await page.evaluate(() => window.__t.go("p:demo"));
      await page.waitForFunction(() => /is working/.test(document.querySelector("#typing .typing .ty-t")?.textContent || ""));
      assert.equal(await sendTitle(), "Stop the coordinator", cell);
      assert.match(await row.getAttribute("class"), /\bbusy\b/, cell);
      assert.deepEqual(page.errors, [], `${cell}: no page errors`);
      assert.deepEqual(await page.evaluate(() => window.__focusDrops), [], `${cell}: no focus dropped`);
      await page.context().close();
      n++;
      console.log(`ok: ${cell}: Waiting until the reset, then Working`);
    }
    assert.equal(n, CELLS.length * 2, "every cell ran");
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((err) => { console.error(err); process.exitCode = 1; });
