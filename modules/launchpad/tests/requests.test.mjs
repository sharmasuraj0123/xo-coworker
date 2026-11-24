import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import test from "node:test";
import { deferred, dom } from "../../../tests/lib/dom.mjs";
import { createLaunchpad } from "../launchpad.js";
import { createLpWindow } from "../window.js";
import { createLpApi } from "../client.js";
import { model } from "../model.js";

const device = { id: "login", code: "CODE", url: "https://github.com/login/device" };
const app = (name) => ({ id: name, name, host: name + ".example", linkable: true, status: "live" });

async function mounted(t, api, { connected = false, linked = false } = {}) {
  const { document, window } = await dom("<main></main>");
  const proto = Object.getPrototypeOf(document.createElement("dialog"));
  proto.showModal = function () { this.open = true; };
  proto.close = function () {
    this.open = false;
    this.dispatchEvent(new window.Event("close"));
  };
  const previousCancel = globalThis.cancelAnimationFrame;
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"], now: 100000 });
  const advance = async (ms) => { t.mock.timers.tick(ms); await setImmediate(); };
  const projectOf = (view) => view?.slice(2) ?? null;
  const announcements = [], notices = new Map();
  let changes = 0;
  const launch = createLaunchpad({
    api: {
      check: async (p) => {
        const check = model({ project: p, state: "ready", fields: { port: { value: 8080 } },
          prerequisites: { github_connected: connected } });
        return linked ? { ...check, state: "linked", app: { ...app("demo"), url: "https://demo.example" } } : check;
      },
      ...api,
    },
    projectOf, announce: (message) => announcements.push(message),
    notice: (id, line) => notices.set(id, line), unnotice: (id) => notices.delete(id),
    onChange() { changes++; panel.sync(); },
  });
  const panel = createLpWindow({ launch, projectOf, nameOf: (p) => p, iconOf: () => "" });
  t.after(() => {
    panel.dispose();
    delete proto.showModal;
    delete proto.close;
    globalThis.cancelAnimationFrame = previousCancel;
  });
  const dialog = document.querySelector("dialog");
  const click = (action) => {
    const control = dialog.querySelector(`[data-lp="${action}"]`);
    assert.ok(control, `visible ${action} control`);
    control.click();
  };
  launch.ensure("p:demo");
  panel.open("p:demo");
  await setImmediate();
  return { panel, dialog, click, advance, announcements, notices, changes: () => changes };
}

test("disposing Launchpad retires a scheduled GitHub poll", async (t) => {
  let polls = 0;
  const pad = await mounted(t, { githubStart: async () => device, githubPoll: async () => { polls++; return {}; } });
  pad.click("reconnect");
  await setImmediate();
  assert.match(pad.dialog.textContent, /CODE/);
  await pad.advance(2499);
  assert.equal(polls, 0);
  pad.panel.dispose();
  await pad.advance(5000);
  assert.equal(polls, 0, "a retired device flow never issues its next poll");
});

test("disposing Launchpad aborts a live GitHub poll and fences its late success", async (t) => {
  const poll = deferred(), signals = [];
  const pad = await mounted(t, {
    githubStart: async () => device,
    githubPoll: (id, signal) => { assert.equal(id, device.id); signals.push(signal); return poll.promise; },
  });
  pad.click("reconnect");
  await setImmediate();
  await pad.advance(2500);
  assert.equal(signals.length, 1, "the live timer starts the poll");
  pad.panel.dispose();
  assert.equal(signals[0].aborted, true, "disposal reaches the poll transport");
  const changes = pad.changes();
  poll.resolve({ done: true });
  await pad.advance(5000);
  assert.equal(signals.length, 1);
  assert.deepEqual(pad.announcements, []);
  assert.equal(pad.changes(), changes, "a late poll cannot publish after disposal");
});

for (const refuse of [false, true]) {
  test(`Cancel and reopen keep the new picker after the old ${refuse ? "refusal" : "reply"}`, async (t) => {
    const reads = [];
    const pad = await mounted(t, { apps(p, signal) {
      assert.equal(p, "demo");
      const result = deferred();
      reads.push({ result, signal });
      return result.promise;
    } });
    pad.click("pick");
    await setImmediate();
    assert.equal(reads.length, 1);
    pad.click("pick-cancel");
    assert.equal(reads[0].signal.aborted, true, "Cancel immediately aborts the original read");
    pad.click("pick");
    await setImmediate();
    assert.equal(reads.length, 2);
    const changes = pad.changes();
    if (refuse) reads[0].result.reject(new Error("Old failure"));
    else reads[0].result.resolve([app("Old app")]);
    await setImmediate();
    assert.match(pad.dialog.textContent, /Reading your apps/);
    assert.doesNotMatch(pad.dialog.textContent, /Old app|Old failure/);
    assert.equal(pad.changes(), changes, "the retired picker cannot publish");
    reads[1].result.resolve([app("New app")]);
    await setImmediate();
    assert.equal(pad.dialog.querySelector('[data-lp="link"]').dataset.id, "New app");
  });
}

test("closing the dialog leaves a committed deploy countdown running", async (t) => {
  const sent = [];
  const pad = await mounted(t, { deploy(p, body) { sent.push([p, body.port]); return { stop() {} }; } }, { connected: true });
  pad.click("deploy");
  assert.ok(pad.dialog.querySelector('[data-lp="undo"]'));
  pad.panel.close();
  assert.equal(pad.panel.isOpen, false);
  await pad.advance(3000);
  assert.deepEqual(sent, [["demo", 8080]]);
});

test("Undo keeps the link when the dialog hands its unlink notice over", async (t) => {
  let writes = 0;
  const pad = await mounted(t, { async unlink() { writes++; } }, { connected: true, linked: true });
  pad.click("menu");
  pad.click("unlink");
  pad.panel.close();
  assert.equal(pad.panel.isOpen, false);
  const line = pad.notices.get("lp-unlink:demo");
  assert.equal(typeof line?.undo, "function");
  line.undo();
  await pad.advance(3500);
  assert.equal(writes, 0);
  pad.panel.open("p:demo");
  assert.ok(pad.dialog.querySelector('[data-lp="menu"]'), "the published dialog shows the app is still linked");
});

test("Launchpad request cancellation reaches fetch on every connection route", async (t) => {
  const api = createLpApi();
  const calls = new Map([
    ["api/deploy/demo/apps", (signal) => api.apps("demo", signal)],
    ["api/connectors/github/cli/start", (signal) => api.githubStart(false, signal)],
    ["api/connectors/github/cli/poll", (signal) => api.githubPoll("login", signal)],
    ["api/connectors/github/disconnect", (signal) => api.githubStart(true, signal)],
  ]);
  let request;
  t.mock.method(globalThis, "fetch", (path, { signal }) => {
    request = { path, signal };
    return Promise.reject(new DOMException("Fixture ended", "AbortError"));
  });
  for (const [path, start] of calls) {
    const controller = new AbortController();
    const result = start(controller.signal);
    assert.equal(request.path, path);
    const rejected = assert.rejects(result, { name: "AbortError" });
    controller.abort();
    assert.equal(request.signal.aborted, true, `caller cancellation reaches ${path}`);
    await rejected;
  }
});
