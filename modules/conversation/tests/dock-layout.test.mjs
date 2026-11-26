import { createScope } from "../../../core/kernel/scope.js";
import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";
import { dockAtTop, watchDock } from "../dock-layout.js";

const { document } = await dom('<main id="app"><div id="scroller"><h1 id="cs-hi"></h1></div>'
  + '<div id="drop-veil"></div><div id="dock"><button class="cbar">Compose</button></div></main>');
const dock = document.querySelector("#dock"), host = document.querySelector("#app");
const bar = dock.firstElementChild;
bar.focus();
dockAtTop(true);
assert.ok(dock.previousElementSibling === document.querySelector("#cs-hi"));
assert.ok(document.activeElement === bar);
assert.ok(dock.classList.contains("is-top"));
dockAtTop(false);
assert.ok(dock.previousElementSibling === document.querySelector("#drop-veil"));
assert.ok(document.querySelector("#cs-hi").hidden);

let resize, observed, room = 0;
globalThis.ResizeObserver = class {
  constructor(callback) { resize = callback; }
  observe(node) { observed = node; }
  disconnect() { observed = null; }
};
Object.defineProperty(dock, "offsetHeight", { value: 63 });
dock.getBoundingClientRect = () => ({ top: 10 });
bar.getBoundingClientRect = () => ({ top: 15 });
const scope = createScope();
watchDock(scope, { dock, host, heraldRoom: () => room++ });
assert.ok(observed === dock);
resize();
assert.equal(host.style.getPropertyValue("--dock-h"), "63px");
assert.ok(dock.classList.contains("is-stacked"));
bar.getBoundingClientRect = dock.getBoundingClientRect;
resize();
assert.ok(!dock.classList.contains("is-stacked"));
assert.equal(room, 2);
scope.dispose();
assert.equal(observed, null);
