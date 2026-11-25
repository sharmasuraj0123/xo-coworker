// @ts-check

import assert from "node:assert/strict";
import test from "node:test";
import { dom } from "../../../tests/lib/dom.mjs";
import { createPacing } from "../pacing.js";

for (const pagehide of [null, true, false]) {
  const label = pagehide === null ? "live page" : pagehide ? "persisted pagehide" : "permanent pagehide";
  test(`All Clear auto-close on a ${label}`, async (t) => {
    const { document, window } = await dom(
      '<button id="opener">Review</button><button id="next">Next focus</button><aside id="panel" hidden>' +
      '<div id="pn-h"></div><div id="pn-rail"></div><div id="pn-count"></div><div id="pn-stage"></div>' +
      '<div id="pn-foot"></div><button id="pn-x">Close</button></aside><div id="toast"></div>',
    );
    globalThis.matchMedia = () => ({ matches: true });
    t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
    let now = 0;
    t.mock.method(performance, "now", () => now);
    const { createDecisions } = await import("../controller.js");
    const { READ_MS } = await import("../kit.js");
    const thread = {
      id: "thread", title: "Check the project", project: "project", state: "needs_approval",
      asks: [{ id: "ask", kind: "permission", title: "Run npm test", risk: "routine" }],
      messages: [],
      checklist: { done: 0, total: 0, items: [] },
    };
    const notices = [];
    let closed = 0;
    const panel = createDecisions({
      world: { state: { threads: [thread], hosts: [] }, act: {} },
      P: createPacing({}), PROJ: (id) => id, waitSince: new Map(),
      announce: (text) => notices.push(text), render() {}, onGone() { closed++; },
    });
    const opener = document.querySelector("#opener"), next = document.querySelector("#next");
    opener.focus();
    assert.equal(panel.open(), true);
    now += READ_MS;
    document.querySelector('#card [data-act="allow"]').click();
    assert.match(document.querySelector("#card .done h3")?.textContent ?? "", /That's everything/);
    assert.match(notices.at(-1), /^That's everything/);
    t.mock.timers.tick(1399);
    assert.equal(panel.isOpen(), true);

    const hide = (persisted) => window.dispatchEvent(Object.assign(new Event("pagehide"), { persisted }));
    if (pagehide !== null) hide(pagehide);
    next.focus();
    t.mock.timers.tick(1);
    t.mock.timers.tick(0);
    assert.equal(closed, pagehide === false ? 0 : 1);
    assert.equal(panel.isOpen(), pagehide === false);
    assert.equal(document.activeElement, pagehide === false ? next : opener);
    hide(false);
  });
}
