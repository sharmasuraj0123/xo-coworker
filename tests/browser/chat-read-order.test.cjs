// A plain chat's session reads (Chats' list, a chat's own read) stand where they were SENT in the stream's order
// (storm.js noteSession, timeline.js statusLater): a status frame that lands while a read is out is newer than
// what the read says, both ways. The usage limit's "queued" landing mid-read stays Waiting (no Stop); "running"
// landing mid-read stays Working (its Stop). Four cells; all API traffic mocked; reads held back by the test.
//   node tests/browser/chat-read-order.test.cjs     (ORDER_CELLS="390 light" runs only those)
"use strict";
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "/tmp/pw/node_modules/playwright-core");
const { serve, launch, openApp, NOW } = require("./harness.cjs");

const POOL = "claude_code:acct-test";
const RESET = new Date(Date.now() + 2 * 3600e3).toISOString();
const waiting = { for: "limit", until: RESET, pool: POOL, why: "usage limit reached" };
const chat = (state) => ({ id: "pc", seq: 7, role: "plain", agent: "claude_code", pool: POOL, state, busy: state === "running", waiting: state === "queued" ? waiting : null, cwd: "/home/test", created_at: NOW, updated_at: NOW, retired_at: null });
const CELLS = [[1440, "dark"], [1440, "light"], [390, "dark"], [390, "light"]]
  .filter(([w, th]) => !process.env.ORDER_CELLS || process.env.ORDER_CELLS.split(",").map((x) => x.trim()).includes(`${w} ${th}`));

(async () => {
  const server = await serve();
  let browser;
  let n = 0;
  try {
    browser = await launch(chromium);
    assert.ok(browser, "Chromium is available");
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const [width, theme] of CELLS) {
      const cell = `${width} ${theme}`;
      // what each read answers, and a gate the test opens: a read is out until then
      const R = { list: chat("cold"), one: chat("cold"), gate: null, release: null, asked: [] };
      const hold = () => { R.gate = new Promise((r) => { R.release = r; }); };
      const W = {
        beforeLoad: async (p) => {
          await p.route("**/api/chat/sessions?*", async (r) => {
            const plain = new URL(r.request().url()).searchParams.get("role") === "plain";
            if (plain) { R.asked.push("list"); if (R.gate) await R.gate; }
            return r.fulfill({ json: { sessions: [R.list], next_after_seq: null } });
          });
          await p.route("**/api/chat/sessions/pc", async (r) => { R.asked.push("one"); if (R.gate) await R.gate; return r.fulfill({ json: R.one }); });
        },
      };
      const page = await openApp(browser, base, W, { width, height: width < 600 ? 844 : 900, theme });
      await page.waitForFunction(() => window.__t.world.state.loaded && window.__t.world.state.sessions.pc);
      let seq = 1000;
      const frame = (data) => page.evaluate(({ data, seq }) => window.__storm.apply({ type: "session", envelope: { type: "session", session_id: "pc", seq, ts: new Date().toISOString(), data } }), { data, seq: ++seq });
      const stateNow = () => page.evaluate(() => window.__t.world.state.sessions.pc.state);
      // wait until a read of this kind is out (asked of the server, its answer held)
      const outOf = async (kind, before) => { const t0 = Date.now(); while (R.asked.filter((x) => x === kind).length <= before) { if (Date.now() - t0 > 8000) throw new Error(`no ${kind} read`); await new Promise((r) => setTimeout(r, 20)); } };

      // ── the list, the limit's "queued" landing while it's out: Waiting stays ──
      let before = R.asked.filter((x) => x === "list").length;
      R.list = chat("running"); hold();
      await page.evaluate(() => window.__t.go("chats"));
      await outOf("list", before);
      await frame({ status: "queued", reason: `pool closed until ${RESET}`, waiting });
      await page.waitForFunction(() => window.__t.world.state.sessions.pc.state === "queued");
      R.release(); R.gate = null;
      await page.waitForFunction(() => /Starts|Waiting/.test(document.querySelector('[data-go="c:pc"] .ch-a')?.textContent || ""));
      assert.equal(await stateNow(), "queued", `${cell}: the frame that landed mid-read stands`);
      assert.match(await page.locator('[data-go="c:pc"] .ch-a').textContent(), /Starts|Waiting/, cell);

      // ── the list again, "running" landing while it's out (it says queued): Working stays ──
      before = R.asked.filter((x) => x === "list").length;
      R.list = chat("queued"); hold();
      await page.evaluate(() => { window.__t.go("home"); window.__t.go("chats"); });
      await outOf("list", before);
      await frame({ status: "running" });
      await page.waitForFunction(() => window.__t.world.state.sessions.pc.state === "running");
      R.release(); R.gate = null;
      await page.waitForFunction(() => /Working/.test(document.querySelector('[data-go="c:pc"] .ch-a')?.textContent || ""));
      assert.equal(await stateNow(), "running", `${cell}: running stands`);

      // ── the chat's own read, both ways (it has no native id yet, so opening it reads it) ──
      before = R.asked.filter((x) => x === "one").length;
      R.one = chat("queued"); hold();
      await page.evaluate(() => window.__t.go("c:pc"));
      await outOf("one", before);
      await frame({ status: "running" });
      R.release(); R.gate = null;
      await page.waitForFunction(() => document.querySelector("#send")?.getAttribute("title") === "Stop the agent (it keeps what's done)");
      assert.equal(await stateNow(), "running", `${cell}: the chat's read doesn't undo running (its Stop shows)`);

      // a read sent after the frame stands: the list now says queued, sent after "running" was seen
      before = R.asked.filter((x) => x === "list").length;
      R.list = chat("queued");
      await page.evaluate(() => { window.__t.go("home"); window.__t.go("chats"); });
      await outOf("list", before);
      await page.waitForFunction(() => window.__t.world.state.sessions.pc.state === "queued");
      await page.waitForFunction(() => /Starts|Waiting/.test(document.querySelector('[data-go="c:pc"] .ch-a')?.textContent || ""));

      assert.deepEqual(page.errors, [], `${cell}: no page errors`);
      await page.context().close();
      n++;
      console.log(`ok: ${cell}: a chat's reads stand where they were sent; a status that lands mid-read stays, both ways`);
    }
    assert.equal(n, CELLS.length, "every cell ran");
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((err) => { console.error(err); process.exitCode = 1; });
