// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { dom } from "./lib/dom.mjs";

test("the rich Markdown scheduler preserves cached pages and retires held draws on permanent pagehide", async (t) => {
  const BrowserEvent = globalThis.Event;
  const { document } = await dom('<span class="md-math" data-tex="x"></span>');
  const formula = document.querySelector(".md-math");
  const browser = new EventTarget();
  const observers = [];
  Object.assign(globalThis, { window: browser, innerHeight: 600, MutationObserver: class {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  } });
  const listen = t.mock.method(browser, "addEventListener");
  const chart = t.mock.method(document, "addEventListener");
  const globalListen = t.mock.method(globalThis, "addEventListener");
  const unlisten = t.mock.method(browser, "removeEventListener");
  const unchart = t.mock.method(document, "removeEventListener");
  const queries = t.mock.method(document, "querySelector");
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { startRich } = await import("../core/ui/markdown/rich.js");
  assert.equal(listen.mock.callCount(), 0, "import does not subscribe to window events");
  assert.equal(chart.mock.callCount(), 0, "import does not subscribe to document events");
  assert.equal(globalListen.mock.callCount(), 0, "import does not subscribe to global events");
  assert.deepEqual(observers, [], "import does not create observers");
  assert.equal(queries.mock.callCount(), 0, "import does not scan the page for rich content");
  assert.equal(document.head.childElementCount, 0, "import does not request drawing assets");
  const pagehide = (persisted) => browser.dispatchEvent(Object.assign(new BrowserEvent("pagehide"), { persisted }));
  t.after(() => pagehide(false));

  startRich();
  await Promise.resolve();
  assert.equal(document.head.childElementCount, 2, "the scheduler began a real lazy math draw");
  pagehide(true);
  assert.deepEqual(observers.map(({ disconnected }) => disconnected), [false, false]);

  observers[0].callback();
  browser.dispatchEvent(new BrowserEvent("keydown"));
  pagehide(false);
  assert.deepEqual(observers.map(({ disconnected }) => disconnected), [true, true]);
  assert.ok(unlisten.mock.calls.some(({ arguments: [type] }) => type === "keydown"));
  assert.deepEqual(unchart.mock.calls.map(({ arguments: [type] }) => type).sort(), ["pointermove", "pointerout"]);
  const retiredQueries = queries.mock.callCount();
  t.mock.timers.tick(51);
  assert.equal(queries.mock.callCount(), retiredQueries);

  const [stylesheet, script] = document.head.children;
  Object.assign(browser, { katex: { renderToString: () => "<b>rendered</b>" } });
  script.onload();
  stylesheet.onload();
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.equal(formula.classList.contains("is-done"), false);
  assert.equal(formula.innerHTML, "");
});
