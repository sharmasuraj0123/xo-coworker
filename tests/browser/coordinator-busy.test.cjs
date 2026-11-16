// Coordinator activity and Stop agree across replacement/retirement. All API traffic is mocked.
// node tests/browser/coordinator-busy.test.cjs
"use strict";
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "/tmp/pw/node_modules/playwright-core");
const { serve, launch, openApp, NOW } = require("./harness.cjs");

(async () => {
  const server = await serve();
  let browser;
  try {
    browser = await launch(chromium);
    assert.ok(browser, "Chromium is available");
    const base = `http://127.0.0.1:${server.address().port}`;
    const session = (id, seq, extra = {}) => ({ id, seq, chat_id: "chat_demo", role: "project-coordinator", state: "warm", agent: "claude_code", retired_at: null, ...extra });
    const sessions = [
      session("old", 1, { state: "queued", retired_at: NOW }),
      session("current", 3),
      session("ws-old", 4, { chat_id: "chat_ws", role: "workspace-coordinator", state: "running", retired_at: NOW }),
      session("ws-current", 5, { chat_id: "chat_ws", role: "workspace-coordinator" }),
    ];
    const aborted = [];
    const page = await openApp(browser, base, { beforeLoad: async (p) => {
      await p.route("**/api/chat/sessions?*", (r) => r.fulfill({ json: { sessions, next_after_seq: null } }));
      await p.route("**/api/chat/abort", (r) => { aborted.push(r.request().postDataJSON()); return r.fulfill({ json: { stopped: true } }); });
    } });
    await page.waitForFunction(() => window.__t.world.state.loaded && window.__t.world.state.sessions.current);
    await page.evaluate(() => window.__t.go("p:demo"));
    const row = page.locator('#projects [data-go="p:demo"]');
    const idle = async (project = "demo") => {
      assert.deepEqual(await page.evaluate((id) => {
        const a = window.__t.world.act;
        return [a.coordinatorBusy(id), a.replying(id), a.doing(id)];
      }, project), [null, false, null]);
    };
    await idle();
    await idle("workspace");
    assert.doesNotMatch(await row.getAttribute("class"), /\bbusy\b/);
    assert.doesNotMatch(await row.innerText(), /working/i);
    assert.equal(await page.locator("#send").getAttribute("title"), "Send (Enter)");
    console.log("ok: retired queued coordinator does not show Working or Stop");

    // A replacement can arrive before retirement of its predecessor. Select newest
    // first, then test busy, rather than selecting any busy predecessor.
    await page.evaluate(() => {
      window.__t.world.state.sessions.stale = { id: "stale", seq: 2, chat_id: "chat_demo", role: "project-coordinator", state: "running", agent: "stale-agent" };
      window.__t.render();
    });
    await idle();
    assert.equal(await page.evaluate(() => window.__t.world.act.coordinatorAgent("chat_demo")), "claude_code");
    assert.doesNotMatch(await row.getAttribute("class"), /\bbusy\b/);
    console.log("ok: older non-retired coordinator cannot override the idle current session");

    const status = async (id, state, extra = {}) => {
      await page.evaluate(({ id, state, extra }) => window.__storm.apply({ type: "session", envelope: { type: "session", session_id: id, seq: 50, ts: new Date().toISOString(), data: { status: state, ...extra } } }), { id, state, extra });
    };
    await status("current", "running");
    await page.waitForFunction(() => document.querySelector("#send").title === "Stop the coordinator");
    assert.match(await row.getAttribute("class"), /\bbusy\b/);
    assert.match(await row.innerText(), /Coordinator working/);
    assert.equal(await page.evaluate(() => window.__t.world.act.coordinatorBusy("demo")), "current");
    const stopped = page.waitForResponse((r) => r.url().endsWith("/api/chat/abort"));
    await page.locator("#send").click();
    await stopped;
    assert.deepEqual(aborted, [{ session_id: "current" }]);
    console.log("ok: live coordinator Working and Stop target the same current session");

    // With every coordinator retired, even a queued status must clear activity.
    await status("stale", "cold", { reason: "retired" });
    await status("current", "queued", { reason: "retired" });
    await page.waitForFunction(() => !document.querySelector('#projects [data-go="p:demo"]').classList.contains("busy"));
    await idle();
    assert.equal(await page.evaluate(() => window.__t.world.act.coordinatorAgent("chat_demo")), null);
    assert.deepEqual(page.errors, []);
    console.log("ok: retirement stream event clears coordinator activity");
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((err) => { console.error(err); process.exitCode = 1; });
