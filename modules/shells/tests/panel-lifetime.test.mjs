// @ts-check

import assert from "node:assert/strict";
import { deferred, dom, same } from "../../../tests/lib/dom.mjs";
import { createShellPanel } from "../panel.js";

const markup = '<main><aside id="shd" hidden></aside><i id="after"></i></main><section id="host"></section>';
const { document, window } = await dom(markup);
globalThis.MutationObserver = window.MutationObserver;
const dock = document.getElementById("shd");
const host = document.getElementById("host");
const old = deferred(), current = deferred(), late = deferred();
const answers = [old, current, late];
let closes = 0;
const stage = { isShell: true, shellOff() { this.isShell = false; closes++; } };
const panel = createShellPanel({
  view: () => "t:thread",
  STAGE: stage,
  SH: {
    enabled: true,
    hide() { dock.hidden = true; },
    openThread() { return answers.shift().promise; },
    openWorkspace() {},
    openProject() {},
  },
  world: { thread: (id) => ({ id, project: "project", chatId: "chat", title: "Review" }) },
  heraldShow() {},
});
const flush = () => new Promise(setImmediate);
panel.panelShell(true, host);
await flush();
assert.equal(closes, 0, "Stage keeps the existing dock mounted during a thread shell lookup");
same(dock.parentNode, host);
panel.panelShell(false, host);
panel.panelShell(true, host);
old.resolve();
await flush();
assert.equal(closes, 0, "the previous opening cannot close the current Stage Shells page");
dock.hidden = false;
current.resolve();
await flush();
dock.hidden = true;
await flush();
assert.equal(closes, 1, "hiding an open dock still closes the mounted Stage Shells page");

stage.isShell = true;
panel.panelShell(true, host);
panel.dispose();
late.resolve();
await flush();
assert.equal(closes, 1, "completion cannot change Stage after its Shells owner disposes");
same(dock.nextSibling, document.getElementById("after"), "disposing restores the moved dock");
