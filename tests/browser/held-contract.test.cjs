// The contract end to end: xo-space's own payloads for a coordinator and a thread the usage limit holds back
// (tests/fixtures/storm-held-contract.json: dumped from xo-space's test kit, GET /api/chat/sessions, the
// project's threads and the stream's session and thread events) read through this frontend. Nothing here is
// written by hand but the harness's world: what the backend says is what the UI must show as Waiting, with
// when it starts, no Working and no Stop. Then the reset's frames bring Working and Stop back.
// Every case in four cells: dark and light, at 1440×900 and 390×844. All API traffic is mocked.
//   node tests/browser/held-contract.test.cjs     (CONTRACT_CELLS="390 light" runs only those)
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "/tmp/pw/node_modules/playwright-core");
const { serve, launch, openApp } = require("./harness.cjs");

const RESET = new Date(Date.now() + 3 * 3600e3 + 17 * 60e3).toISOString().replace(/\.\d+Z$/, "Z");
const F = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "fixtures", "storm-held-contract.json"), "utf8").replaceAll("__RESET__", RESET));
const POOL = "claude_code:acct-test"; // the harness's runtime pool: the Space's own line reads it
const status = { sessions: { by_state: { cold: 0, running: 0, warm: 0 }, live: 0, warm: 0, released: 0, parked: 0, held_back: [], paused: {}, store_failed: [], backing_off: {}, waiting_for_decision: {} }, queue: { by_priority: { now: 0, next: 0, later: 0 }, by_pool: {}, waiting: {} }, pools: [{ id: POOL, state: "closed", resets_at: RESET, reason: "limit" }] };
const CELLS = [[1440, "dark"], [1440, "light"], [390, "dark"], [390, "light"]]
  .filter(([w, th]) => !process.env.CONTRACT_CELLS || process.env.CONTRACT_CELLS.split(",").map((x) => x.trim()).includes(`${w} ${th}`));
const sp = (x) => String(x || "").replace(/ /g, " ");

(async () => {
  const server = await serve();
  let browser;
  let n = 0;
  try {
    browser = await launch(chromium);
    assert.ok(browser, "Chromium is available");
    const base = `http://127.0.0.1:${server.address().port}`;
    const ts = F.thread_ts, sid = F.thread_session, co = F.coordinator;
    for (const [width, theme] of CELLS) {
      const cell = `${width} ${theme}`;
      const W = {
        threadsBy: { chat_demo: F.threads },
        threadPages: { [ts]: [] },
        beforeLoad: async (p) => {
          await p.route("**/api/chat/sessions?*", (r) => r.fulfill({ json: { sessions: F.sessions, next_after_seq: null } }));
          await p.route("**/api/chat/status", (r) => r.fulfill({ json: status }));
        },
      };
      const page = await openApp(browser, base, W, { width, height: width < 600 ? 844 : 900, theme });
      await page.waitForFunction(({ ts, co }) => window.__t.world.state.loaded && window.__t.world.thread(ts) && window.__t.world.state.sessions[co], { ts, co });
      // the stream's own events, in order, as they came
      await page.evaluate((events) => { for (const e of events) window.__storm.apply({ type: e.type, envelope: { type: e.type, session_id: e.session_id, chat_id: e.chat_id, thread_ts: e.thread_ts, seq: e.seq, ts: new Date().toISOString(), data: e.data } }); }, F.events);
      const live = () => page.evaluate(() => { const st = window.__t.world.state; st.conn = "live"; st.error = null; st.statusError = null; window.__t.render(); });
      const line = () => page.evaluate(() => { const b = document.querySelector("#typing .typing"); return b ? { text: b.querySelector(".ty-t").textContent, held: b.classList.contains("is-held"), arc: !!b.querySelector(".arc") } : null; });
      const sendTitle = () => page.locator("#send").getAttribute("title");

      // what the world made of the backend's word
      const seen = await page.evaluate(({ ts, co }) => {
        const w = window.__t.world, t = w.thread(ts);
        return { busy: t.busy, held: t.held, coBusy: w.act.coordinatorBusy("demo"), replying: w.act.replying("demo"), coHeld: w.act.coordinatorHeld("demo"), session: w.state.sessions[co].waiting };
      }, { ts, co });
      assert.equal(seen.busy, false, `${cell}: the thread isn't busy`);
      assert.deepEqual(seen.held, { for: "limit", until: RESET, why: "usage limit reached", asked: false }, cell);
      assert.equal(seen.coBusy, null, cell);
      assert.equal(seen.replying, false, cell);
      assert.deepEqual(seen.coHeld, { for: "limit", until: RESET, why: "usage limit reached", asked: false }, cell);

      await page.evaluate(() => window.__t.go("p:demo"));
      await live();
      await page.waitForFunction(() => /waiting for the usage limit/.test(document.querySelector("#typing .typing .ty-t")?.textContent || ""));
      let l = await line();
      assert.match(sp(l.text), /^demo coordinator · waiting for the usage limit · starts (tomorrow )?at \d{1,2}:\d\d [AP]M$/, cell);
      assert.deepEqual([l.held, l.arc], [true, false], cell);
      assert.equal(await sendTitle(), "Send (Enter)", `${cell}: no Stop on the held coordinator`);

      await page.evaluate((ts) => window.__t.go("t:" + ts), ts);
      await live();
      await page.waitForFunction(() => /^Waiting for the usage limit/.test(document.querySelector("#typing .typing .ty-t")?.textContent || ""));
      l = await line();
      assert.match(sp(l.text), /^Waiting for the usage limit · starts (tomorrow )?at \d{1,2}:\d\d [AP]M$/, cell);
      assert.equal(await sendTitle(), "Send (Enter)", `${cell}: no Stop on the held thread`);
      const head = sp(await page.locator("#top-who").textContent());
      assert.match(head, /Waiting/, cell);
      assert.doesNotMatch(head, /Working|Idle/, cell);

      // the reset: its pool opens and the sessions start (status frames as the engine writes them)
      await page.evaluate(({ sid, co }) => {
        const at = new Date().toISOString();
        window.__storm.apply({ type: "pool", envelope: { type: "pool", seq: 900, ts: at, data: { pool: "claude_code:acct-test", state: "open", resets_at: null, reason: null } } });
        window.__storm.apply({ type: "session", envelope: { type: "session", session_id: sid, seq: 901, ts: at, data: { status: "starting" } } });
        window.__storm.apply({ type: "session", envelope: { type: "session", session_id: co, seq: 902, ts: at, data: { status: "starting" } } });
      }, { sid, co });
      await live();
      await page.waitForFunction(() => { const b = document.querySelector("#typing .typing"); return b && !b.classList.contains("is-held") && /^Working/.test(b.querySelector(".ty-t").textContent); });
      assert.equal(await sendTitle(), "Stop the agent (it keeps what's done)", `${cell}: Stop once it starts`);
      assert.deepEqual(page.errors, [], `${cell}: no page errors`);
      await page.context().close();
      n++;
      console.log(`ok: ${cell}: xo-space's own held payloads read as Waiting until the reset, then Working`);
    }
    assert.equal(n, CELLS.length, "every cell ran");
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((err) => { console.error(err); process.exitCode = 1; });
